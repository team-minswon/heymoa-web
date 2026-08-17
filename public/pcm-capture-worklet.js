class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.pending = [];
    this.pendingLength = 0;
    // 배치(100ms)의 약수여야 한다. 안 나눠떨어지면 배치 하나가 두 프레임에 걸쳐
    // 시작 위치가 모호해지고, 실제로 지금까지 40ms 였어서 프레임 간격이 100/120으로 흔들렸다.
    const frameMs = options?.processorOptions?.frameMs ?? 20;
    this.frameLength = Math.round((sampleRate * frameMs) / 1000);
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel?.length) return true;

    // currentFrame 은 AudioContext 가 사는 동안 단조 증가하고, process 를 못 불린 만큼
    // 값이 뛴다. 그 점프가 곧 캡처 공백이다 — 배처가 세면 못 받은 구간이 없었던 일이 된다.
    let frameStart = currentFrame - this.pendingLength;

    this.pending.push(channel.slice());
    this.pendingLength += channel.length;

    while (this.pendingLength >= this.frameLength) {
      const frame = new Float32Array(this.frameLength);
      let offset = 0;
      while (offset < frame.length) {
        const head = this.pending[0];
        const take = Math.min(head.length, frame.length - offset);
        frame.set(head.subarray(0, take), offset);
        offset += take;
        if (take === head.length) this.pending.shift();
        else this.pending[0] = head.slice(take);
        this.pendingLength -= take;
      }
      this.port.postMessage(
        { samples: frame.buffer, captureSamples: frameStart },
        [frame.buffer]
      );
      frameStart += this.frameLength;
    }

    return true;
  }
}

registerProcessor("pcm-capture-processor", PcmCaptureProcessor);
