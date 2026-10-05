import type { AudioInputs } from "@/lib/transcription/audio";

export async function acquireLocalInputs(
  signal: AbortSignal
): Promise<AudioInputs> {
  if (signal.aborted) throw new Error("AUDIO_CAPTURE_CANCELLED");
  const streams: MediaStream[] = [];
  let cancelled = false;
  const release = () => {
    cancelled = true;
    for (const stream of streams)
      for (const track of stream.getTracks()) track.stop();
  };
  const retain = (stream: MediaStream) => {
    if (cancelled || signal.aborted) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error("AUDIO_CAPTURE_CANCELLED");
    }
    streams.push(stream);
    return stream;
  };
  let abort!: () => void;
  const aborted = new Promise<never>((_resolve, reject) => {
    abort = () => {
      release();
      reject(new Error("AUDIO_CAPTURE_CANCELLED"));
    };
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    const display = navigator.mediaDevices
      .getDisplayMedia({
        audio: true,
        video: { width: 1, height: 1, frameRate: 1 },
      })
      .then((stream) => {
        retain(stream);
        if (!stream.getAudioTracks().length)
          throw new Error("SYSTEM_AUDIO_INPUT_MISSING");
        for (const track of stream.getVideoTracks()) {
          track.stop();
          stream.removeTrack(track);
        }
        return stream;
      });
    const microphone = navigator.mediaDevices
      .getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      .then(retain);
    const [systemAudio, mic] = await Promise.race([
      Promise.all([display, microphone]),
      aborted,
    ]);
    if (!mic.getAudioTracks().length)
      throw new Error("MICROPHONE_INPUT_MISSING");
    if (signal.aborted) throw new Error("AUDIO_CAPTURE_CANCELLED");
    return {
      microphone: mic,
      systemAudio,
      release: () => {
        signal.removeEventListener("abort", abort);
        release();
      },
    };
  } catch (error) {
    release();
    signal.removeEventListener("abort", abort);
    throw error;
  }
}
