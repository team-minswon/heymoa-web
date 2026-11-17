import { ws } from "msw";

import {
  CONTEXT_APPLIED_RANGES,
  CONTEXT_DEMO_NOTE_ID,
  CONTEXT_TIMELINE,
  CONTEXT_SWAP_FILL,
  markSwapFilled,
  resetSwapFill,
  CONTEXT_SWAP_NOTE_ID,
  LIVE_UTTERANCE,
  LIVE_UTTERANCE_TEXT,
} from "@/lib/mocks/proposals";
import {
  LIVE_AGENDA_NOTE_ID,
  liveAgendaFrame,
  startLiveAgendaFeed as startLiveAgendas,
} from "@/lib/mocks/live-agendas";
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

    const SPEED = 60;

    const startSwapFeed = (noteId: string, send: (body: unknown) => void) => {
      resetSwapFill();
      noteTopicTimers.push(
        window.setTimeout(() => {
          markSwapFilled();
          send({
            type: "transcript-analysis-run.applied",
            occurredAt: CONTEXT_SWAP_FILL.appliedAt,
            range: CONTEXT_SWAP_FILL,
          });
        }, 2_500)
      );
    };

    const startLiveAgendaFeed = (noteId: string) => {
      for (const { atMs, delayMs } of startLiveAgendas(Date.now())) {
        noteTopicTimers.push(
          window.setTimeout(() => {
            const topic = noteTopics.get(noteId);
            const frame = liveAgendaFrame(atMs);
            if (!topic || !frame) return;
            client.send(
              stompFrame(
                "MESSAGE",
                {
                  subscription: topic.id,
                  "message-id": `mock-${messageSequence++}`,
                  destination: topic.destination,
                  "content-type": "application/json",
                },
                JSON.stringify(frame)
              )
            );
          }, delayMs)
        );
      }
    };

    const startNoteTopicFeed = (noteId: string) => {
      if (noteId === LIVE_AGENDA_NOTE_ID) {
        startLiveAgendaFeed(noteId);
        return;
      }
      if (noteId !== CONTEXT_DEMO_NOTE_ID && noteId !== CONTEXT_SWAP_NOTE_ID) {
        return;
      }
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

      if (noteId === CONTEXT_SWAP_NOTE_ID) {
        startSwapFeed(noteId, send);
        return;
      }

      const live = LIVE_UTTERANCE;
      const partialFrame = (confirmedText: string, pendingText: string) => ({
        type: "transcript.partial",
        transcriptionSessionId: live.transcriptionSessionId,
        utteranceId: live.utteranceId,
        confirmedText,
        pendingText,
      });
      noteTopicTimers.push(
        window.setTimeout(() => send(partialFrame("", live.confirmed)), 700),
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

      CONTEXT_TIMELINE.forEach((entry) => {
        noteTopicTimers.push(
          window.setTimeout(() => {
            send({
              type: "proposal.changed",
              occurredAt: new Date(entry.atMs).toISOString(),
              proposal: entry.proposal,
            });
          }, entry.atMs / SPEED)
        );
      });

      CONTEXT_APPLIED_RANGES.forEach((coverage) => {
        noteTopicTimers.push(
          window.setTimeout(() => {
            send({
              type: "transcript-analysis-run.applied",
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
          const resendFromSeq = frame.headers.resendFromSeq;
          try {
            scenario.open(
              resendFromSeq === undefined ? undefined : Number(resendFromSeq)
            );
          } catch {
            scenario = null;
            sendEvent({
              type: "error",
              code: "SESSION_NOT_CONNECTABLE",
              message: "연결할 수 없는 녹음 세션입니다.",
            });
          }
          return;
        }
        if (!scenario) return;
        if (action === "audio") {
          await scenario.receiveFrame(frame.body, {
            chunkSeq: Number(frame.headers.chunkSeq),
            captureSamples: Number(frame.headers.captureSamples),
          });
        } else {
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
