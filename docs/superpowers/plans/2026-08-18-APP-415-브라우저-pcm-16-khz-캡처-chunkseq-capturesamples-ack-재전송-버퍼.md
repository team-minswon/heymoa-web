# APP-415 브라우저 PCM 16 kHz 캡처 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 브라우저가 16 kHz PCM을 `chunkSeq`·`captureSamples`와 함께 보내고, ACK 안 온 조각을 들고 있다가 재연결하면 다시 보낸다.

**Architecture:** 값을 `capture-config.ts` 한 곳에 모으고 계약과 튜닝을 가른다. 워크릿이 `currentFrame`으로 `captureSamples`를 만들어 배처를 거쳐 소켓까지 그대로 흐른다. ACK 재전송 버퍼는 소켓 바깥의 순수 클래스라 목 없이 테스트된다.

**Tech Stack:** Next.js 16 · `@stomp/stompjs` · AudioWorklet · zod · vitest · MSW

**Spec:** [`heymoa/docs` `projects/PRO-31-실시간-전사/spec/APP-415/spec.md`](https://github.com/team-minswon/docs/blob/main/projects/PRO-31-%EC%8B%A4%EC%8B%9C%EA%B0%84-%EC%A0%84%EC%82%AC/spec/APP-415/spec.md)

## Global Constraints

- **샘플레이트 `16000`** · **채널 `1`** · **인코딩 `pcm_s16le`** — 서버와 합의한 계약. 못 바꾼다
- **프레임 최대 32,000 byte** (1초분). 지금 코드의 1 MiB는 계약 위반이다
- **프레임 최소 2 byte** · **짝수 바이트만** — 홀수는 잘린 샘플이라 오류
- **`chunkSeq`는 세션 안에서 0부터 1씩** — 연속성이 유실 판정의 유일한 근거
- 워크릿 프레임 **20 ms**, 배치 **100 ms** — 배치가 워크릿의 **정수배**여야 한다
- 재전송 버퍼 상한 **10 MB**, 정체 판정 **10초**, 백프레셔 임계 **96 KB**(그대로)
- 게이트 5종을 전부 통과해야 머지한다: `pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e`

---

## File Structure

| 파일 | 책임 |
|---|---|
| `lib/transcription/capture-config.ts` (신규) | 계약값과 튜닝값. **여기만 고치면 나머지가 따라온다** |
| `public/pcm-capture-worklet.js` (수정) | 20 ms 프레임 + `currentFrame` 기반 `captureSamples` |
| `lib/transcription/audio.ts` (수정) | 16 kHz `AudioContext` · `linearResample` 삭제 · 배처가 `captureSamples`를 나른다 |
| `lib/transcription/resend-buffer.ts` (신규) | ACK 안 온 조각 보관·절삭·재전송·상한 폐기 |
| `lib/transcription/protocol.ts` (수정) | `ack`·`capture_state` 이벤트 · `commit` 제거 · `final` 개정 |
| `lib/transcription/socket.ts` (수정) | 헤더 둘 · `stop {finalChunkSeq}` · `commit` 제거 |
| `lib/transcription/realtime-session.ts` (수정) | 버퍼 배선 · `chunkSeq` 발급 |
| `lib/mocks/websocket-handler.ts` (수정) | `ack`·`capture_state` 발행 · 헤더 검증 |

---

### Task 1: 캡처 설정값을 한 파일로 모은다

**Files:**
- Create: `lib/transcription/capture-config.ts`
- Test: `lib/transcription/capture-config.test.ts`

**Interfaces:**
- Produces: `CAPTURE_CONTRACT` (`sampleRate` · `channelCount` · `minFrameBytes` · `maxFrameBytes` · `bytesPerSample`), `CAPTURE_TUNING` (`workletFrameMs` · `batchMs` · `resendBufferMaxBytes` · `congestionMs` · `backpressureBytes`), `samplesPerBatch()`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import { describe, expect, it } from "vitest";
import { CAPTURE_CONTRACT, CAPTURE_TUNING, samplesPerBatch } from "@/lib/transcription/capture-config";

describe("capture-config", () => {
  it("배치가 워크릿 프레임의 정수배다", () => {
    expect(CAPTURE_TUNING.batchMs % CAPTURE_TUNING.workletFrameMs).toBe(0);
  });

  it("한 배치가 계약의 프레임 상한을 안 넘는다", () => {
    const bytes = samplesPerBatch() * CAPTURE_CONTRACT.bytesPerSample;
    expect(bytes).toBeLessThanOrEqual(CAPTURE_CONTRACT.maxFrameBytes);
    expect(bytes).toBe(3_200);
  });
});
```

- [ ] **Step 2: 실패를 확인한다** — `pnpm vitest run lib/transcription/capture-config.test.ts` → 모듈 없음

- [ ] **Step 3: 구현한다**

```ts
/** 서버와 합의한 값. 바꾸려면 asyncapi 계약과 서버를 같이 고쳐야 한다. */
export const CAPTURE_CONTRACT = {
  sampleRate: 16_000,
  channelCount: 1,
  bytesPerSample: 2,
  minFrameBytes: 2,
  maxFrameBytes: 32_000,
} as const;

/** 브라우저 안에서만 뜻이 있는 값. 실측으로 언제든 바꾼다. */
export const CAPTURE_TUNING = {
  workletFrameMs: 20,
  batchMs: 100,
  resendBufferMaxBytes: 10_485_760,
  congestionMs: 10_000,
  backpressureBytes: 96_000,
} as const;

export function samplesPerBatch(sampleRate = CAPTURE_CONTRACT.sampleRate) {
  return Math.round((sampleRate * CAPTURE_TUNING.batchMs) / 1000);
}
```

- [ ] **Step 4: 통과를 확인한다**
- [ ] **Step 5: 커밋** — `[APP-415] 캡처 설정값을 계약과 튜닝으로 갈라 한 파일에 모읍니다`

---

### Task 2: 워크릿이 `captureSamples`를 만든다

**Files:**
- Modify: `public/pcm-capture-worklet.js`
- Modify: `lib/transcription/audio.ts` (`worklet.port.onmessage`)

**Interfaces:**
- Produces: 워크릿 메시지가 `{ samples: ArrayBuffer, captureSamples: number }`

**왜 워크릿인가** — 배처가 세면 못 받은 구간이 없었던 일이 된다. `currentFrame`은
AudioContext가 사는 동안 단조 증가하고, `process`를 못 불린 만큼 값이 뛴다.

- [ ] **Step 1: 워크릿을 고친다**

```js
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.pending = [];
    this.pendingLength = 0;
    // 배치의 약수여야 한다. 안 나눠떨어지면 배치의 captureSamples 를 첫 프레임 값으로 못 쓴다.
    const frameMs = options?.processorOptions?.frameMs ?? 20;
    this.frameLength = Math.round((sampleRate * frameMs) / 1000);
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel?.length) return true;

    // 이 블록의 첫 샘플이 캡처 축 어디인가. pending 에 남은 만큼 뒤로 물러난다.
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
```

- [ ] **Step 2: `audio.ts`의 수신부를 맞춘다** (Task 3에서 함께)
- [ ] **Step 3: 커밋** — `[APP-415] 워크릿이 20ms 프레임마다 캡처 위치를 함께 보냅니다`

---

### Task 3: 16 kHz로 열고 리샘플러를 지운다

**Files:**
- Modify: `lib/transcription/audio.ts`
- Modify: `lib/transcription/audio.test.ts`

**Interfaces:**
- Consumes: `CAPTURE_CONTRACT` · `CAPTURE_TUNING` (Task 1), 워크릿 메시지 (Task 2)
- Produces: `PcmChunkBatcher(sampleRate, batchMs, emit: (chunk: ArrayBuffer, captureSamples: number) => void)`,
  `PcmAudioCapture.sampleRate: number` (실제로 열린 값)

**왜 리샘플러를 지우나** — 지금 `linearResample`은 안티에일리어싱이 없어 나이퀴스트 위
성분이 접혀 들어온다. `new AudioContext({ sampleRate: 16000 })`이면 브라우저 리샘플러가 한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
it("배처가 배치마다 캡처 위치를 함께 낸다", () => {
  const emitted: Array<{ bytes: number; captureSamples: number }> = [];
  const batcher = new PcmChunkBatcher(16_000, 100, (chunk, captureSamples) =>
    emitted.push({ bytes: chunk.byteLength, captureSamples })
  );
  batcher.push(new Int16Array(1_600), 0);
  batcher.push(new Int16Array(1_600), 1_600);
  expect(emitted).toEqual([
    { bytes: 3_200, captureSamples: 0 },
    { bytes: 3_200, captureSamples: 1_600 },
  ]);
});

it("캡처가 점프해도 chunk 는 이어지고 위치만 뛴다", () => {
  const emitted: number[] = [];
  const batcher = new PcmChunkBatcher(16_000, 100, (_c, s) => emitted.push(s));
  batcher.push(new Int16Array(1_600), 0);
  batcher.push(new Int16Array(1_600), 321_600); // 20초 뒤
  expect(emitted).toEqual([0, 321_600]);
});
```

