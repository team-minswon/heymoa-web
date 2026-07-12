export const DEFAULT_VOICE_ACTIVITY_CONFIG = {
  minimumThreshold: 0.018,
  noiseMultiplier: 2.8,
  minimumVoiceMs: 120,
  partialEveryMs: 400,
  finalSilenceMs: 900,
} as const;

export type VoiceActivityConfig = {
  minimumThreshold: number;
  noiseMultiplier: number;
  minimumVoiceMs: number;
  partialEveryMs: number;
  finalSilenceMs: number;
};

export type VoiceActivitySnapshot = {
  voicedMs: number;
  silenceMs: number;
  isVoiced: boolean;
  threshold: number;
};

export function pcm16Rms(buffer: ArrayBufferLike) {
  const samples = new Int16Array(buffer);
  if (samples.length === 0) return 0;
  let squareSum = 0;
  for (const sample of samples) squareSum += (sample / 32768) ** 2;
  return Math.sqrt(squareSum / samples.length);
}

export class VoiceActivityDetector {
  private noiseFloor = 0.004;
  private candidateVoiceMs = 0;
  private voicedMs = 0;
  private silenceMs = 0;
  private active = false;

  constructor(private readonly config: VoiceActivityConfig) {}

  push(frameDurationMs: number, rms: number): VoiceActivitySnapshot {
    const threshold = Math.max(
      this.config.minimumThreshold,
      this.noiseFloor * this.config.noiseMultiplier
    );

    if (rms >= threshold) {
      this.candidateVoiceMs += frameDurationMs;
      this.voicedMs += frameDurationMs;
      this.silenceMs = 0;
      if (this.candidateVoiceMs >= this.config.minimumVoiceMs) {
        this.active = true;
      }
    } else if (this.active) {
      this.silenceMs += frameDurationMs;
    } else {
      this.noiseFloor = Math.min(
        this.config.minimumThreshold,
        this.noiseFloor * 0.92 + rms * 0.08
      );
      this.candidateVoiceMs = 0;
      this.voicedMs = 0;
      this.silenceMs = 0;
    }

    return {
      voicedMs: this.voicedMs,
      silenceMs: this.silenceMs,
      isVoiced: this.active,
      threshold,
    };
  }

  reset() {
    this.candidateVoiceMs = 0;
    this.voicedMs = 0;
    this.silenceMs = 0;
    this.active = false;
  }
}
