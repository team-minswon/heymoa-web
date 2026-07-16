import { ws } from "msw";

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

function stompFrame(command: string, headers: Record<string, string>, body = "") {
  const bodyLength = encoder.encode(body).byteLength;
  return [
    command,
    ...Object.entries(headers).map(([name, value]) => `${name}:${value}`),
    ...(body ? [`content-length:${bodyLength}`] : []),
    "",
    body,
  ].join("\n").concat("\0");
}

export const transcriptionWebSocketHandler = transcriptionLink.addEventListener(
  "connection",
  ({ client }) => {
    let scenario: MockTranscriptionScenario | null = null;
    let subscriptionId = "sub-0";
    let subscriptionDestination = "/user/queue/transcription-events";
    let messageSequence = 1;

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
          subscriptionId = frame.headers.id;
          subscriptionDestination = frame.headers.destination;
          if (frame.headers.receipt) {
            client.send(stompFrame("RECEIPT", { "receipt-id": frame.headers.receipt }));
          }
          return;
        }
        if (frame.command === "DISCONNECT") {
          scenario?.dispose();
          if (frame.headers.receipt) {
            client.send(stompFrame("RECEIPT", { "receipt-id": frame.headers.receipt }));
          }
          client.close(1000, "client disconnected");
          return;
        }
        if (frame.command !== "SEND") return;

        const match = frame.headers.destination?.match(
          /^\/app\/transcription-sessions\/([^/]+)\/(connect|audio|commit|stop)$/
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
          await scenario.receiveFrame(frame.body);
        } else {
          await scenario.receiveFrame(JSON.stringify({ type: action }));
        }
      });
    });
    client.addEventListener("close", () => scenario?.dispose());
  }
);