- [ ] **Step 2: 실패 확인** — `pnpm vitest run lib/transcription/audio.test.ts`

- [ ] **Step 3: 구현**

`PcmChunkBatcher`가 `pendingCaptureSamples`를 든다. `push(samples, captureSamples)`는
pending이 비어 있으면 그 값을 시작 위치로 잡고, 배치를 낼 때마다 `targetSamples`씩 더한다.
**pending이 있는데 위치가 안 이어지면 pending을 버리고 새 위치로 시작한다** — 점프를
가로질러 이어 붙이면 배치 하나가 공백을 품는다.

`PcmAudioCapture`:
- `new AudioContext({ sampleRate: CAPTURE_CONTRACT.sampleRate })`
- `linearResample` 호출 삭제 (함수 자체도 삭제 — 쓰는 곳이 없다)
- `audioWorklet.addModule` 뒤 `new AudioWorkletNode(ctx, "pcm-capture-processor", { processorOptions: { frameMs: CAPTURE_TUNING.workletFrameMs } })`
- `getUserMedia`에 `autoGainControl: true` 추가
- `get sampleRate()`로 실제 값 노출
- `MAX_PCM_FRAME_BYTES`를 `CAPTURE_CONTRACT.maxFrameBytes`로

- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `[APP-415] 16 kHz 로 열고 안티에일리어싱 없는 리샘플러를 걷어냅니다`

