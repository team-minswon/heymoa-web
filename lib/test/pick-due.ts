import { fireEvent } from "@testing-library/react";

/**
 * 기한 칸의 달력에서 날짜를 고른다(APP-1591). 달력은 고른 날이 있는 달 — 없으면 이번 달 — 을 펼치므로
 * 그 달 안의 날짜를 넘긴다.
 */
export function pickDue(trigger: HTMLElement, iso: string) {
  fireEvent.click(trigger);
  const day = document.querySelector<HTMLButtonElement>(
    `td[data-day="${iso}"] button`
  );
  if (!day) throw new Error(`달력에 ${iso} 가 없습니다`);
  fireEvent.click(day);
}
