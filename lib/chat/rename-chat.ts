/** 계약의 제목 상한. 넘으면 서버가 400 이라 입력이 먼저 막는다. */
export const MAX_CHAT_TITLE_LENGTH = 100;

/** 한 줄로 접고 앞뒤 공백을 지운다. 비면 null — 저장하지 않고 원래 제목으로 돌아간다. */
export function normalizeChatTitle(raw: string): string | null {
  const title = raw.replace(/\s+/g, " ").trim();
  return title ? title.slice(0, MAX_CHAT_TITLE_LENGTH) : null;
}
