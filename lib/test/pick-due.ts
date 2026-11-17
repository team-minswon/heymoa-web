import { fireEvent } from "@testing-library/react";

export function pickDue(trigger: HTMLElement, iso: string) {
  fireEvent.click(trigger);
  const day = document.querySelector<HTMLButtonElement>(
    `td[data-day="${iso}"] button`
  );
  if (!day) throw new Error(`달력에 ${iso} 가 없습니다`);
  fireEvent.click(day);
}
