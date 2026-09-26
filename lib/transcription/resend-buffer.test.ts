import { describe, expect, it } from "vitest";

import { ResendBuffer } from "@/lib/transcription/resend-buffer";

function chunk(chunkSeq: number, bytes = 3_200) {
  return {
    chunkSeq,
    captureSamples: chunkSeq * 1_600,
    body: new ArrayBuffer(bytes),
  };
}

function buffer({ memory = 10_485_760 } = {}) {
  const created = new ResendBuffer({ limitBytes: memory });
  created.rewind();
  return created;
}

/** 소켓이 다 받아 준다고 치고 보낼 순서대로 꺼낸다. */
function drain(target: ResendBuffer) {
  const seqs: number[] = [];
  for (let next = target.next(); next; next = target.next()) {
    seqs.push(next.chunkSeq);
    target.markSent();
  }
  return seqs;
}

describe("ResendBuffer", () => {
  it("ACK 이하를 버린다", () => {
    const target = buffer();
    [0, 1, 2, 3].forEach((n) => target.push(chunk(n)));

    target.ackThrough(1);
    target.rewind();

    expect(drain(target)).toEqual([2, 3]);
    expect(target.bytes).toBe(6_400);
  });

  it("재전송은 원래 번호와 캡처 위치를 그대로 쓴다", () => {
    const target = buffer();
    target.push(chunk(7));
    drain(target);

    target.rewind();

    expect(target.next()).toMatchObject({
      chunkSeq: 7,
      captureSamples: 11_200,
    });
  });

  it("늦게 온 옛 ACK 가 버퍼를 되살리지 않는다", () => {
    const target = buffer();
    [0, 1, 2].forEach((n) => target.push(chunk(n)));

    target.ackThrough(2);
    target.ackThrough(0);

    expect(target.bytes).toBe(0);
    expect(target.next()).toBeNull();
  });

  it("버퍼가 빈 상태에서 ACK 를 받아도 터지지 않는다", () => {
    const target = buffer();

    expect(() => target.ackThrough(42)).not.toThrow();
    expect(target.bytes).toBe(0);
  });

  it("ACK 가 건넨 것 일부를 지워도 남은 것의 건넴 여부가 어긋나지 않는다", () => {
    const target = buffer();
    [0, 1, 2].forEach((n) => target.push(chunk(n)));
    target.next();
    target.markSent();
    target.next();
    target.markSent();

    target.ackThrough(0);

    // 1(건넴)·2(안 건넴)가 남는다
    expect(target.bytes).toBe(6_400);
    expect(target.unsentBytes).toBe(3_200);
    expect(drain(target)).toEqual([2]);
  });

  it("rewind 하면 ACK 못 받은 것 전부가 밀린 것이 되어 다시 나간다", () => {
    const target = buffer();
    [0, 1, 2].forEach((n) => target.push(chunk(n)));
    drain(target);

    target.rewind();

    expect(drain(target)).toEqual([0, 1, 2]);
  });

  it("rewind 하면 가장 새 3초와 그 뒤에 들어온 것이 먼저, 그 앞은 밀린 것으로 뒤에 나간다", () => {
    const target = buffer();
    for (let n = 0; n < 40; n += 1) target.push(chunk(n)); // 4초

    expect(target.rewind()).toEqual({ lateChunks: 10, liveLagMs: 3_000 });
    target.push(chunk(40));

    expect(drain(target)).toEqual([
      ...Array.from({ length: 31 }, (_, i) => 10 + i),
      ...Array.from({ length: 10 }, (_, i) => i),
    ]);
  });

  it("catchUp 은 보낸 것을 건드리지 않고 안 보낸 실시간 중 3초보다 오래된 것만 넘긴다", () => {
    const target = buffer();
    for (let n = 0; n < 5; n += 1) target.push(chunk(n));
    drain(target); // 0..4 는 나갔다
    for (let n = 5; n < 65; n += 1) target.push(chunk(n));

    expect(target.catchUp()).toEqual({ lateChunks: 30, liveLagMs: 3_000 });
    expect(target.catchUp()).toEqual({ lateChunks: 0, liveLagMs: 3_000 });

    expect(drain(target)).toEqual([
      ...Array.from({ length: 30 }, (_, i) => 35 + i),
      ...Array.from({ length: 30 }, (_, i) => 5 + i),
    ]);
    expect(target.unsentBytes).toBe(0);
  });

  it("한도에서는 버리지 않고 거절하며, 90% 아래로 빠져야 다시 받는다", () => {
    const target = buffer({ memory: 32_000 });
    for (let n = 0; n < 10; n += 1) expect(target.push(chunk(n))).toBe(true);

    expect(target.push(chunk(10))).toBe(false);
    expect(target.paused).toBe(true);
    target.ackThrough(0);
    expect(target.push(chunk(10))).toBe(false);
    target.ackThrough(1);
    expect(target.push(chunk(10))).toBe(true);
    expect(target.paused).toBe(false);

    target.rewind();
    expect(drain(target)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
