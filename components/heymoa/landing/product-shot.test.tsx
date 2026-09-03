import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProductShot } from "@/components/heymoa/landing/product-shot";

/**
 * 랜딩의 제품 화면에서 **실제로 물어볼 수 있다**. 여기서 지키는 것은 셋이다.
 *
 * 1. 준비된 질문을 누르면 그 왕복이 대화에 쌓인다
 * 2. 답보다 먼저 「생각하는 중」이 서고, 그동안 근거는 안 붙고 다음 질문도 못 보낸다
 * 3. 모션을 줄인 사람에게는 생각도 흐름도 없이 통째로 선다
 *
 * 2가 이 파일의 요점이다. 흐르는 중에 근거를 그리면 **아직 안 읽은 회의록이 이미 붙은
 * 것처럼** 보이고, 그건 이 랜딩이 하는 「사실 대조판」이라는 약속을 화면이 먼저 어기는 것이다.
 *
 * 좁은 화면용과 넓은 화면용 두 벌이 다 마운트된다(CSS로 하나만 보인다) — 그래서 전부
 * `getAllBy*`로 집고 첫 벌만 만진다.
 */
const matchMedia = (reduced: boolean) =>
  vi.fn().mockImplementation((query: string) => ({
    matches: reduced,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

/** 첫 벌의 「내 에이전트」를 열고 대화와 예시 질문을 돌려준다. */
function openAgent() {
  fireEvent.click(screen.getAllByRole("tab", { name: "내 에이전트" })[0]);
  const asks = screen.getAllByRole("group", { name: "예시 질문" })[0];
  return { asks, buttons: within(asks).getAllByRole("button") };
}

/**
 * `IntersectionObserver`를 곧바로 「보인다」로 대답하는 대역. jsdom에는 이게 없어서
 * 그냥 두면 대본이 아예 안 돈다.
 */
function seeImmediately() {
  class Immediate {
    constructor(private cb: IntersectionObserverCallback) {}
    observe() {
      this.cb(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver
      );
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("IntersectionObserver", Immediate);
}

/** 대본이 멈출 때까지 타이머를 조금씩 당긴다. 한 번에 당기면 효과가 안 따라온다. */
function play(steps = 3000) {
  for (let i = 0; i < steps; i += 1) {
    act(() => {
      vi.advanceTimersByTime(20);
    });
  }
}

/** 조건이 참이 될 때까지만 당긴다. 참이 됐으면 참, 끝까지 안 되면 거짓. */
function playUntil(hit: () => boolean, steps = 3000) {
  for (let i = 0; i < steps; i += 1) {
    if (hit()) return true;
    act(() => {
      vi.advanceTimersByTime(20);
    });
  }
  return hit();
}

/**
 * 제품 화면은 **혼자 한 바퀴 돈다** — 말이 전사에 받아 적히고, 사건 흐름에 쌓이고,
 * 에이전트가 답하고, 회의를 끝내면 요약이 나온다.
 *
 * 여기서 지키는 것은 대본의 **끝**과 **놓는 법** 둘이다. 중간 프레임을 하나하나 재면
 * 시간 상수를 만질 때마다 깨지고, 정작 깨지면 안 되는 것은 「끝까지 간다」와 「손대면
 * 멈춘다」다.
 */
describe("ProductShot 대본", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    window.matchMedia = matchMedia(false);
    seeImmediately();
  });

  it("전사 · 사건 흐름 · 에이전트를 지나 종료와 요약까지 간다", () => {
    vi.useFakeTimers();
    try {
      render(<ProductShot />);

      expect(screen.getAllByText("기록 중").length).toBeGreaterThan(0);
      expect(screen.getAllByText("지금까지 3건").length).toBeGreaterThan(0);
      // 종료 전 요약 탭의 문구는 앱 것 그대로다.
      expect(screen.queryAllByText("개요")).toHaveLength(0);

      play();

      // 대본은 요약 탭과 에이전트 레일에서 끝난다.
      expect(screen.getAllByText("종료됨").length).toBeGreaterThan(0);
      expect(screen.getAllByText(/결정 둘입니다/).length).toBeGreaterThan(0);
      for (const label of ["개요", "액션 아이템", "결정"]) {
        expect(screen.getAllByText(label).length).toBeGreaterThan(0);
      }

      // 전사로 돌아가면 마지막 발화까지 받아 적혀 있다.
      act(() => {
        fireEvent.click(screen.getAllByRole("tab", { name: "전사" })[0]);
      });
      expect(
        screen.getAllByText(/오늘 남길 건 여기까지입니다/).length
      ).toBeGreaterThan(0);

      // 사건 흐름으로 돌아가면 둘이 더 올라와 있다.
      act(() => {
        fireEvent.click(screen.getAllByRole("tab", { name: "실시간 정리" })[0]);
      });
      expect(screen.getAllByText("지금까지 5건").length).toBeGreaterThan(0);
      expect(
        screen.getAllByText("카드 결제 실패 재시도 정책 정하기").length
      ).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("탭을 누르면 그 탭에 머물되 대본은 계속 돈다", () => {
    vi.useFakeTimers();
    try {
      render(<ProductShot />);

      // 레일을 만졌다. 대본은 나중에 「내 에이전트」로 옮기려 한다.
      act(() => {
        fireEvent.click(screen.getAllByRole("tab", { name: "실시간 정리" })[0]);
      });

      play();

      // 탭은 안 뺏겼다.
      expect(
        screen.getAllByRole("tab", { name: "실시간 정리" })[0]
      ).toHaveAttribute("aria-selected", "true");
      // **그런데 내용은 끝까지 찼다** — 예전에는 여기서 대본이 통째로 감겨 버렸다.
      expect(screen.getAllByText("지금까지 5건").length).toBeGreaterThan(0);
      expect(
        screen.getAllByText("카드 결제 실패 재시도 정책 정하기").length
      ).toBeGreaterThan(0);
      expect(screen.getAllByText("종료됨").length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * 고정의 예외 하나. 회의가 끝나면 **앱이** 요약 탭으로 넘긴다
   * (`meeting-controls.tsx`의 `onMeetingEnded` → `note-panel.tsx`). 그 이동은 대본이
   * 부리는 것이 아니라 앱이 하는 일이라 방문자의 고정을 이긴다.
   */
  it("회의가 끝나면 고정해 둔 노트 탭도 요약으로 넘어간다", () => {
    vi.useFakeTimers();
    try {
      render(<ProductShot />);

      act(() => {
        fireEvent.click(screen.getAllByRole("tab", { name: "정보" })[0]);
      });
      expect(screen.getAllByText("회의 정보").length).toBeGreaterThan(0);

      play();

      expect(screen.getAllByRole("tab", { name: "요약" })[0]).toHaveAttribute(
        "aria-selected",
        "true"
      );
      expect(screen.getAllByText("개요").length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * 「회의 종료」는 그림이다. 한때 진짜로 눌렸는데, 누르는 순간 기록 중이던 회의가 종료로
   * 확 넘어가서 「내가 뭘 부순 건가」로 읽혔다. 눌러도 할 일이 없는 것을 버튼으로 두면
   * 탭 순회에 빈 정거장이 늘 뿐이라, 뒤로·전체화면·복사와 같은 `<span>`이다.
   */
  it("회의 종료는 그림이고, 눌리는 순간이 화면에 남는다", () => {
    vi.useFakeTimers();
    try {
      render(<ProductShot />);

      const end = () => screen.getAllByText("회의 종료")[0].closest(".lp-end");
      expect(end()).not.toBeNull();
      expect(screen.queryAllByRole("button", { name: "회의 종료" })).toHaveLength(0);

      // 끝나기 전에 **눌리는 대목**을 지난다 — 이게 없으면 버튼이 그냥 사라지고 칩만 바뀐다.
      expect(playUntil(() => end()?.hasAttribute("data-pressing") ?? false)).toBe(
        true
      );
      expect(screen.queryAllByText("종료됨")).toHaveLength(0);

      play();

      expect(screen.getAllByText("종료됨").length).toBeGreaterThan(0);
      // 노드는 남고 자리만 접힌다 — 한 프레임에 없애면 팝으로 읽힌다.
      expect(end()?.hasAttribute("data-gone")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("모션을 줄였으면 대본을 안 돌리고 끝 상태로 둔다", () => {
    window.matchMedia = matchMedia(true);
    render(<ProductShot />);

    // 타이머를 한 번도 안 돌렸는데 이미 끝나 있다.
    expect(screen.getAllByText("종료됨").length).toBeGreaterThan(0);
    expect(screen.getAllByText("개요").length).toBeGreaterThan(0);
  });
});

describe("ProductShot 내 에이전트", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.matchMedia = matchMedia(false);
  });

  it("준비된 질문을 누르면 그 왕복이 대화에 쌓인다", () => {
    render(<ProductShot />);
    const { buttons } = openAgent();
    const question = buttons[0].textContent ?? "";

    fireEvent.click(buttons[0]);

    // 질문은 곧바로 선다 — 흐르는 것은 답뿐이다.
    expect(screen.getAllByText(question).length).toBeGreaterThan(1);
  });

  it("먼저 생각하고, 흐르는 동안에는 근거가 안 붙고 다음 질문도 못 보낸다", () => {
    vi.useFakeTimers();
    try {
      render(<ProductShot />);
      const { buttons } = openAgent();

      // 「제가 없던 사이에」의 답은 「2차 회의」를 근거로 든다. 처음 떠 있는 왕복도 같은
      // 칩을 들고 있으므로 **개수**로 센다.
      const refs = () => screen.getAllByText("2차 회의").length;
      const before = refs();

      act(() => {
        fireEvent.click(buttons[2]);
      });

      // 답보다 먼저 「생각하는 중」이 선다 — 질문과 답이 같은 프레임에 서면 이미 적혀
      // 있던 글로 읽힌다.
      expect(screen.getAllByText("생각하는 중").length).toBeGreaterThan(0);
      expect(refs()).toBe(before);
      expect(buttons[0]).toBeDisabled();

      // 한 번에 5초를 당기면 한 글자만 흐른다 — 다음 타이머는 **효과가 돈 뒤에** 걸리고
      // 효과는 `act`가 끝날 때 돈다. 그래서 조금씩, 여러 번 당긴다.
      for (let i = 0; i < 200 && buttons[0].hasAttribute("disabled"); i += 1) {
        act(() => {
          vi.advanceTimersByTime(20);
        });
      }

      expect(refs()).toBeGreaterThan(before);
      expect(buttons[0]).not.toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("모션을 줄였으면 생각도 흐름도 없이 통째로 세운다", () => {
    window.matchMedia = matchMedia(true);
    vi.useFakeTimers();
    try {
      render(<ProductShot />);
      const { buttons } = openAgent();
      const before = screen.getAllByText("2차 회의").length;

      act(() => {
        fireEvent.click(buttons[2]);
      });

      // 타이머를 한 번도 안 돌렸는데 근거가 이미 서 있다.
      expect(screen.getAllByText("2차 회의").length).toBeGreaterThan(before);
      expect(screen.queryByText("생각하는 중")).toBeNull();
      expect(buttons[0]).not.toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });
});
