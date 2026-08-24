import { ws } from "msw";

import {
  CONTEXT_APPLIED_RANGES,
  CONTEXT_DEMO_NOTE_ID,
  CONTEXT_EVENT_ID,
  CONTEXT_TIMELINE,
  LIVE_UTTERANCE,
  LIVE_UTTERANCE_TEXT,
} from "@/lib/mocks/context-candidates";
import {
  createMockTranscriptionScenario,
  type MockTranscriptionScenario,
} from "@/lib/mocks/transcription-scenario";
import type { ServerEvent } from "@/lib/transcription/protocol";

const transcriptionLink = ws.link(/\/ws\/transcriptions$/);
const encoder = new TextEncoder();
const decoder = new TextDecoder();

type StompFrame = {
  command: string;
  headers: Record<string, string>;
  body: Uint8Array;
};

async function parseFrame(data: unknown): Promise<StompFrame | null> {
  const bytes =
    typeof data === "string"
      ? encoder.encode(data)
      : data instanceof Blob
        ? new Uint8Array(await data.arrayBuffer())
        : data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : ArrayBuffer.isView(data)
            ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
            : null;
  if (!bytes) return null;

  let start = 0;
  while (bytes[start] === 10 || bytes[start] === 13) start += 1;
  if (start >= bytes.length) return null;
  let headerEnd = -1;
  for (let index = start; index < bytes.length - 1; index += 1) {
    if (bytes[index] === 10 && bytes[index + 1] === 10) {
      headerEnd = index;
      break;
    }
  }
  if (headerEnd < 0) return null;

  const [command, ...headerLines] = decoder
    .decode(bytes.slice(start, headerEnd))
    .split("\n");
  const headers = Object.fromEntries(
    headerLines.map((line) => {
      const separator = line.indexOf(":");
      return [line.slice(0, separator), line.slice(separator + 1)];
    })
  );
  const bodyStart = headerEnd + 2;
  const contentLength = Number(headers["content-length"]);
  const bodyEnd = Number.isFinite(contentLength)
    ? bodyStart + contentLength
    : bytes.indexOf(0, bodyStart);
  return {
    command,
    headers,
    body: bytes.slice(bodyStart, bodyEnd < 0 ? bytes.length : bodyEnd),
  };
}

function stompFrame(
  command: string,
  headers: Record<string, string>,
  body = ""
) {
  const bodyLength = encoder.encode(body).byteLength;
  return [
    command,
    ...Object.entries(headers).map(([name, value]) => `${name}:${value}`),
    ...(body ? [`content-length:${bodyLength}`] : []),
    "",
    body,
  ]
    .join("\n")
    .concat("\0");
}

