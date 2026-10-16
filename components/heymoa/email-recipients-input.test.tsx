import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { EmailRecipientsInput } from "@/components/heymoa/email-recipients-input";
import type { Recipient } from "@/lib/notes/share-mail/recipients";

const GROUPS = [
  { label: "회의 참석자", people: [{ name: "강성재", email: "sungjae@mentor.kr" }] },
  { label: "워크스페이스 멤버", people: [{ name: "최유나", email: "yuna@heymoa.ai" }] },
];

function Harness({ initial = [], groups = GROUPS }: { initial?: Recipient[]; groups?: typeof GROUPS }) {
  const [value, setValue] = useState<Recipient[]>(initial);
  return (
    <>
      <EmailRecipientsInput id="to" value={value} onChange={setValue} groups={groups} />
      <output data-testid="value">{value.map((r) => `${r.email}${r.valid ? "" : "!"}`).join(",")}</output>
    </>
  );
}

const input = () => screen.getByRole("combobox");
const value = () => screen.getByTestId("value").textContent;

describe("EmailRecipientsInput", () => {
  afterEach(cleanup);

  it("쉼표를 치면 그 앞까지 칩이 되고, 틀린 주소는 오류 칩으로 남는다", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "a@x.com, nope" } });
    fireEvent.change(input(), { target: { value: "nope," } });
    expect(value()).toBe("a@x.com,nope!");
    expect(screen.getByText("(주소 형식 오류)")).toBeTruthy();
  });

  it("여러 주소를 붙여 넣으면 한 번에 나뉜다", () => {
    render(<Harness />);
    fireEvent.paste(input(), { clipboardData: { getData: () => "a@x.com; b@y.com\nc@z.com" } });
    expect(value()).toBe("a@x.com,b@y.com,c@z.com");
  });

  it("한글 조합 중 Enter 는 칩을 세우지 않는다", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "강성" } });
    fireEvent.keyDown(input(), { key: "Enter", isComposing: true });
    expect(value()).toBe("");
    expect((input() as HTMLInputElement).value).toBe("강성");
  });

  it("후보는 참석자 → 멤버 순으로 묶이고, 화살표 · Enter 로 고르면 이름 칩이 선다", () => {
    render(<Harness />);
    fireEvent.focus(input());
    expect(screen.getByRole("group", { name: "회의 참석자" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "워크스페이스 멤버" })).toBeTruthy();
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(input().getAttribute("aria-activedescendant")).toBe(
      screen.getByRole("option", { name: /최유나/ }).id
    );
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(value()).toBe("yuna@heymoa.ai");
    expect(screen.getByText("최유나")).toBeTruthy();
  });

  it("다 친 주소는 Enter 로 그 주소가 들어간다 — 그 주소로 시작하는 후보로 바뀌지 않는다", () => {
    render(<Harness groups={[{ label: "회의 참석자", people: [{ name: "John", email: "john@example.com" }] }]} />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "john@example.co" } });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(value()).toBe("john@example.co");
  });

  it("쳐 둔 주소를 골라 놓고 붙여 넣으면 고른 글자는 붙여 넣은 글로 바뀐다", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "wrong@example.com" } });
    (input() as HTMLInputElement).setSelectionRange(0, "wrong@example.com".length);
    fireEvent.paste(input(), { clipboardData: { getData: () => "right@example.com; other@example.com" } });
    expect(value()).toBe("right@example.com,other@example.com");
  });

  it("주소 일부만 골라 붙여 넣으면 그 자리만 바뀐다 — 사이에 빈칸이 끼어 주소가 갈리지 않는다", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "alice@old.com" } });
    (input() as HTMLInputElement).setSelectionRange("alice@".length, "alice@old.com".length);
    fireEvent.paste(input(), { clipboardData: { getData: () => "new.com; bob@y.com" } });
    expect(value()).toBe("alice@new.com,bob@y.com");
  });

  it("후보는 click 으로 고른다 — 스크린 리더는 click 만 보낸다", () => {
    render(<Harness />);
    fireEvent.focus(input());
    fireEvent.click(screen.getByRole("option", { name: /최유나/ }));
    expect(value()).toBe("yuna@heymoa.ai");
  });

  it("이름 일부를 치면 Enter 는 첫 후보를 고른다", () => {
    render(<Harness />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "성재" } });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(value()).toBe("sungjae@mentor.kr");
  });

  it("칩의 빼기 버튼은 칩을 지우고 후보 목록을 다시 펼치지 않는다", () => {
    render(<Harness initial={[{ email: "a@x.com", valid: true }]} />);
    const remove = screen.getByRole("button", { name: "a@x.com 빼기" });
    fireEvent.mouseDown(remove);
    fireEvent.click(remove);
    expect(value()).toBe("");
    expect(document.activeElement).toBe(input());
    expect(input().getAttribute("aria-expanded")).toBe("false");
  });

  it("빈 칸에서 Backspace 는 마지막 칩을 지운다", () => {
    render(
      <Harness
        initial={[
          { email: "a@x.com", valid: true },
          { email: "b@x.com", valid: true },
        ]}
      />
    );
    fireEvent.keyDown(input(), { key: "Backspace" });
    expect(value()).toBe("a@x.com");
  });
});
