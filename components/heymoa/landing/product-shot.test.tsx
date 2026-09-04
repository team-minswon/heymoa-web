import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
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
let observers: IntersectionObserverCallback[] = [];

function seeImmediately() {
  observers = [];
  class Immediate {
    constructor(private cb: IntersectionObserverCallback) {
      observers.push(cb);
    }
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

/** 화면 밖으로 나갔다고 알린다. 대본은 여기서 쉬어야 한다. */
function leaveView() {
  act(() => {
    for (const cb of observers) {
      cb(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        null as unknown as IntersectionObserver
      );
    }
  });
}

/**
 * 타이머를 조금씩 당긴다. 한 번에 당기면 효과가 안 따라온다 — 다음 타이머는 효과가 돈
 * 뒤에 걸리고 효과는 `act`가 끝날 때 돈다.
 *
 * **한 걸음이 60ms인 이유는 비용이다.** 20ms로 3000번 돌던 때는 `act` 호출만 3000번이라
 * 부하가 걸린 머신에서 vitest 기본 제한(5초)을 넘겨 테스트가 죽었다(실측 5.2초). 글자
 * 스트림이 16ms이라 60ms면 한 걸음에 한 번은 반드시 돈다 — 잘게 쪼갤 이유가 없다.
 */
const STEP_MS = 60;

function play(steps = 1500) {
  for (let i = 0; i < steps; i += 1) {
    act(() => {
      vi.advanceTimersByTime(STEP_MS);
    });
  }
}

/**
 * 한 바퀴가 끝날 때까지만 당긴다. **`play()`로 넉넉히 당기면 안 된다** — 대본은 끝나면
 * 스스로 처음으로 돌아가므로, 지나치면 다시 「기록 중」인 화면을 보게 된다.
 */
function playToEnd() {
  // 요약은 절이 **하나씩** 선다 — 라벨로 재면 중간에 멈춘다. 마지막 절(결정)의 문장으로
  // 가린다. 라벨 「결정」은 사건 흐름 묶음 머리에도 있어서 못 쓴다.
  return playUntil(
    () =>
      screen.queryAllByText("결제 화면 개편은 다음 스프린트로 미룹니다.")
        .length > 0
  );
}

/** 조건이 참이 될 때까지만 당긴다. 참이 됐으면 참, 끝까지 안 되면 거짓. */
function playUntil(hit: () => boolean, steps = 1500) {
  for (let i = 0; i < steps; i += 1) {
    if (hit()) return true;
    act(() => {
      vi.advanceTimersByTime(STEP_MS);
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

      expect(playToEnd()).toBe(true);

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

      act(() => {
        fireEvent.click(screen.getAllByRole("tab", { name: "실시간 정리" })[0]);
      });

      // 사건이 하나 더 올라올 때까지만 돌린다 — 다음 장면(질의)에 닿기 전이다.
      expect(
        playUntil(() => screen.queryAllByText("지금까지 4건").length > 0)
      ).toBe(true);

      // 방금 누른 탭은 안 뺏겼고, **내용은 계속 찬다** — 예전에는 여기서 대본이 통째로
      // 감겨 버렸다.
      expect(
        screen.getAllByRole("tab", { name: "실시간 정리" })[0]
      ).toHaveAttribute("aria-selected", "true");
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * 고정이 **장면까지 막지는 않는다.** 대본이 탭을 옮기는 자리는 둘뿐이고 둘 다 새 장면의
   * 시작이다(질의 · 요약). 고정이 이것까지 막으면 방문자가 아무거나 한 번 눌렀다는 이유로
   * 장면 하나가 통째로 안 보인다.
   */
  it("레일을 만져 뒀어도 질의 장면에는 같이 넘어간다", () => {
    vi.useFakeTimers();
    try {
      render(<ProductShot />);

      act(() => {
        fireEvent.click(screen.getAllByRole("tab", { name: "실시간 정리" })[0]);
      });

      play();

      expect(
        screen.getAllByRole("tab", { name: "내 에이전트" })[0]
      ).toHaveAttribute("aria-selected", "true");
      expect(screen.getAllByText(/결정 둘입니다/).length).toBeGreaterThan(0);
      // 못 본 채 지나간 것은 없다 — 사건 흐름도 끝까지 찼다.
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

      expect(playToEnd()).toBe(true);

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
      expect(
        screen.queryAllByRole("button", { name: "회의 종료" })
      ).toHaveLength(0);

      // 끝나기 전에 **눌리는 대목**을 지난다 — 이게 없으면 버튼이 그냥 사라지고 칩만 바뀐다.
      expect(
        playUntil(() => end()?.hasAttribute("data-pressing") ?? false)
      ).toBe(true);
      expect(screen.queryAllByText("종료됨")).toHaveLength(0);

      expect(playUntil(() => screen.queryAllByText("종료됨").length > 0)).toBe(
        true
      );

      // 노드는 남고 자리만 접힌다 — 한 프레임에 없애면 팝으로 읽힌다.
      expect(end()?.hasAttribute("data-gone")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("한 바퀴가 끝나면 스스로 처음으로 돌아간다", () => {
    vi.useFakeTimers();
    try {
      render(<ProductShot />);
      expect(playToEnd()).toBe(true);
      expect(screen.getAllByText("종료됨").length).toBeGreaterThan(0);

      // 쉬었다가 처음으로.
      expect(playUntil(() => screen.queryAllByText("기록 중").length > 0)).toBe(
        true
      );
      expect(screen.getAllByText("지금까지 3건").length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * **손댄 사람에게도 돈다.** 한때 안 돌렸는데, 아무거나 한 번 눌렀다는 이유로 화면이 그
   * 자리에 굳어 다시 볼 방법이 없었다. 돌 때 고정도 같이 풀려야 대본이 제 자리를 옮긴다.
   */
  it("손을 댔어도 다시 돌고, 그때 고정이 풀린다", () => {
    vi.useFakeTimers();
    try {
      render(<ProductShot />);
      act(() => {
        fireEvent.click(screen.getAllByRole("tab", { name: "정보" })[0]);
      });

      expect(playToEnd()).toBe(true);
      expect(playUntil(() => screen.queryAllByText("기록 중").length > 0)).toBe(
        true
      );

      // 고정이 풀려 대본의 첫 화면(전사)으로 돌아왔다.
      expect(screen.getAllByRole("tab", { name: "전사" })[0]).toHaveAttribute(
        "aria-selected",
        "true"
      );
      expect(screen.getAllByText("지금까지 3건").length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * 화자는 **회의가 끝난 뒤에 붙고, 붙는 것은 이름이 아니라 「화자 A」다.** 앱은 화자
   * 매핑이 `MAPPED`가 돼야 칩을 그리고, 사람과 잇는 것은 그다음에 사용자가 한다
   * (`speaker-identity.ts` — 연결 안 됐으면 `화자 A`).
   */
  it("기록 중에는 화자가 없고, 끝나면 「화자 A」로 붙는다", () => {
    vi.useFakeTimers();
    try {
      render(<ProductShot />);

      expect(screen.getAllByText("기록 중").length).toBeGreaterThan(0);
      expect(screen.queryAllByText(/화자 [A-D]/)).toHaveLength(0);

      expect(playToEnd()).toBe(true);
      act(() => {
        fireEvent.click(screen.getAllByRole("tab", { name: "전사" })[0]);
      });

      // 사람 이름이 아니다 — 그건 사용자가 붙인다.
      expect(screen.getAllByText(/화자 A/).length).toBeGreaterThan(0);
      expect(screen.queryAllByText("김민서")).toHaveLength(0);
      // 아직 확인 안 한 화자라는 표시가 이름을 붙일 이유를 만든다.
      expect(
        screen.getAllByLabelText("아직 확인하지 않은 화자").length
      ).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * **화면 밖이면 쉰다.** 한 번 보고 관찰을 끊어 버리면, 아래로 내려간 뒤에도 16ms 간격
   * 상태 갱신과 큰 트리 두 벌 렌더가 페이지를 떠날 때까지 이어진다.
   */
  it("화면 밖으로 나가면 대본이 멈춘다", () => {
    vi.useFakeTimers();
    try {
      render(<ProductShot />);
      // 한 줄이라도 늘 때까지 돌린다.
      expect(
        playUntil(() => screen.queryAllByText("지금까지 4건").length > 0)
      ).toBe(true);

      leaveView();
      const before = screen.getAllByRole("tabpanel")[0].innerHTML.length;
      play(400);

      expect(screen.getAllByRole("tabpanel")[0].innerHTML.length).toBe(before);
      // 아직 종료 전이다 — 멈춰 있었다는 뜻이다.
      expect(screen.queryAllByText("종료됨")).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * 끝난 자리에서 질문을 누르면, 이미 예약된 반복이 답을 지우면 안 된다. 남은 대기(1.5초)가
   * 「생각 0.62초 + 타이핑」보다 짧아서 그냥 두면 답이 중간에 사라진다.
   */
  it("끝난 뒤 질문해도 답이 끝까지 흐른다", () => {
    vi.useFakeTimers();
    try {
      render(<ProductShot />);
      expect(playToEnd()).toBe(true);

      act(() => {
        fireEvent.click(
          within(
            screen.getAllByRole("group", { name: "예시 질문" })[0]
          ).getAllByRole("button")[0]
        );
      });

      const mine =
        /둘입니다\. 온보딩 이탈 로그 수집 초안을 목요일까지 올리기로 했고/;
      expect(playUntil(() => screen.queryAllByText(mine).length > 0)).toBe(
        true
      );

      // **답이 끝난 직후를 본다.** 답은 약 1.34초에 끝나는데 반복 대기는 1.5초라, 예약을
      // 안 미루면 여기서 이미 처음으로 돌아가 답이 지워져 있다. 미루면 답이 끝난 시점부터
      // 다시 1.5초를 재므로 아직 종료된 화면 그대로다.
      play(8);
      expect(screen.getAllByText(mine).length).toBeGreaterThan(0);
      expect(screen.getAllByText("종료됨").length).toBeGreaterThan(0);
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
    // 돌릴 것이 없으니 다시 보기도 안 낸다.
    expect(
      screen.queryAllByRole("button", { name: /처음부터 다시 보기/ })
    ).toHaveLength(0);
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

  /**
   * codex가 잡은 자리다. 대본의 `ask` 대목은 손수 보낸 답이 흐르는 동안 **진행**만 멈추고
   * **진입**은 막지 않았다 — 앞 대목(`rail`)의 예약이 이미 걸려 있으면 커서는 그대로
   * `ask`로 들어온다. 그러면 흐르는 진행값은 손수 답 하나뿐이라 대본 답을 가리키는 것이
   * 없어서, 대본 답이 **완성본으로** 떴다가 손수 답이 끝나는 순간 「생각하는 중」으로
   * 되감겼다.
   */
  it("손수 보낸 답이 흐르는 동안 대본 답이 완성본으로 새치기하지 않는다", () => {
    window.matchMedia = matchMedia(false);
    vi.useFakeTimers();
    seeImmediately();
    try {
      render(<ProductShot />);

      // 대본이 「내 에이전트」로 옮기는 대목까지 간다. 그 바로 다음이 대본의 질의다.
      expect(
        playUntil(
          () =>
            screen
              .getAllByRole("tab", { name: "내 에이전트" })[0]
              .getAttribute("aria-selected") === "true"
        )
      ).toBe(true);

      const asks = screen.getAllByRole("group", { name: "예시 질문" })[0];
      const buttons = within(asks).getAllByRole("button");
      act(() => {
        fireEvent.click(buttons[0]);
      });

      // 대본이 `ask`로 넘어갈 만큼만 당긴다(그 대목 앞의 대기가 780ms다).
      play(20);

      // 칩이 아직 잠겨 있으면 손수 답이 흐르는 중이다 — 겹치는 그 순간이 맞다.
      expect(buttons[0]).toBeDisabled();
      expect(
        screen.queryAllByText(/미룬 이유는 2차 회의에 남아 있습니다/)
      ).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
