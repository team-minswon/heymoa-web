import { buildUrl, refreshAuthOnce } from "@/lib/api/fetcher";
import { notifyAuthStateChanged } from "@/lib/auth/events";

export type SseEvent = {
  event: string;
  data: string;
};

async function connect(
  url: string,
  body: Record<string, unknown>,
  signal: AbortSignal | undefined,
  hasRetried: boolean
): Promise<Response> {
  const response = await fetch(buildUrl(url), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (response.status === 401 && !hasRetried) {
    try {
      await refreshAuthOnce();
    } catch {
      notifyAuthStateChanged({ reason: "unauthenticated" });
      throw new Error("Authentication refresh failed.");
    }
    return connect(url, body, signal, true);
  }

  if (!response.ok) {
    throw await response
      .json()
      .catch(() => new Error(`SSE_STREAM_FAILED_${response.status}`));
  }
  if (!response.body) {
    throw new Error("SSE_STREAM_NO_BODY");
  }
  return response;
}

/**
 * POST 요청의 text/event-stream 응답을 SseEvent 단위로 순회한다.
 * 이벤트 payload의 스키마 검증은 하지 않는다 — feature protocol의 몫이다.
 * 소비자가 루프를 끝내거나 signal이 abort되면 스트림을 정리한다.
 */
export async function* postEventStream(
  url: string,
  body: Record<string, unknown>,
  { signal }: { signal?: AbortSignal } = {}
): AsyncGenerator<SseEvent, void, undefined> {
  const response = await connect(url, body, signal, false);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  let eventType = "";
  let dataLines: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";

      for (const rawLine of lines) {
        // ponytail: 줄 구분은 \n 기준 + \r 제거 — 단독 \r 종결은 서버 계약에 없다.
        const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

        if (line === "") {
          if (dataLines.length > 0) {
            yield { event: eventType || "message", data: dataLines.join("\n") };
          }
          eventType = "";
          dataLines = [];
          continue;
        }
        if (line.startsWith(":")) continue;

        const separator = line.indexOf(":");
        const field = separator === -1 ? line : line.slice(0, separator);
        const rawValue = separator === -1 ? "" : line.slice(separator + 1);
        const value_ = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;

        if (field === "event") eventType = value_;
        else if (field === "data") dataLines.push(value_);
        // id·retry 등 그 외 필드는 사용하지 않는다.
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
