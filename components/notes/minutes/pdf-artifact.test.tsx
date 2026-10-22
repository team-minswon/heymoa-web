import { act, cleanup, render, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PdfPreview } from "@/components/notes/minutes/pdf-preview";
import {
  createMinutesPdfRenderer,
  renderMinutesPdf,
} from "@/components/notes/minutes/render-minutes-pdf";
import { usePdfArtifact } from "@/components/notes/minutes/use-pdf-artifact";
import { buildMinutes } from "@/lib/notes/minutes/model";

const blob = new Blob(["%PDF-test"], { type: "application/pdf" });
const artifact = { blob, fileName: "회의록.pdf" };
const document = () =>
  buildMinutes({
    note: {
      title: "회의",
      whenIso: "2026-10-18T00:00:00Z",
      participantCount: 1,
    },
    topics: [],
    sections: [],
    citedAt: () => null,
    include: { transcript: false },
  });

class PdfWorker {
  static instances: PdfWorker[] = [];
  onmessage: ((event: { data: { ok: true; blob: Blob } }) => void) | null =
    null;
  onerror = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() {
    PdfWorker.instances.push(this);
  }
  complete() {
    this.onmessage?.({ data: { ok: true, blob } });
  }
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  PdfWorker.instances = [];
});

describe("PDF 생성 결과", () => {
  it("같은 내용은 결과를 재사용하고 내용이 바뀌면 새 파일을 생성한다", async () => {
    vi.stubGlobal("Worker", PdfWorker);
    const render = createMinutesPdfRenderer();
    const first = render(document());
    PdfWorker.instances[0].complete();
    expect(await first).toBe(blob);
    expect(await render(document())).toBe(blob);
    expect(PdfWorker.instances).toHaveLength(1);
    expect(PdfWorker.instances[0].terminate).toHaveBeenCalledOnce();
    const changed = render({ ...document(), title: "수정한 회의" });
    expect(PdfWorker.instances).toHaveLength(2);
    PdfWorker.instances[1].complete();
    await changed;
  });

  it("생성 취소는 워커를 종료하고 미완성 파일을 캐시에 남기지 않는다", async () => {
    vi.stubGlobal("Worker", PdfWorker);
    const controller = new AbortController();
    const rendering = renderMinutesPdf(document(), controller.signal);
    controller.abort();
    await expect(rendering).rejects.toMatchObject({ name: "AbortError" });
    expect(PdfWorker.instances[0].terminate).toHaveBeenCalledOnce();
  });

  it("창을 여는 것만으로 생성하지 않으며 준비한 파일을 같은 옵션으로 재사용한다", async () => {
    const build = vi.fn().mockResolvedValue(artifact);
    const { result, rerender } = renderHook(
      ({ open, version, transcript }) =>
        usePdfArtifact(open, version, { transcript }, build),
      { initialProps: { open: true, version: "1", transcript: false } }
    );
    expect(build).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.prepare();
    });
    expect(result.current.artifact).toBe(artifact);
    await act(async () => {
      await result.current.prepare();
    });
    expect(build).toHaveBeenCalledTimes(1);
    rerender({ open: true, version: "2", transcript: false });
    expect(result.current.artifact).toBeNull();
    await act(async () => {
      await result.current.prepare();
    });
    expect(build).toHaveBeenCalledTimes(2);
    rerender({ open: false, version: "2", transcript: false });
    rerender({ open: true, version: "2", transcript: false });
    expect(result.current.artifact).toBeNull();
  });

  it("문서 변경 전의 늦은 완료를 버리고 새 옵션의 생성을 막지 않는다", async () => {
    let resolve!: (value: typeof artifact) => void;
    const build = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          })
      )
      .mockResolvedValue(artifact);
    const { result, rerender } = renderHook(
      ({ version }) =>
        usePdfArtifact(true, version, { transcript: false }, build),
      { initialProps: { version: "1" } }
    );
    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.prepare();
    });
    const signal = build.mock.calls[0][1] as AbortSignal;
    rerender({ version: "2" });
    expect(signal.aborted).toBe(true);
    await act(async () => {
      resolve(artifact);
      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    });
    expect(result.current.artifact).toBeNull();
    await act(async () => {
      await result.current.prepare();
    });
    expect(result.current.artifact).toBe(artifact);
  });

  it("미리보기 파일이 바뀌거나 닫히면 Blob URL을 해제한다", () => {
    const create = vi
      .fn()
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second");
    const revoke = vi.fn();
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL = create;
        static revokeObjectURL = revoke;
      }
    );
    const { rerender, unmount } = render(<PdfPreview blob={blob} />);
    expect(create).toHaveBeenCalledOnce();
    rerender(<PdfPreview blob={new Blob(["%PDF-new"])} />);
    expect(revoke).toHaveBeenCalledWith("blob:first");
    unmount();
    expect(revoke).toHaveBeenCalledWith("blob:second");
  });

  it("생성 중 판이 되돌아와도 잠기지 않고, 미리보기 없이 취소된 동작도 다시 확인하도록 알린다", async () => {
    let reject!: (error: unknown) => void;
    const build = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_, fail) => {
            reject = fail;
          })
      )
      .mockResolvedValue(artifact);
    const { result, rerender } = renderHook(
      ({ version }) =>
        usePdfArtifact(true, version, { transcript: false }, build),
      { initialProps: { version: "A" } }
    );
    expect(result.current.invalidated).toBe(false);
    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.prepare();
    });
    rerender({ version: "B" });
    rerender({ version: "A" });
    await act(async () => {
      reject(new DOMException("취소", "AbortError"));
      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    });
    expect(result.current.pending).toBe(false);
    expect(result.current.invalidated).toBe(true);
    await act(async () => {
      await result.current.prepare();
    });
    expect(result.current.artifact).toBe(artifact);
    expect(result.current.invalidated).toBe(false);
  });

  it("재생성 실패는 내용 변경 안내로 덮지 않고 닫힌 세션의 안내도 남기지 않는다", async () => {
    const build = vi
      .fn()
      .mockResolvedValueOnce(artifact)
      .mockRejectedValue(new Error("생성 실패"));
    const { result, rerender } = renderHook(
      ({ open, version }) =>
        usePdfArtifact(open, version, { transcript: false }, build),
      { initialProps: { open: true, version: "A" } }
    );
    await act(async () => {
      await result.current.prepare();
    });
    rerender({ open: true, version: "B" });
    expect(result.current.invalidated).toBe(true);
    await act(async () => {
      await expect(result.current.prepare()).rejects.toThrow("생성 실패");
    });
    expect(result.current.invalidated).toBe(false);
    rerender({ open: false, version: "B" });
    rerender({ open: true, version: "B" });
    expect(result.current.invalidated).toBe(false);
  });
});