---

### Task 4: ACK 재전송 버퍼

**Files:**
- Create: `lib/transcription/resend-buffer.ts`
- Test: `lib/transcription/resend-buffer.test.ts`

**Interfaces:**
- Produces: `class ResendBuffer { push(chunk: PendingChunk): void; ackThrough(chunkSeq: number): void; pending(): PendingChunk[]; get droppedChunkSeqs(): number[] }`
  where `PendingChunk = { chunkSeq: number; captureSamples: number; body: ArrayBuffer }`

**백프레셔와 다른 것이다** — `bufferedAmount`는 OS 소켓 버퍼가 밀렸는지를 보고,
이 버퍼는 **서버가 내구 저장했는지**를 본다. 소켓을 떠난 조각도 서버가 S3에 쓰기 전에
죽으면 사라진다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import { describe, expect, it } from "vitest";
import { ResendBuffer } from "@/lib/transcription/resend-buffer";

const chunk = (chunkSeq: number, bytes = 3_200) => ({
  chunkSeq, captureSamples: chunkSeq * 1_600, body: new ArrayBuffer(bytes),
});

describe("ResendBuffer", () => {
  it("ACK 이하를 버린다", () => {
    const buffer = new ResendBuffer(10_485_760);
    [0, 1, 2, 3].forEach((n) => buffer.push(chunk(n)));
    buffer.ackThrough(1);
    expect(buffer.pending().map((c) => c.chunkSeq)).toEqual([2, 3]);
  });

  it("재전송은 원래 번호와 위치를 그대로 쓴다", () => {
    const buffer = new ResendBuffer(10_485_760);
    buffer.push(chunk(7));
    expect(buffer.pending()[0]).toMatchObject({ chunkSeq: 7, captureSamples: 11_200 });
  });

  it("상한을 넘으면 오래된 것부터 버리고 번호를 남긴다", () => {
    const buffer = new ResendBuffer(6_400);
    [0, 1, 2].forEach((n) => buffer.push(chunk(n)));
    expect(buffer.pending().map((c) => c.chunkSeq)).toEqual([1, 2]);
    expect(buffer.droppedChunkSeqs).toEqual([0]);
  });

  it("늦게 온 옛 ACK 가 버퍼를 되살리지 않는다", () => {
    const buffer = new ResendBuffer(10_485_760);
    [0, 1, 2].forEach((n) => buffer.push(chunk(n)));
    buffer.ackThrough(2);
    buffer.ackThrough(0);
    expect(buffer.pending()).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — 배열 + 누적 바이트. `ackThrough`는 `chunkSeq <= through`를 앞에서 제거. 상한 초과 시 앞에서 제거하며 `droppedChunkSeqs`에 기록
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `[APP-415] ACK 안 온 조각을 들고 있다가 재연결하면 다시 보냅니다`

---

### Task 5: 프로토콜 개정

**Files:**
- Modify: `lib/transcription/protocol.ts`
- Modify: `lib/transcription/protocol.test.ts` · `protocol.examples.test.ts`

**Interfaces:**
- Produces: `ServerEvent`에 `{type:"ack", throughChunkSeq:number}` · `{type:"capture_state", state:"LIVE"|"DEGRADED"|"LOST"}` 추가.
  `final`에서 `transcriptionSessionId` 제거, `speakerLabel: string | null` 추가.
  `ClientCommand`에서 `commit` 제거, `stop`이 `{ type:"stop", finalChunkSeq:number }`

- [ ] **Step 1: 테스트를 쓴다** — 새 두 이벤트 파싱 통과 · `final`에 `transcriptionSessionId`가 오면 `strictObject`가 거부 · `commit` 파싱 실패
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 스키마를 고친다.** `protocolExamples`도 같이 (계약 예시가 타입과 함께 검사된다)
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `[APP-415] ack·capture_state 를 계약에 넣고 commit 을 걷어냅니다`

---

### Task 6: 소켓이 헤더 둘을 싣는다

**Files:**
- Modify: `lib/transcription/socket.ts`
- Modify: `lib/transcription/socket.test.ts`

**Interfaces:**
- Consumes: `CAPTURE_CONTRACT` (Task 1), `ClientCommand` (Task 5)
- Produces: `sendAudio(chunk: ArrayBuffer, chunkSeq: number, captureSamples: number): boolean`,
  `stop(finalChunkSeq: number): void`. `commit()` **삭제**

- [ ] **Step 1: 테스트를 쓴다**

```ts
it("조각에 chunkSeq 와 captureSamples 를 싣는다", () => {
  socket.sendAudio(new ArrayBuffer(3_200), 12, 19_200);
  expect(published.at(-1)?.headers).toMatchObject({
    chunkSeq: "12", captureSamples: "19200",
  });
});

it("계약 상한(32,000)을 넘는 조각을 거부한다", () => {
  expect(socket.sendAudio(new ArrayBuffer(32_002), 0, 0)).toBe(false);
});
```

- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — 헤더 추가, 크기 검사를 `CAPTURE_CONTRACT.maxFrameBytes`로, `sendCommand`에서 `commit` 제거, `stop`이 JSON 본문을 싣는다
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `[APP-415] 조각마다 chunkSeq 와 captureSamples 를 헤더로 보냅니다`

---

### Task 7: 세션이 번호를 발급하고 버퍼를 배선한다

**Files:**
- Modify: `lib/transcription/realtime-session.ts`
- Modify: `lib/transcription/realtime-session.test.ts`

**Interfaces:**
- Consumes: `ResendBuffer` (Task 4), 새 `SocketPort` (Task 6), 새 배처 콜백 (Task 3)

**`chunkSeq`는 세션이 발급한다.** 워크릿도 배처도 세션 경계를 모른다.

- [ ] **Step 1: 테스트를 쓴다** — ① `chunkSeq`가 0부터 1씩 ② `ack` 수신 시 버퍼가 절삭 ③ 재연결하면 pending을 **원래 번호로** 재전송 ④ `stop`이 마지막 `chunkSeq`를 싣는다
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현**

`nextChunkSeq` 카운터 + `ResendBuffer`. `sendAudio(chunk, captureSamples)`가
번호를 붙여 버퍼에 넣고 소켓으로 보낸다. `handleEvent`에서 `ack`를 잡아 `ackThrough`.
`commit()` 메서드 삭제 — `RealtimeSessionController`에서도 뺀다(호출부가 있으면 같이 정리).

- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `[APP-415] 세션이 chunkSeq 를 발급하고 ACK 로 재전송 버퍼를 절삭합니다`

---

### Task 8: MSW 목이 계약을 실행 가능하게 만든다

**Files:**
- Modify: `lib/mocks/websocket-handler.ts`

**목이 사실상 서버 계약의 실행 가능한 명세**가 된다. 여기서 어긋난 것은 spec을 고친다.

- [ ] **Step 1: 목을 고친다** — 받은 `chunkSeq`를 세어 30조각(≈3초)마다 `ack` 발행. 헤더가 없거나 `captureSamples`가 뒷걸음질하면 `console.warn`
- [ ] **Step 2: 게이트 5종을 돌린다**

```bash
pnpm test:run && pnpm lint && pnpm typecheck && pnpm build
```

- [ ] **Step 3: 커밋** — `[APP-415] 목이 ack 를 발행하고 조각 헤더를 검증합니다`

---

## 다 됐다고 판단하는 기준

spec의 D1~D6이다. Task 3·4·7의 테스트가 D1~D4를 덮고, D5(16 kHz를 못 여는 기기)는
`PcmAudioCapture.sampleRate`가 실제 값을 노출하는 것으로, D6은 게이트 5종으로 닫는다.

## 안 하는 것

- `MediaRecorder`·WebCodecs 전환 — 형식을 안 바꾼다
- 총 샘플 수를 클라이언트가 보내기 — 서버가 바이트를 센다
- 잃은 구간을 녹음 중 화면에 알리기 — 회의록의 공백 행이 사후에 말한다 (APP-418)
