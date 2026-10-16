import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewActions } from "@/components/notes/review/review-actions";

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/track", () => ({ track }));

const toastInfo = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ui/toast", () => ({
  toast: { success: vi.fn(), error: toastError, info: toastInfo, dismiss: vi.fn() },
}));

const pdf = vi.hoisted(() => ({ render: vi.fn(), download: vi.fn() }));
vi.mock("@/components/notes/minutes/render-minutes-pdf", () => ({
  renderMinutesPdf: pdf.render,
  downloadBlob: pdf.download,
}));

const MARKDOWN = "# 회의\n\n## 결정\n\n- **요금**은 회의 시간 기준\n";

describe("ReviewActions", () => {
  const writeText = vi.fn();

  afterEach(cleanup);

  beforeEach(() => {
    track.mockReset();
    toastInfo.mockReset();
    toastError.mockReset();
    pdf.render.mockReset();
    pdf.download.mockReset();
    writeText.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
  });

  it("마크다운으로 복사하면 누른 순간 만든 문서를 그대로 넣고 형식만 이벤트에 싣는다", async () => {
    const build = vi.fn(() => MARKDOWN);
    render(<ReviewActions build={build} />);
    expect(build).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "요약 복사" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /마크다운/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(MARKDOWN));
    expect(track).toHaveBeenCalledWith("summary_copied", { format: "markdown", scope: "summary" });
  });

  it("텍스트로 복사하면 마크다운 기호를 걷어 낸다", async () => {
    render(<ReviewActions build={() => MARKDOWN} />);

    fireEvent.click(screen.getByRole("button", { name: "요약 복사" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /텍스트로 복사/ }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("회의\n\n결정\n\n• 요금은 회의 시간 기준\n")
    );
    expect(track).toHaveBeenCalledWith("summary_copied", { format: "text", scope: "summary" });
  });

  it("복사할 문서가 없으면 복사 버튼을 막는다", () => {
    render(<ReviewActions build={() => ""} disabled />);
    expect(screen.getByRole("button", { name: "요약 복사" })).toBeDisabled();
  });

  it("공유하기 메뉴에는 연결된 대상만 선다 — 「준비 중」 대상은 없다", async () => {
    render(<ReviewActions build={() => MARKDOWN} />);

    fireEvent.click(screen.getByRole("button", { name: "내보내기·공유" }));
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((row) => row.textContent)).toEqual([expect.stringContaining("PDF로 내보내기")]);
    expect(screen.queryByText(/준비 중/)).toBeNull();
    // 회의록 재료가 아직 없으면 받는 중으로 막는다
    expect(items[0]).toHaveAttribute("data-disabled");
  });

  const wider = (minutes = vi.fn(async () => ({ fileName: "회의록_회의_20261015.pdf" }) as never)) => ({ minutes });

  it("요약 탭 복사 메뉴는 요약만 복사한다 — 타임라인 · 전체 복사는 없다(저마다 제 탭에 있다)", async () => {
    render(<ReviewActions build={() => MARKDOWN} wider={wider()} />);
    fireEvent.click(screen.getByRole("button", { name: "요약 복사" }));
    expect(await screen.findAllByRole("menuitem")).toHaveLength(2);
    expect(screen.queryByText("타임라인 복사")).toBeNull();
    expect(screen.queryByText("전체 복사")).toBeNull();
  });

  it("PDF로 내보내기는 녹취록을 붙일지 고르는 창을 열고 — 꺼진 채 — 회의록을 만들어 내려받는다", async () => {
    const minutes = vi.fn(async () => ({ fileName: "회의록_회의_20261015.pdf" }) as never);
    const blob = new Blob(["%PDF-"]);
    pdf.render.mockResolvedValue(blob);
    render(<ReviewActions build={() => MARKDOWN} wider={wider(minutes)} />);

    fireEvent.click(screen.getByRole("button", { name: "내보내기·공유" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /PDF/ }));
    expect(track).toHaveBeenCalledWith("export_requested", { target: "pdf" });
    expect(toastInfo).not.toHaveBeenCalled();

    expect(await screen.findByRole("switch", { name: "녹취록" })).not.toBeChecked();
    expect(screen.queryByRole("switch", { name: "안건별 경과" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "PDF 받기" }));

    await waitFor(() => expect(pdf.download).toHaveBeenCalledWith(blob, "회의록_회의_20261015.pdf"));
    expect(minutes).toHaveBeenCalledWith({ transcript: false });
    expect(track).toHaveBeenCalledWith("summary_exported", { target: "pdf", transcript: false });
  });

  it("녹취록을 켜고 닫았다 다시 열면 녹취록은 다시 꺼져 있다 — 지난 선택이 말없이 실리지 않는다", async () => {
    render(<ReviewActions build={() => MARKDOWN} wider={wider()} />);
    const openDialog = async () => {
      fireEvent.click(screen.getByRole("button", { name: "내보내기·공유" }));
      fireEvent.click(await screen.findByRole("menuitem", { name: /PDF/ }));
      return screen.findByRole("switch", { name: "녹취록" });
    };

    fireEvent.click(await openDialog());
    expect(screen.getByRole("switch", { name: "녹취록" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "PDF 받기" })).toBeNull());

    expect(await openDialog()).not.toBeChecked();
  });

  it("녹취록을 받는 중이면 PDF 를 막고, 못 받았으면 「준비 중」이 아니라 메뉴에서 다시 불러온다", async () => {
    const retry = vi.fn();
    const { rerender } = render(<ReviewActions build={() => MARKDOWN} material="loading" onRetryMaterial={retry} />);
    fireEvent.click(screen.getByRole("button", { name: "내보내기·공유" }));
    const loading = await screen.findByRole("menuitem", { name: /PDF/ });
    expect(loading.textContent).toContain("불러오는 중");
    expect(loading).toHaveAttribute("data-disabled");

    rerender(<ReviewActions build={() => MARKDOWN} material="failed" onRetryMaterial={retry} />);
    const failed = await screen.findByRole("menuitem", { name: /PDF/ });
    expect(failed.textContent).toContain("다시 불러오기");
    fireEvent.click(failed);
    expect(retry).toHaveBeenCalled();
    expect(toastInfo).not.toHaveBeenCalledWith(expect.stringContaining("준비 중"), expect.anything());
  });

  it("PDF를 만들지 못하면 토스트로 알리고 창을 둔다", async () => {
    pdf.render.mockRejectedValue(new Error("font"));
    render(<ReviewActions build={() => MARKDOWN} wider={wider()} />);

    fireEvent.click(screen.getByRole("button", { name: "내보내기·공유" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /PDF/ }));
    fireEvent.click(await screen.findByRole("button", { name: "PDF 받기" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("회의록 PDF를 만들지 못했습니다.", expect.anything()));
    expect(pdf.download).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "PDF 받기" })).toBeInTheDocument();
  });

  it("메일 보내기가 연결되면 「준비 중」 대신 창을 연다", async () => {
    const onSendEmail = vi.fn();
    render(<ReviewActions build={() => MARKDOWN} wider={wider()} onSendEmail={onSendEmail} />);

    fireEvent.click(screen.getByRole("button", { name: "내보내기·공유" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "이메일로 보내기" }));

    expect(onSendEmail).toHaveBeenCalled();
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it("메일도 PDF 와 같은 회의록을 붙여 녹취록이 와야 연다 — 받는 중이면 막는다", async () => {
    const onSendEmail = vi.fn();
    render(<ReviewActions build={() => MARKDOWN} material="loading" onSendEmail={onSendEmail} />);

    fireEvent.click(screen.getByRole("button", { name: "내보내기·공유" }));
    const item = await screen.findByRole("menuitem", { name: /이메일로 보내기/ });
    expect(item.textContent).toContain("불러오는 중");
    expect(item).toHaveAttribute("data-disabled");
  });
});
