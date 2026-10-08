import { describe, expect, it, vi } from "vitest";
import {
  createDesktopAudioCapture,
  type DesktopCaptureBridge,
  type DesktopCapturePacket,
} from "./capture";
function fixture() {
  let listener: ((packet: DesktopCapturePacket) => void) | null = null;
  const unsubscribe = vi.fn(() => {
    listener = null;
  });
  const bridge: DesktopCaptureBridge = {
    getCapabilities: vi.fn(),
    beginCapture: vi.fn(async () => "session"),
    captureReady: vi.fn(async () => undefined),
    endCapture: vi.fn(async () => undefined),
    subscribeCapture: vi.fn((callback) => {
      listener = callback;
      return unsubscribe;
    }),
  };
  return {
    bridge,
    unsubscribe,
    emit: (packet: DesktopCapturePacket) => listener?.(packet),
  };
}
describe("로컬 캡처의 원격 PCM AudioPort", () => {
  it("생성만으로 권한을 요청하지 않고 중복 시작은 동일 promise를 공유한다", async () => {
    const f = fixture(),
      port = createDesktopAudioCapture({ onChunk: vi.fn() }, f.bridge);
    expect(f.bridge.beginCapture).not.toHaveBeenCalled();
    const starting = port.start();
    expect(port.start()).toBe(starting);
    await starting;
    expect(f.bridge.beginCapture).toHaveBeenCalledOnce();
    expect(f.bridge.captureReady).toHaveBeenCalledWith("session");
    await port.stop();
  });
  it("PCM과 독립 입력 상태만 전달하며 이전 세대 packet은 버린다", async () => {
    const f = fixture(),
      onChunk = vi.fn(),
      onInputStates = vi.fn();
    const port = createDesktopAudioCapture(
      { onChunk, onInputStates },
      f.bridge
    );
    await port.start();
    const packet = {
      kind: "pcm",
      id: "session",
      sequence: 0,
      captureSamples: 128,
      samples: new ArrayBuffer(3200),
    } as const;
    f.emit({ ...packet, id: "old" });
    expect(onChunk).not.toHaveBeenCalled();
    f.emit(packet);
    expect(onChunk).toHaveBeenCalledWith(packet.samples, 128);
    f.emit({
      kind: "states",
      id: "session",
      microphone: "live",
      systemAudio: "ended",
    });
    expect(onInputStates).toHaveBeenLastCalledWith({
      microphone: "live",
      systemAudio: "ended",
    });
    await port.stop();
    expect(f.unsubscribe).toHaveBeenCalledOnce();
  });
  it("권한 창 대기 중 stop은 로컬 캡처를 즉시 취소하고 늦은 id도 닫는다", async () => {
    const f = fixture();
    let resolve!: (id: string) => void;
    f.bridge.beginCapture = vi.fn(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        })
    );
    const port = createDesktopAudioCapture({ onChunk: vi.fn() }, f.bridge);
    const acquiring = port.requestPermission();
    await port.stop();
    expect(f.bridge.endCapture).toHaveBeenCalledWith(undefined);
    resolve("late");
    await expect(acquiring).rejects.toThrow("AUDIO_CAPTURE_CANCELLED");
    expect(f.bridge.endCapture).toHaveBeenLastCalledWith("late");
    expect(f.bridge.captureReady).not.toHaveBeenCalled();
  });
  it("stop은 마지막 부분 PCM을 drain한 뒤 listener를 해제하고 중복 stop을 공유한다", async () => {
    const f = fixture(),
      onChunk = vi.fn();
    let end!: () => void;
    const port = createDesktopAudioCapture({ onChunk }, f.bridge);
    await port.start();
    f.bridge.endCapture = vi.fn(
      () =>
        new Promise<void>((done) => {
          end = done;
        })
    );
    const stopping = port.stop();
    expect(port.stop()).toBe(stopping);
    f.emit({
      kind: "pcm",
      id: "session",
      sequence: 1,
      captureSamples: 1600,
      samples: new ArrayBuffer(128),
    });
    expect(onChunk).toHaveBeenCalledOnce();
    expect(f.unsubscribe).not.toHaveBeenCalled();
    end();
    await stopping;
    expect(f.unsubscribe).toHaveBeenCalledOnce();
  });
  it("구버전 앱에서 캡처 계약이 없으면 명시적으로 거부한다", () => {
    const f = fixture();
    expect(() =>
      createDesktopAudioCapture({ onChunk: vi.fn() }, {
        ...f.bridge,
        subscribeCapture: undefined,
      } as unknown as DesktopCaptureBridge)
    ).toThrow("DESKTOP_CAPTURE_UPDATE_REQUIRED");
  });
  it("마지막 PCM drain 실패를 성공으로 삼키지 않고 listener를 정리한다", async () => {
    const f = fixture(),
      onCaptureError = vi.fn(),
      onChunk = vi.fn();
    const port = createDesktopAudioCapture(
      { onChunk, onCaptureError },
      f.bridge
    );
    await port.start();
    // Electron wraps a rejected ipcMain.handle error in its own message.
    f.bridge.endCapture = vi.fn(async () => {
      throw new Error(
        "Error invoking remote method 'heymoa:capture-end': Error: DESKTOP_AUDIO_BACKPRESSURE"
      );
    });
    await expect(port.stop()).rejects.toThrow("DESKTOP_AUDIO_BACKPRESSURE");
    expect(onCaptureError).toHaveBeenCalledWith("DESKTOP_AUDIO_BACKPRESSURE");
    expect(f.unsubscribe).toHaveBeenCalledOnce();
    f.emit({
      kind: "pcm",
      id: "session",
      sequence: 0,
      captureSamples: 0,
      samples: new ArrayBuffer(3200),
    });
    expect(onChunk).not.toHaveBeenCalled();
  });
});
