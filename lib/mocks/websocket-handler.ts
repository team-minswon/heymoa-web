import { ws } from "msw";

import { MockTranscriptionScenario } from "@/lib/mocks/transcription-scenario";

const transcriptionLink = ws.link(
  /\/v1\/transcription-sessions\/[^/]+\/stream/
);

export const transcriptionWebSocketHandler = transcriptionLink.addEventListener(
  "connection",
  ({ client }) => {
    const url = new URL(client.url);
    const sessionId = url.pathname.split("/").at(-2);
    const ticket = url.searchParams.get("ticket");

    if (!ticket) {
      client.close(4401, "missing ticket");
      return;
    }

    if (!sessionId) {
      client.close(4404, "missing session");
      return;
    }

    const scenario = new MockTranscriptionScenario(
      sessionId,
      (event) => client.send(JSON.stringify(event)),
      (code, reason) => client.close(code, reason)
    );

    try {
      scenario.open();
    } catch {
      client.close(4404, "session not found");
      return;
    }

    client.addEventListener("message", (event) => {
      void scenario.receiveFrame(event.data);
    });
    client.addEventListener("close", () => scenario.dispose());
  }
);
