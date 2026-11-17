import { apiFetch, isAuthError } from "@/lib/api/fetcher";

type TicketResponse = { data?: { data?: { ticket?: string } } };

/** 핸드셰이크 401 은 브라우저에 상태 코드 없이 와서 연결 시도마다 REST 로 티켓을 받습니다. 던지지 않습니다 — stompjs `beforeConnect` 에서 던지면 재연결 루프가 멈춥니다. */
export async function ticketedSocketUrl(
  url: string,
  timeoutMs: number
): Promise<string | null> {
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
