import { describe, expect, it } from "vitest";
import {
  DEFAULT_VOICE_ACTIVITY_CONFIG,
  pcm16Rms,
  VoiceActivityDetector,
} from "@/lib/mocks/voice-activity";

describe("voice activity", () => {
  it("measures PCM16 silence and full-scale input", () => {
    expect(pcm16Rms(new Int16Array(960).buffer)).toBe(0);
    expect(pcm16Rms(new Int16Array(960).fill(32767).buffer)).toBeCloseTo(1, 2);
  });

  it("does not treat silence or brief noise as speech", () => {
    const detector = new VoiceActivityDetector(DEFAULT_VOICE_ACTIVITY_CONFIG);
    expect(detector.push(40, 0)).toMatchObject({
      isVoiced: false,
      voicedMs: 0,
    });
    detector.push(40, 0.4);
    expect(detector.push(40, 0)).toMatchObject({ isVoiced: false });
  });
});
