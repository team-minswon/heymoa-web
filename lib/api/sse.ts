import {
  AuthRefreshError,
  buildUrl,
  refreshAuthOnce,
  retryAfterMsOf,
} from "@/lib/api/fetcher";
import {
  isSessionExpired,
  openSessionGate,
  SessionExpiredError,
} from "@/lib/auth/session-gate";
import { acceptLanguageHeader } from "@/lib/i18n/document-locale";
import { webMessage } from "@/lib/i18n/web-message";

export type SseHttpFailure = {
  httpStatus: number;
  retryAfterMs: number | null;
};

export function sseHttpFailureOf(error: unknown): SseHttpFailure | null {
  return typeof error === "object" &&
    error !== null &&
    typeof (error as { httpStatus?: unknown }).httpStatus === "number"
    ? (error as SseHttpFailure)
    : null;
}

export type SseEvent = {
  event: string;
  data: string;
  /** `id:` 줄(서버의 entry id, `?after=` 커서)입니다. 하트비트에는 없어 `undefined` 는 커서를 안 옮긴다는 뜻입니다. */
  id?: string;
};

async function connect(
  url: string,
  init: RequestInit,
  hasRetried: boolean
): Promise<Response> {
  if (isSessionExpired()) {
    throw new SessionExpiredError();
  }

  const response = await fetch(buildUrl(url), {
    credentials: "include",
    ...init,
    headers: {
      ...acceptLanguageHeader(),
      Accept: "text/event-stream",
      ...init.headers,
    },
  });

  if (response.status === 401 && !hasRetried) {
    try {
      await refreshAuthOnce();
    } catch (error) {
      if (error instanceof AuthRefreshError && error.expired) {
        openSessionGate();
      }
      throw error;
    }
    return connect(url, init, true);
  }

  // 410 은 턴은 끝났고 스트림은 사라졌다는 뜻입니다. 재연결이 아니라 히스토리를 다시 읽을 신호입니다.
  if (response.status === 410) {
    const envelope = await response.json().catch(() => null);
    throw {
      success: false,
      data: null,
      error: {
        code: "SSE_STREAM_GONE",
        message:
          typeof envelope?.error?.message === "string"
            ? envelope.error.message
            : webMessage("streamGone"),
      },
    };
  }
  if (!response.ok) {
    const failure: object = await response
      .json()
      .catch(() => new Error(`SSE_STREAM_FAILED_${response.status}`));
    throw Object.assign(failure, {
      httpStatus: response.status,
      retryAfterMs: retryAfterMsOf(response.headers),
    });
  }
  if (!response.body) {
    throw new Error("SSE_STREAM_NO_BODY");
  }
  return response;
}

/** 네이티브 `EventSource` 는 상태 코드를 못 봐 401 갱신을 끼울 수 없어 fetch 로 읽습니다(`Last-Event-ID` 대신 `?after=`). `connect` 를 제너레이터 안에서 불러야 처리되지 않은 rejection 이 남지 않습니다. */
export async function* getEventStream(
  url: string,
  { signal }: { signal?: AbortSignal } = {}
): AsyncGenerator<SseEvent, void, undefined> {
  yield* frames(await connect(url, { method: "GET", signal }, false));
}

async function* frames(
  response: Response
): AsyncGenerator<SseEvent, void, undefined> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  let eventType = "";
  let eventId: string | undefined;
  let dataLines: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

        if (line === "") {
          if (dataLines.length > 0) {
            yield {
              event: eventType || "message",
              data: dataLines.join("\n"),
              id: eventId,
            };
          }
          eventType = "";
          eventId = undefined;
          dataLines = [];
          continue;
        }
        if (line.startsWith(":")) {
          yield { event: "heartbeat", data: "{}" };
          continue;
        }

        const separator = line.indexOf(":");
        const field = separator === -1 ? line : line.slice(0, separator);
        const rawValue = separator === -1 ? "" : line.slice(separator + 1);
        const value_ = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;

        if (field === "event") eventType = value_;
        else if (field === "data") dataLines.push(value_);
        // SSE 명세와 달리 `id:` 는 프레임 단위로만 삽니다. 물려받으면 「커서를 안 옮긴다」를 표현할 수 없습니다.
        else if (field === "id") eventId = value_;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
