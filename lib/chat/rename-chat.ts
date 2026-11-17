/** 계약의 제목 상한입니다. 넘으면 서버가 400 입니다. */
export const MAX_CHAT_TITLE_LENGTH = 100;

export function normalizeChatTitle(raw: string): string | null {
  const title = raw.replace(/\s+/g, " ").trim();
  return title ? title.slice(0, MAX_CHAT_TITLE_LENGTH) : null;
}
