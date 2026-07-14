import { ws } from "msw";

import { createMockTranscriptionScenario } from "@/lib/mocks/transcription-scenario";

const transcriptionLink = ws.link(/\/ws\/transcription-sessions\/[^/?]+$/);

export const transcriptionWebSocketHandler = transcriptionLink.addEventListener(
  "connection",
  ({ client }) => {
    const url = new URL(client.url);
    const sessionId = url.pathname.split("/").at(-1);

    if (!sessionId) {
      client.close(1008, "missing session");
      return;
    }

    const scenario = createMockTranscriptionScenario({
      sessionId,
      send: (event) => client.send(JSON.stringify(event)),
      requestClose: (code, reason) => client.close(code, reason),
    });

    try {
      scenario.open();
    } catch {
      client.close(1008, "session not found");
      return;
    }

    client.addEventListener("message", (event) => {
      void scenario.receiveFrame(event.data);
    });
    client.addEventListener("close", () => scenario.dispose());
  }
);
