import { apiFetch, isAuthError } from "@/lib/api/fetcher";

type TicketResponse = { data?: { data?: { ticket?: string } } };

/**
 * 소켓 주소에 연결 티켓을 붙인다(APP-1546·1547). 핸드셰이크 401 은 브라우저에 상태 코드 없이 오지만, 티켓 요청은
 * REST 라 fetcher 가 401 을 보고 접근 토큰을 갱신해 다시 받는다. 그래서 연결 시도마다 부른다.
 *
 * 던지지 않는다 — stompjs `beforeConnect` 안에서 던지면 재연결 루프가 멈춘다.
 * - 다시 로그인해야 하면 `null`. 세션 게이트는 fetcher 가 이미 열었다.
 * - 그 밖의 실패(망·404·5xx·시한)는 티켓 없는 주소. 쿠키로 붙는 이행 경로라 server 를 되돌려도 끊기지 않는다.
 */
export async function ticketedSocketUrl(
  url: string,
  timeoutMs: number
): Promise<string | null> {
  // fetcher 의 시한은 401 뒤 갱신 대기에는 걸리지 않는다. 갱신까지 묶어 전체에 상한을 둔다.
  // 넘기면 쿠키 주소로 붙고, 진행 중인 갱신은 그대로 끝나 만료면 fetcher 가 게이트를 연다
  let timer: ReturnType<typeof setTimeout> | undefined;
  const fallback = new Promise<string>((resolve) => {
    timer = setTimeout(() => resolve(url), timeoutMs);
  });
  try {
    return await Promise.race([fetchTicketedUrl(url, timeoutMs), fallback]);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTicketedUrl(
  url: string,
  timeoutMs: number
): Promise<string | null> {
  try {
    const response = await apiFetch<TicketResponse>("/v1/realtime/tickets", {
      method: "POST",
      timeoutMs,
    });
    const ticket = response.data?.data?.ticket;
    return ticket ? `${url}?ticket=${encodeURIComponent(ticket)}` : url;
  } catch (error) {
    return isAuthError(error) ? null : url;
  }
}
