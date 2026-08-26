import { AuthRefreshError, buildUrl, refreshAuthOnce } from "@/lib/api/fetcher";
import {
  isSessionExpired,
  openSessionGate,
  SessionExpiredError,
} from "@/lib/auth/session-gate";

export type SseEvent = {
  event: string;
  data: string;
  /**
   * `id:` 줄. 서버가 여기에 `seq`를 싣는다 — **버리면 커서가 없어 `?after=`를 못 부른다.**
   *
   * 없을 수 있다. 하트비트는 SSE 주석이라 번호가 아예 없다. 그래서 `undefined`가
   * 「0」이 아니라 **「이 프레임은 커서를 안 옮긴다」**다.
   *
   * 문자열로 낸다. **이 층은 숫자로 안 바꾼다** — 커서 비교는 리듀서의 일이고, 여기서
   * `Number()`를 하면 서버가 못 보낸 값이 조용히 `NaN`이 되어 그 자리에서 사라진다.
   */
  id?: string;
};

async function connect(
  url: string,
  init: RequestInit,
  hasRetried: boolean
): Promise<Response> {
  // 세션이 끝났으면 스트림을 열지 않는다. apiFetch를 안 거치는 경로라 따로 막아야 한다.
  if (isSessionExpired()) {
    throw new SessionExpiredError();
  }

  const response = await fetch(buildUrl(url), {
    credentials: "include",
    ...init,
    headers: { Accept: "text/event-stream", ...init.headers },
  });

  if (response.status === 401 && !hasRetried) {
    try {
      await refreshAuthOnce();
    } catch (error) {
      // 만료일 때만 게이트를 연다. 네트워크 오류는 일시 실패라 재시도 대상으로 남긴다.
      if (error instanceof AuthRefreshError && error.expired) {
        openSessionGate();
      }
      throw error;
    }
    return connect(url, init, true);
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
  // **`connect`를 제너레이터 안에서 부른다.** 밖에서 부르면 아무도 순회하지 않은 사이에
  // 요청이 먼저 나가고, 그 promise가 reject하면 처리되지 않은 rejection으로 남는다.
  yield* frames(
    await connect(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      },
      false
    )
  );
}

/**
 * GET으로 여는 같은 스트림. **재연결·재진입 전용**이다.
 *
 * 네이티브 `EventSource`를 안 쓴다 — 쿠키 인증에 `credentials: "include"`가 필요하고
 * 401 refresh를 transport가 지고 있는데 `EventSource`는 둘 다 못 한다. 그래서
 * **`Last-Event-ID` 헤더가 안 나간다** — 이어받을 자리는 URL의 `?after=` 하나다.
 *
 * 커서는 **URL에 이미 들어 있다.** 어디까지 받았는지를 이 층은 모른다.
 */
export async function* getEventStream(
  url: string,
  { signal }: { signal?: AbortSignal } = {}
): AsyncGenerator<SseEvent, void, undefined> {
  yield* frames(await connect(url, { method: "GET", signal }, false));
}

/** 프레이밍만. 응답을 여는 것은 위 둘이 한다. */
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
        // ponytail: 줄 구분은 \n 기준 + \r 제거 — 단독 \r 종결은 서버 계약에 없다.
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
        // 주석은 하트비트다. **버리지 않고 이벤트로 올린다** — 40초 유휴 타이머가
        // 「연결이 죽었나」를 재려면 연결이 살아 있다는 유일한 신호가 여기로 와야 한다.
        // 번호가 없으므로 커서를 안 민다.
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
        // **`id:`는 프레임 단위로만 산다.** SSE 명세의 "last event ID" 버퍼는 프레임을
        // 넘어 유지되지만, 그 규칙을 따르면 번호 없는 프레임이 앞 프레임의 번호를 물려받아
        // 「커서를 안 옮긴다」를 표현할 수 없다.
        else if (field === "id") eventId = value_;
        // retry 등 그 외 필드는 사용하지 않는다.
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
