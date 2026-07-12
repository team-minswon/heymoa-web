class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pending = [];
    this.pendingLength = 0;
    this.frameLength = Math.round(sampleRate * 0.04);
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel?.length) return true;

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
      this.port.postMessage(frame.buffer, [frame.buffer]);
    }

    return true;
  }
}

registerProcessor("pcm-capture-processor", PcmCaptureProcessor);
