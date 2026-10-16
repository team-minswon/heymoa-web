import { afterEach, describe, expect, it, vi } from "vitest";
import { acquireLocalInputs } from "./local-inputs";
function stream(audio = true, video = false) {
  let audioStopped!: () => void, videoStopped!: () => void;
  const audioStop = new Promise<void>((resolve) => {
    audioStopped = resolve;
  });
  const videoStop = new Promise<void>((resolve) => {
    videoStopped = resolve;
  });
  const a = {
      stop: vi.fn(() => audioStopped()),
      readyState: "live",
      muted: false,
    },
    v = { stop: vi.fn(() => videoStopped()) };
  const tracks = [...(audio ? [a] : []), ...(video ? [v] : [])];
  return {
    a,
    v,
    audioStop,
    videoStop,
    value: {
      getAudioTracks: () => (audio ? [a] : []),
      getVideoTracks: () => (video ? [v] : []),
      getTracks: () => tracks,
      removeTrack: vi.fn((track) => tracks.splice(tracks.indexOf(track), 1)),
    } as unknown as MediaStream,
  };
}
describe("신뢰된 로컬 renderer 입력 확보", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("오류 없이 종료된 시스템 오디오가 반환되면 시작하지 않고 늦은 마이크도 닫는다", async () => {
    const display = stream(true, true),
      mic = stream();
    display.a.readyState = "ended";
    let resolve!: (value: MediaStream) => void;
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getDisplayMedia: async () => display.value,
        getUserMedia: () =>
          new Promise<MediaStream>((done) => {
            resolve = done;
          }),
      },
    });
    await expect(
      acquireLocalInputs(new AbortController().signal)
    ).rejects.toThrow("SYSTEM_AUDIO_INPUT_MISSING");
    resolve(mic.value);
    await mic.audioStop;
    expect(display.a.stop).toHaveBeenCalled();
    expect(display.v.stop).toHaveBeenCalled();
  });
  it("마이크 권한을 기다리는 동안 시스템 입력이 종료돼도 시작하지 않는다", async () => {
    const display = stream(true, true),
      mic = stream();
    let resolve!: (value: MediaStream) => void;
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getDisplayMedia: async () => display.value,
        getUserMedia: () =>
          new Promise<MediaStream>((done) => {
            resolve = done;
          }),
      },
    });
    const pending = acquireLocalInputs(new AbortController().signal);
    await display.videoStop;
    display.a.readyState = "ended";
    resolve(mic.value);
    await expect(pending).rejects.toThrow("SYSTEM_AUDIO_INPUT_MISSING");
    expect(mic.a.stop).toHaveBeenCalled();
  });
  it("음소거된 live 입력은 거절하지 않는다", async () => {
    const display = stream(true, true),
      mic = stream();
    display.a.muted = true;
    mic.a.muted = true;
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getDisplayMedia: async () => display.value,
        getUserMedia: async () => mic.value,
      },
    });
    const inputs = await acquireLocalInputs(new AbortController().signal);
    expect(inputs.systemAudio).toBe(display.value);
    await inputs.release?.();
  });
  it("마이크 권한을 기다리기 전에 display를 요청하고 임시 video는 즉시 닫는다", async () => {
    const display = stream(true, true),
      mic = stream();
    let resolve!: (stream: MediaStream) => void;
    const devices = {
      getDisplayMedia: vi.fn(async () => display.value),
      getUserMedia: vi.fn(
        () => new Promise<MediaStream>((done) => (resolve = done))
      ),
    };
    vi.stubGlobal("navigator", { mediaDevices: devices });
    const acquisition = acquireLocalInputs(new AbortController().signal);
    expect(devices.getDisplayMedia).toHaveBeenCalledOnce();
    await display.videoStop;
    expect(display.v.stop).toHaveBeenCalledOnce();
    resolve(mic.value);
    const inputs = await acquisition;
    expect(inputs.systemAudio).toBe(display.value);
    await inputs.release?.();
    expect(display.a.stop).toHaveBeenCalledOnce();
    expect(mic.a.stop).toHaveBeenCalledOnce();
  });
  it("취소는 열린 시스템 입력을 즉시 닫고 늦게 도착한 마이크도 닫는다", async () => {
    const display = stream(true, true),
      mic = stream();
    let resolve!: (stream: MediaStream) => void;
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getDisplayMedia: async () => display.value,
        getUserMedia: () =>
          new Promise<MediaStream>((done) => (resolve = done)),
      },
    });
    const abort = new AbortController(),
      acquisition = acquireLocalInputs(abort.signal);
    await display.videoStop;
    abort.abort();
    await expect(acquisition).rejects.toThrow("AUDIO_CAPTURE_CANCELLED");
    expect(display.a.stop).toHaveBeenCalled();
    resolve(mic.value);
    await mic.audioStop;
    expect(mic.a.stop).toHaveBeenCalledOnce();
  });
  it("시스템 audio 부재는 시작 실패이며 늦은 마이크를 해제한다", async () => {
    const display = stream(false, true),
      mic = stream();
    let resolve!: (stream: MediaStream) => void;
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getDisplayMedia: async () => display.value,
        getUserMedia: () =>
          new Promise<MediaStream>((done) => (resolve = done)),
      },
    });
    const acquisition = acquireLocalInputs(new AbortController().signal);
    await expect(acquisition).rejects.toThrow("SYSTEM_AUDIO_INPUT_MISSING");
    resolve(mic.value);
    await mic.audioStop;
    expect(mic.a.stop).toHaveBeenCalledOnce();
    expect(display.v.stop).toHaveBeenCalledOnce();
  });
  it("마이크 거부 후 늦게 도착한 display의 audio/video를 모두 닫는다", async () => {
    const display = stream(true, true);
    let resolve!: (stream: MediaStream) => void;
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getDisplayMedia: () =>
          new Promise<MediaStream>((done) => (resolve = done)),
        getUserMedia: async () => {
          throw new Error("NotAllowedError");
        },
      },
    });
    await expect(
      acquireLocalInputs(new AbortController().signal)
    ).rejects.toThrow("NotAllowedError");
    resolve(display.value);
    await display.audioStop;
    expect(display.a.stop).toHaveBeenCalledOnce();
    expect(display.v.stop).toHaveBeenCalledOnce();
  });
});