export const transcriptionWebSocketHandler = transcriptionLink.addEventListener(
  "connection",
  ({ client }) => {
    let scenario: MockTranscriptionScenario | null = null;
    let subscriptionId = "sub-0";
    let subscriptionDestination = "/user/queue/transcription-events";
    let messageSequence = 1;
    /** note topic 구독. `/user/queue/...`(녹음자 전용)와 별개다. */
    const noteTopics = new Map<string, { id: string; destination: string }>();
    const noteTopicTimers: number[] = [];

    const sendEvent = (event: ServerEvent) => {
      client.send(
        stompFrame(
          "MESSAGE",
          {
            subscription: subscriptionId,
            "message-id": `mock-${messageSequence++}`,
            destination: subscriptionDestination,
            "content-type": "application/json",
          },
          JSON.stringify(event)
        )
      );
    };

    /**
     * **`/topic/notes/{noteId}` 발행은 이 목이 처음 만든다.** 서비스 워커가 붙기 전에는 web이
     * 후보 화면을 볼 방법이 없었다.
     *
     * 실제 주기를 압축해서 흘린다 — 회의 42분을 그대로 기다릴 수 없으므로 `SPEED`로 나눈다.
     * 압축해도 **사건 사이가 성기다는 성질은 남는다**. 그게 이 화면의 실제 모습이다.
     *
     * **압축이 공짜가 아니다.** 60배로 흘리면 note topic event가 4~7초마다 오는데, 그동안
     * 공유 챗의 30초 안전 폴링이 한 번도 안 돌았다(`smoke.spec.ts` 「locks the composer」가
     * 그것으로 깨졌다). 실제 주기(배치 15~25초)에서도 같은 일이 일어날 수 있어 별도로
     * 확인이 필요하다. 여기서는 전용 노트로 가둬 다른 화면을 안 건드린다.
     */
    const SPEED = 60;
    const startNoteTopicFeed = (noteId: string) => {
      // **전용 노트에서만 흘린다.** 모든 노트에 흘리면 다른 화면의 폴링과 섞인다 —
      // 실제로 공유 챗의 30초 안전 폴링이 굶어 e2e 하나가 깨졌다(아래 주석).
      if (noteId !== CONTEXT_DEMO_NOTE_ID) return;
      const send = (body: unknown) => {
        const topic = noteTopics.get(noteId);
        if (!topic) return;
        client.send(
          stompFrame(
            "MESSAGE",
            {
              subscription: topic.id,
              "message-id": `mock-${messageSequence++}`,
              destination: topic.destination,
              "content-type": "application/json",
            },
            JSON.stringify(body)
          )
        );
      };

      /**
       * **살아 있는 발화 하나를 먼저 흘린다.** partial 두 토막이 자라다가 final 이 걷는다.
       *
       * 후보 피드보다 앞에 두는 것은 의도다 — 첫 후보가 4초 뒤에 오는데 partial 을 그
       * 뒤에 두면 e2e 가 확인할 창이 회의 끝까지 밀린다.
       *
       * final 을 넉넉히 뒤에 둔다. 둘째 partial 과 final 사이가 **두 토막이 동시에 보이는
       * 유일한 창**이라, 좁으면 테스트가 화면을 못 보고 지나간다.
       */
      const live = LIVE_UTTERANCE;
      const partialFrame = (confirmedText: string, pendingText: string) => ({
        type: "transcript.partial",
        transcriptionSessionId: live.transcriptionSessionId,
        utteranceId: live.utteranceId,
        confirmedText,
        pendingText,
      });
      noteTopicTimers.push(
        // 확정 토막이 아직 없다 — 미확정만 뜬다.
        window.setTimeout(() => send(partialFrame("", live.confirmed)), 700),
        // 앞이 굳고 뒤가 흐리다. **둘 다 보이는 순간이 여기서 시작된다.**
        window.setTimeout(
          () => send(partialFrame(live.confirmed, live.pending)),
          1_500
        ),
        window.setTimeout(
          () =>
            send({
              type: "transcript.final",
              transcriptionSessionId: live.transcriptionSessionId,
              segmentId: live.segmentId,
              utteranceId: live.utteranceId,
              sequence: live.sequence,
              text: LIVE_UTTERANCE_TEXT,
              startedAtMs: live.startedAtMs,
              endedAtMs: live.endedAtMs,
            }),
          6_000
        )
      );

      CONTEXT_TIMELINE.forEach((entry, index) => {
        noteTopicTimers.push(
          window.setTimeout(() => {
            send({
              type: "context.candidate.changed",
              eventId: CONTEXT_EVENT_ID(index),
              changeOrdinal: 0,
              occurredAt: new Date(entry.atMs).toISOString(),
              candidate: entry.candidate,
            });
          }, entry.atMs / SPEED)
        );
      });

      CONTEXT_APPLIED_RANGES.forEach((coverage, index) => {
        noteTopicTimers.push(
          window.setTimeout(() => {
            send({
              type: "context.classification.batch.applied",
              eventId: CONTEXT_EVENT_ID(50 + index),
              occurredAt: coverage.appliedAt,
              range: coverage,
            });
          }, coverage.toEndedAtMs / SPEED)
        );
      });
    };

    client.addEventListener("close", () => {
      noteTopicTimers.forEach((timer) => window.clearTimeout(timer));
      noteTopicTimers.length = 0;
    });

    client.addEventListener("message", (event) => {
      void parseFrame(event.data).then(async (frame) => {
        if (!frame) return;
        if (frame.command === "CONNECT" || frame.command === "STOMP") {
          client.send(
            stompFrame("CONNECTED", {
              version: "1.2",
              session: "mock-stomp-session",
              "heart-beat": "10000,10000",
            })
          );
          return;
        }
        if (frame.command === "SUBSCRIBE") {
          const destination = frame.headers.destination ?? "";
          const noteTopic = destination.match(/^\/topic\/notes\/([^/]+)$/);
          if (noteTopic) {
            noteTopics.set(noteTopic[1], {
              id: frame.headers.id,
              destination,
            });
            if (frame.headers.receipt) {
              client.send(
                stompFrame("RECEIPT", { "receipt-id": frame.headers.receipt })
              );
            }
            startNoteTopicFeed(noteTopic[1]);
            return;
          }
          subscriptionId = frame.headers.id;
          subscriptionDestination = destination;
          if (frame.headers.receipt) {
            client.send(
              stompFrame("RECEIPT", { "receipt-id": frame.headers.receipt })
            );
          }
          return;
        }
        if (frame.command === "DISCONNECT") {
          scenario?.dispose();
          if (frame.headers.receipt) {
            client.send(
              stompFrame("RECEIPT", { "receipt-id": frame.headers.receipt })
            );
          }
          client.close(1000, "client disconnected");
          return;
        }
        if (frame.command !== "SEND") return;

        const match = frame.headers.destination?.match(
          /^\/app\/transcription-sessions\/([^/]+)\/(connect|audio|stop)$/
        );
        if (!match) return;
        const [, sessionId, action] = match;
        if (action === "connect") {
          scenario = createMockTranscriptionScenario({
            sessionId,
            send: sendEvent,
            requestClose: (code, reason) => client.close(code, reason),
          });
          try {
            scenario.open();
          } catch {
            client.close(1008, "session not found");
          }
          return;
        }
        if (!scenario) {
          client.close(1008, "session not connected");
          return;
        }
        if (action === "audio") {
          // 목이 계약을 실행 가능하게 만드는 자리다. 서버가 볼 값을 그대로 본다.
          await scenario.receiveFrame(frame.body, {
            chunkSeq: Number(frame.headers.chunkSeq),
            captureSamples: Number(frame.headers.captureSamples),
          });
        } else {
          // body 는 Uint8Array 라 빈 것도 truthy 다. 길이로 갈라야 한다.
          const command = frame.body.byteLength
            ? decoder.decode(frame.body)
            : JSON.stringify({ type: action, finalChunkSeq: -1 });
          await scenario.receiveFrame(command);
        }
      });
    });
    client.addEventListener("close", () => scenario?.dispose());
  }
);
