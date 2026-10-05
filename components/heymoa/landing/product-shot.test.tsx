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
import { ASKS, REVIEW, SEED } from "@/components/heymoa/landing/use-demo";

/**
 * 랜딩의 제품 화면. **혼자 한 바퀴 돌고, 실제로 눌린다.** 여기서 지키는 것은 넷이다.
 *
 * 1. 대본이 앱의 순서를 그대로 밟는다 — 스크립트 → 타임라인 → 에이전트 → **중지 → 종료** →
 *    분석 → 검토 문서. 기록 중에는 회의를 끝낼 수 없다(APP-695)
 * 2. 손대면 탭만 고정되고 대본은 계속 돈다. 장면이 바뀌는 이동과 다음 바퀴는 고정을 푼다
 * 3. 화자는 회의가 끝난 뒤에만, 이름이 아니라 「화자 A」로 붙는다
 * 4. 에이전트는 먼저 생각하고, 흐르는 동안에는 근거를 안 붙인다
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
 * 한 바퀴가 끝날 때까지만 당긴다. **`play()`로 넉넉히 당기면 안 된다** — 대본은 끝나면
 * 스스로 처음으로 돌아가므로, 지나치면 다시 「기록 중」인 화면을 보게 된다.
 *
 * 검토 문서는 묶음이 **하나씩** 선다. 마지막 묶음과 함께 서는 검토 막대로 가린다.
 */
const playToEnd = () =>
  playUntil(() => screen.queryAllByText("검토 완료").length > 0);

const tab = (name: string) => screen.getAllByRole("tab", { name })[0];
const selected = (name: string) =>
  tab(name).getAttribute("aria-selected") === "true";

/** 「회의 종료」 그림. 첫 벌(좁은 화면)의 것이다. */
const endButton = () =>
  screen.getAllByText("회의 종료")[0].closest(".lp-end") as HTMLElement;
/** 녹음 독의 ■. 독은 노트 패널 안에 떠 있다. */
const dockStop = () =>
  document.querySelector(".lp-dock [data-pressing]") as HTMLElement | null;

/**
 * 이 파일은 가짜 시계로 대본 한 바퀴를 `act` 수백 번으로 돌린다. 혼자 돌면 한 테스트가
 * 1초 안쪽이지만 server·AI 회귀 검사와 나란히 돌면 CPU 를 나눠 써서 vitest 기본 제한(5초)을
 * 넘긴 적이 있다(APP-626). 기다림은 전부 상한이 있다 — `play(n)` 은 걸음 수가 정해져 있고
 * `playUntil` 은 상한에서 거짓을 돌려줘 단언이 잡는다 — 그래서 제한을 늘려도 무한 대기가
 * 숨지 않는다. 전역 `testTimeout` 은 안 올린다 — 다른 파일의 진짜 멈춤까지 가린다.
 */
vi.setConfig({ testTimeout: 20_000 });

describe("play 도우미", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("playUntil 은 상한에 닿으면 거짓으로 끝난다 — 무한 대기가 없다", () => {
    vi.useFakeTimers();
    expect(playUntil(() => false, 3)).toBe(false);
  });
});

describe("ProductShot 대본", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  beforeEach(() => {
    window.matchMedia = matchMedia(false);
    seeImmediately();
  });

  it("스크립트 · 타임라인 · 에이전트를 지나 중지 · 종료 · 검토 문서까지 간다", () => {
    vi.useFakeTimers();
    render(<ProductShot />);

    // 첫 화면은 도는 회의다 — 스크립트 탭이고, 검토 문서는 아직 없다.
    expect(screen.getAllByText("기록 중").length).toBeGreaterThan(0);
    expect(selected("스크립트")).toBe(true);
    expect(screen.queryAllByText("검토 중")).toHaveLength(0);

    expect(playToEnd()).toBe(true);

    // 대본은 요약 탭의 검토 문서에서 끝난다.
    expect(screen.getAllByText("종료됨").length).toBeGreaterThan(0);
    expect(selected("요약")).toBe(true);
    expect(screen.getAllByText("검토 중").length).toBeGreaterThan(0);
    expect(screen.getAllByText("언제 정해졌나").length).toBeGreaterThan(0);
    // 「요약」은 라벨로 안 본다 — 탭 이름도 「요약」이라 섹션이 없어도 걸린다. 본문을 본다.
    expect(screen.getAllByText(REVIEW.summary).length).toBeGreaterThan(0);
    for (const label of ["주제", "결정", "할 일"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    // 머리의 참석자는 화자 라벨이 아니라 노트의 참석자다 — 정보 탭과 같은 넷.
    expect(screen.getAllByText("김민서 외 3명").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("결제 화면 개편은 다음 스프린트로 미룹니다.").length
    ).toBeGreaterThan(0);
    // 결정 줄 아래 근거 발언이 화자 라벨과 함께 선다.
    expect(
      screen.getAllByRole("list", { name: "근거 발언" }).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/프로젝트에 올립니다/).length).toBeGreaterThan(
      0
    );
    // 「검토 완료」는 그림이다 — 이 랜딩에서 올릴 프로젝트가 없다.
    expect(
      screen.queryAllByRole("button", { name: /검토 완료/ })
    ).toHaveLength(0);

    // 에이전트가 대본의 질문에 답해 두었다.
    expect(screen.getAllByText(/결정 둘입니다/).length).toBeGreaterThan(0);

    // 스크립트로 돌아가면 마지막 발화까지 받아 적혀 있다.
    act(() => {
      fireEvent.click(tab("스크립트"));
    });
    expect(
      screen.getAllByText(/오늘 남길 건 여기까지입니다/).length
    ).toBeGreaterThan(0);

    // 타임라인으로 돌아가면 대본이 올린 둘까지 서 있고, 안내가 종료 뒤의 말로 바뀌었다.
    act(() => {
      fireEvent.click(tab("타임라인"));
    });
    expect(
      screen.getAllByRole("button", { name: "전체 7" }).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("이 회의에서 남길 만한 변화만 기록했습니다").length
    ).toBeGreaterThan(0);
    // 끝난 회의의 마지막 안건은 더는 「논의 중」이 아니다.
    expect(screen.queryAllByText("논의 중")).toHaveLength(0);
  });

  /**
   * **기록 중에는 회의를 끝낼 수 없다**(APP-695). 독에서 먼저 멈추고 「중지됨」이 된 뒤에야
   * 「회의 종료」가 살아난다. 대본이 그 차례를 거꾸로 밟으면 이 화면이 앱에 없는 동작을
   * 가르친다.
   *
   * 「회의 종료」는 그림이다. 한때 진짜로 눌렸는데, 누르는 순간 기록 중이던 회의가 종료로 확
   * 넘어가서 「내가 뭘 부순 건가」로 읽혔다.
   */
  it("독에서 중지한 뒤에야 회의 종료가 눌리고, 눌리는 순간이 화면에 남는다", () => {
    vi.useFakeTimers();
    render(<ProductShot />);

    expect(endButton()).not.toBeNull();
    expect(
      screen.queryAllByRole("button", { name: "회의 종료" })
    ).toHaveLength(0);
    // 기록 중에는 잠겨 있다.
    expect(endButton().hasAttribute("data-disabled")).toBe(true);

    /** 걸음마다 본다 — 「회의 종료」가 눌리는 순간 칩이 「기록 중」이면 안 된다. */
    const watchUntil = (hit: () => boolean) =>
      playUntil(() => {
        if (endButton().hasAttribute("data-pressing")) {
          expect(screen.queryAllByText("기록 중")).toHaveLength(0);
        }
        return hit();
      });

    // 먼저 독의 ■가 눌린다. 그 순간에는 아직 기록 중이다.
    expect(watchUntil(() => dockStop() !== null)).toBe(true);
    expect(screen.getAllByText("기록 중").length).toBeGreaterThan(0);
    expect(endButton().hasAttribute("data-pressing")).toBe(false);

    // 멈추면 칩이 「중지됨」이 되고 회의 종료가 살아난다.
    expect(
      watchUntil(() => screen.queryAllByText("중지됨").length > 0)
    ).toBe(true);
    expect(endButton().hasAttribute("data-disabled")).toBe(false);
    expect(screen.queryAllByText("종료됨")).toHaveLength(0);

    // 그다음 회의 종료가 눌린다 — 끝나기 전에 **눌리는 대목**을 지난다.
    expect(
      watchUntil(() => endButton().hasAttribute("data-pressing"))
    ).toBe(true);
    expect(screen.getAllByText("중지됨").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("종료됨")).toHaveLength(0);

    expect(
      watchUntil(() => screen.queryAllByText("종료됨").length > 0)
    ).toBe(true);

    // 노드는 남고 자리만 접힌다 — 한 프레임에 없애면 팝으로 읽힌다. 독도 같이 가라앉는다.
    expect(endButton().hasAttribute("data-gone")).toBe(true);
    for (const dock of document.querySelectorAll(".lp-dock")) {
      expect(dock.hasAttribute("data-gone")).toBe(true);
    }
  });

  it("탭을 누르면 그 탭에 머물되 대본은 계속 돈다", () => {
    vi.useFakeTimers();
    render(<ProductShot />);

    expect(playUntil(() => selected("타임라인"))).toBe(true);
    act(() => {
      fireEvent.click(tab("정보"));
    });
    expect(screen.getAllByText("회의 정보").length).toBeGreaterThan(0);

    // 정보를 보는 동안에도 에이전트는 답하고, 회의는 멈춘다 — 대본이 감기지 않았다.
    expect(
      playUntil(() => screen.queryAllByText(/결정 둘입니다/).length > 0)
    ).toBe(true);
    expect(
      playUntil(() => screen.queryAllByText("중지됨").length > 0)
    ).toBe(true);
    // 방금 누른 탭은 안 뺏겼다.
    expect(selected("정보")).toBe(true);
  });

  /**
   * 고정이 **장면까지 막지는 않는다.** 대본이 탭을 옮기는 자리는 둘뿐이고 둘 다 새 장면의
   * 시작이다(타임라인 · 요약). 고정이 이것까지 막으면 방문자가 아무거나 한 번 눌렀다는 이유로
   * 장면 하나가 통째로 안 보인다. 요약으로 가는 것은 회의가 끝나면 **앱이** 하는 일이기도
   * 하다(`meeting-controls.tsx`의 `onMeetingEnded` → `note-panel.tsx`).
   */
  it("고정해 둔 탭도 장면이 바뀌는 이동에는 같이 간다", () => {
    vi.useFakeTimers();
    render(<ProductShot />);

    act(() => {
      fireEvent.click(tab("정보"));
    });
    expect(selected("정보")).toBe(true);
    expect(playUntil(() => selected("타임라인"))).toBe(true);

    act(() => {
      fireEvent.click(tab("정보"));
    });
    expect(playToEnd()).toBe(true);
    expect(selected("요약")).toBe(true);
    expect(screen.getAllByText("검토 중").length).toBeGreaterThan(0);
  });

  /**
   * **손댄 사람에게도 돈다.** 한때 안 돌렸는데, 아무거나 한 번 눌렀다는 이유로 화면이 그
   * 자리에 굳어 다시 볼 방법이 없었다. 돌 때 고정도 같이 풀려야 대본이 제 자리를 옮긴다.
   */
  it("한 바퀴가 끝나면 스스로 처음으로 돌아가고, 그때 고정이 풀린다", () => {
    vi.useFakeTimers();
    render(<ProductShot />);
    expect(playToEnd()).toBe(true);

    act(() => {
      fireEvent.click(tab("정보"));
    });

    // 쉬었다가 처음으로.
    expect(playUntil(() => screen.queryAllByText("기록 중").length > 0)).toBe(
      true
    );
    expect(selected("스크립트")).toBe(true);
    expect(screen.queryAllByText("종료됨")).toHaveLength(0);
    // 다시 시작한 회의라 독이 다시 떠 있고 회의 종료는 다시 잠겼다.
    expect(endButton().hasAttribute("data-gone")).toBe(false);
    expect(endButton().hasAttribute("data-disabled")).toBe(true);

    // 타임라인도 처음부터 있던 다섯만 남았다.
    act(() => {
      fireEvent.click(tab("타임라인"));
    });
    expect(
      screen.getAllByRole("button", { name: "전체 5" }).length
    ).toBeGreaterThan(0);
  });

  /**
   * 화자는 **회의가 끝난 뒤에 붙고, 붙는 것은 이름이 아니라 「화자 A」다.** 앱은 화자
   * 매핑이 `MAPPED`가 돼야 칩을 그리고, 사람과 잇는 것은 그다음에 사용자가 한다
   * (`speaker-identity.ts` — 연결 안 됐으면 `화자 A`).
   */
  it("기록 중에는 화자가 없고, 끝나면 「화자 A」로 붙는다", () => {
    vi.useFakeTimers();
    render(<ProductShot />);

    expect(screen.getAllByText("기록 중").length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/화자 [A-D]/)).toHaveLength(0);
    expect(
      screen.queryAllByLabelText("아직 확인하지 않은 화자")
    ).toHaveLength(0);
    expect(screen.queryAllByText(/^미지정/)).toHaveLength(0);

    expect(playToEnd()).toBe(true);
    act(() => {
      fireEvent.click(tab("스크립트"));
    });

    // 사람 이름이 아니다 — 그건 사용자가 붙인다.
    expect(screen.getAllByText(/화자 A/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText("김민서")).toHaveLength(0);
    // 아직 확인 안 한 화자라는 표시가 이름을 붙일 이유를 만든다. 여덟 줄 모두다.
    expect(
      screen.getAllByLabelText("아직 확인하지 않은 화자").length
    ).toBeGreaterThanOrEqual(8);
    // 도구줄도 앱처럼 「화자」와 「미지정 N」이 선다 — 넷 다 아직 이름이 없다.
    expect(screen.getAllByText("화자").length).toBeGreaterThan(0);
    expect(screen.getAllByText("미지정 4").length).toBeGreaterThan(0);
  });

  /**
   * 타임라인 항목은 말이 **끝난 뒤에** 붙는다(「말이 끝날 때마다 정리됩니다」). 그다음 말이
   * 흐르는 동안은 타임라인 바닥의 받아 적는 줄에 선다. 기록 중인 마지막 안건만 「논의 중」이다.
   */
  it("타임라인에는 끝난 말의 항목이 쌓이고, 흐르는 말은 바닥에 받아 적힌다", () => {
    vi.useFakeTimers();
    render(<ProductShot />);

    expect(playUntil(() => selected("타임라인"))).toBe(true);
    expect(
      screen.getAllByRole("button", { name: "전체 5" }).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("논의 중").length).toBeGreaterThan(0);
    expect(screen.getAllByText("01:02 – 지금").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("말이 끝날 때마다 정리됩니다 · 방금 갱신").length
    ).toBeGreaterThan(0);

    expect(
      playUntil(
        () => screen.queryAllByRole("button", { name: "전체 6" }).length > 0
      )
    ).toBe(true);
    // 다음 말이 받아 적히는 동안 바닥에 그 줄이 선다.
    expect(
      playUntil(() => screen.queryAllByText("받아 적는 중").length > 0)
    ).toBe(true);
    expect(
      playUntil(
        () => screen.queryAllByRole("button", { name: "전체 7" }).length > 0
      )
    ).toBe(true);
    expect(
      screen.getAllByRole("button", { name: "열린 질문 1" }).length
    ).toBeGreaterThan(0);

    // 중지되면 「논의 중」과 「– 지금」이 빠진다 — 멈춘 회의를 지금 논의 중이라고 하면 거짓이다.
    expect(
      playUntil(() => screen.queryAllByText("중지됨").length > 0)
    ).toBe(true);
    act(() => {
      fireEvent.click(tab("타임라인"));
    });
    expect(screen.queryAllByText("논의 중")).toHaveLength(0);
    expect(screen.queryAllByText("01:02 – 지금")).toHaveLength(0);
  });

  it("타임라인의 골라 보기 · 안건 접기 · 항목 펼치기가 실제로 된다", () => {
    vi.useFakeTimers();
    render(<ProductShot />);
    expect(playUntil(() => selected("타임라인"))).toBe(true);

    const panel = screen.getAllByRole("tabpanel")[0];
    const chips = within(panel).getByRole("group", {
      name: "유형으로 골라 보기",
    });

    // 「결정」만 고르면 결정이 없는 안건까지 통째로 빠진다.
    act(() => {
      fireEvent.click(within(chips).getByRole("button", { name: "결정 2" }));
    });
    expect(
      within(chips).getByRole("button", { name: "결정 2" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(panel).getByText("결제 화면 개편은 다음 스프린트로 미룬다")
    ).toBeInTheDocument();
    expect(
      within(panel).queryByText("온보딩 이탈 로그 수집 초안을 목요일까지 올린다")
    ).toBeNull();
    expect(within(panel).queryByText("온보딩 이탈 로그 수집")).toBeNull();

    act(() => {
      fireEvent.click(within(chips).getByRole("button", { name: "전체 5" }));
    });
    expect(
      within(panel).getByText("온보딩 이탈 로그 수집 초안을 목요일까지 올린다")
    ).toBeInTheDocument();

    // 안건 머리를 누르면 그 묶음이 접힌다 — 목록은 DOM에 남고 `hidden`이 걸린다.
    const head = within(panel).getByRole("button", {
      name: /스프린트 우선순위/,
    });
    expect(head).toHaveAttribute("aria-expanded", "true");
    act(() => {
      fireEvent.click(head);
    });
    expect(head).toHaveAttribute("aria-expanded", "false");
    const list = document.getElementById(
      head.getAttribute("aria-controls") ?? ""
    );
    expect(list).not.toBeNull();
    expect(list?.hidden).toBe(true);

    // 다시 펴서 항목을 펼치면 그 항목이 인용한 발화가 선다.
    act(() => {
      fireEvent.click(head);
    });
    const entry = within(panel).getByRole("button", {
      name: /결제 화면 개편은 다음 스프린트로 미룬다/,
    });
    expect(entry).toHaveAttribute("aria-expanded", "false");
    act(() => {
      fireEvent.click(entry);
    });
    expect(entry).toHaveAttribute("aria-expanded", "true");
    const details = document.getElementById(
      entry.getAttribute("aria-controls") ?? ""
    );
    expect(details?.hidden).toBe(false);
    expect(details?.textContent).toContain(
      "지난 회의에서 결제 화면 개편은 다음으로 미뤘습니다"
    );

    // 답한 질문을 펼치면 근거 아래에 「↗ 답」이 그 답이 된 항목을 가리킨다. 「00:44에 답함」이라고
    // 말해 놓고 펼친 카드에 답이 없으면 거짓이다.
    const question = within(panel).getByRole("button", {
      name: /^결제 화면 개편을 미룬 이유는 무엇인가/,
    });
    act(() => {
      fireEvent.click(question);
    });
    const answered = document.getElementById(
      question.getAttribute("aria-controls") ?? ""
    ) as HTMLElement;
    const toAnswer = within(answered).getByRole("button", {
      name: /^답\s*미룬 이유는 2차 회의 결정에 남아 있다/,
    });
    // 누르면 그 항목으로 가서 펼치고, 그 줄이 보이게 패널 안을 민다 — 그쪽에서는 「답한 질문」이
    // 질문을 가리킨다. jsdom 은 배치를 안 하므로 대상 줄이 패널 위에서 300px 아래에 있다고 둔다.
    const insightRow = within(panel)
      .getByRole("button", { name: /^미룬 이유는 2차 회의 결정에 남아 있다/ })
      .closest("[data-entry]") as HTMLElement;
    const scroller = insightRow.closest(".overflow-y-auto") as HTMLElement;
    vi.spyOn(insightRow, "getBoundingClientRect").mockReturnValue({ top: 300 } as DOMRect);
    vi.spyOn(scroller, "getBoundingClientRect").mockReturnValue({ top: 0 } as DOMRect);
    scroller.scrollTop = 0;
    act(() => {
      fireEvent.click(toAnswer);
    });
    expect(scroller.scrollTop).toBe(288);
    const insight = within(panel).getByRole("button", {
      name: /^미룬 이유는 2차 회의 결정에 남아 있다/,
    });
    expect(insight).toHaveAttribute("aria-expanded", "true");
    const back = document.getElementById(
      insight.getAttribute("aria-controls") ?? ""
    ) as HTMLElement;
    expect(
      within(back).getByRole("button", {
        name: /^답한 질문\s*결제 화면 개편을 미룬 이유는 무엇인가/,
      })
    ).toBeInTheDocument();
  });

  /**
   * **화면 밖이면 쉰다.** 한 번 보고 관찰을 끊어 버리면, 아래로 내려간 뒤에도 16ms 간격
   * 상태 갱신과 큰 트리 두 벌 렌더가 페이지를 떠날 때까지 이어진다.
   */
  it("화면 밖으로 나가면 대본이 멈춘다", () => {
    vi.useFakeTimers();
    render(<ProductShot />);
    // 타임라인에 항목이 하나 더 붙을 때까지 돌린다.
    expect(
      playUntil(
        () => screen.queryAllByRole("button", { name: "전체 6" }).length > 0
      )
    ).toBe(true);

    leaveView();
    const before = screen.getAllByRole("tabpanel")[0].innerHTML;
    play(400);

    expect(screen.getAllByRole("tabpanel")[0].innerHTML).toBe(before);
    // 아직 기록 중이다 — 멈춰 있었다는 뜻이다.
    expect(screen.getAllByText("기록 중").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("중지됨")).toHaveLength(0);
  });

  /**
   * **멈출 수 있어야 한다**(WCAG 2.2.2). 화면에 있는 한 스스로 계속 도는 움직임이고, 모션 줄이기
   * 설정은 이 기준의 수단으로 안 친다. 끝 화면에서 멈춘 사람에게는 반복도 안 온다 — 그 화면을
   * 읽으려는 것이다.
   */
  it("일시정지를 누르면 대본이 그 자리에 서고, 끝 화면에서 멈추면 다시 돌지 않는다", () => {
    vi.useFakeTimers();
    render(<ProductShot />);
    expect(
      playUntil(
        () => screen.queryAllByRole("button", { name: "전체 6" }).length > 0
      )
    ).toBe(true);

    act(() => {
      fireEvent.click(screen.getAllByRole("button", { name: "일시정지" })[0]);
    });
    // 두 벌이 같은 상태를 나눠 쓴다.
    expect(screen.getAllByRole("button", { name: "재생" })).toHaveLength(2);
    const before = screen.getAllByRole("tabpanel")[0].innerHTML;
    play(400);
    expect(screen.getAllByRole("tabpanel")[0].innerHTML).toBe(before);
    expect(screen.queryAllByText("중지됨")).toHaveLength(0);

    act(() => {
      fireEvent.click(screen.getAllByRole("button", { name: "재생" })[0]);
    });
    expect(playToEnd()).toBe(true);
    // 마지막 묶음의 대기(640ms)를 지나 반복 대기가 걸린 뒤에 누른다 — 그 전에 누르면 대본이
    // 끝나지 않은 채 서서, 반복을 막는지는 보지 못한다.
    play(12);

    act(() => {
      fireEvent.click(screen.getAllByRole("button", { name: "일시정지" })[0]);
    });
    // 반복 대기(2.4초)를 한참 넘겨도 끝 화면 그대로다.
    play(100);
    expect(screen.getAllByText("종료됨").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("기록 중")).toHaveLength(0);
  });

  /**
   * 끝난 자리에서 질문을 누르면, 이미 예약된 반복이 답을 지우면 안 된다. 반복 대기가 걸린 뒤에
   * 누르므로, 예약을 안 미루면 답이 끝나고 얼마 안 가 처음으로 돌아가 버린다.
   */
  it("끝난 뒤 질문해도 답이 끝까지 흐르고 한동안 남는다", () => {
    vi.useFakeTimers();
    render(<ProductShot />);
    expect(playToEnd()).toBe(true);
    // 마지막 묶음의 대기(640ms)를 지나 반복 대기가 걸린 뒤에 누른다.
    play(12);

    act(() => {
      fireEvent.click(
        within(
          screen.getAllByRole("group", { name: "예시 질문" })[0]
        ).getAllByRole("button")[0]
      );
    });

    // 답의 **끝**으로 가린다 — 흐르는 중에도 앞부분은 이미 보인다.
    const mine = /정리하자는 말로 회의가 시작됐습니다\./;
    expect(playUntil(() => screen.queryAllByText(mine).length > 0)).toBe(true);

    // 반복을 안 미뤘다면 누른 때부터 2.4초 — 답이 끝나고 1.2초쯤 — 에 처음으로 돌아간다.
    // 미루면 답이 끝난 때부터 다시 2.4초를 재므로 1.5초 뒤에도 끝난 화면 그대로다.
    play(25);
    expect(screen.getAllByText(mine).length).toBeGreaterThan(0);
    expect(screen.getAllByText("종료됨").length).toBeGreaterThan(0);
  });

  it("모션을 줄였으면 대본을 안 돌리고 끝 상태로 둔다", () => {
    window.matchMedia = matchMedia(true);
    render(<ProductShot />);

    // 타이머를 한 번도 안 돌렸는데 이미 끝나 있다.
    expect(screen.getAllByText("종료됨").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("기록 중")).toHaveLength(0);
    expect(selected("요약")).toBe(true);
    expect(screen.getAllByText("검토 중").length).toBeGreaterThan(0);
    expect(screen.getAllByText("검토 완료").length).toBeGreaterThan(0);
    // 돌릴 것이 없으니 다시 보기도 안 낸다.
    expect(
      screen.queryAllByRole("button", { name: /처음부터 다시 보기/ })
    ).toHaveLength(0);
  });
});

describe("ProductShot 탭", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.matchMedia = matchMedia(false);
  });

  /** 앱과 같은 탭이다 — 방향키 · Home · End로 옮기면 선택도 같이 바뀐다(roving tabIndex). */
  it("방향키 · Home · End로 옮기고, 고른 탭만 탭 순회에 든다", () => {
    render(<ProductShot />);
    const list = screen.getAllByRole("tablist", {
      name: "노트 화면 미리 보기",
    })[0];
    const tabs = within(list).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual([
      "정보",
      "스크립트",
      "타임라인",
      "요약",
    ]);
    const current = () =>
      tabs.find((t) => t.getAttribute("aria-selected") === "true");

    expect(current()?.textContent).toBe("스크립트");
    expect(tabs.filter((t) => t.tabIndex === 0)).toEqual([current()]);

    act(() => {
      fireEvent.keyDown(list, { key: "ArrowRight" });
    });
    expect(current()?.textContent).toBe("타임라인");
    expect(document.activeElement).toBe(current());

    act(() => {
      fireEvent.keyDown(list, { key: "End" });
    });
    expect(current()?.textContent).toBe("요약");
    // 끝에서 오른쪽은 처음으로 돈다.
    act(() => {
      fireEvent.keyDown(list, { key: "ArrowRight" });
    });
    expect(current()?.textContent).toBe("정보");
    act(() => {
      fireEvent.keyDown(list, { key: "ArrowLeft" });
    });
    expect(current()?.textContent).toBe("요약");
    act(() => {
      fireEvent.keyDown(list, { key: "Home" });
    });
    expect(current()?.textContent).toBe("정보");
    expect(tabs.filter((t) => t.tabIndex === 0)).toEqual([current()]);

    // 패널은 고른 탭을 가리킨다.
    const panel = document.getElementById(
      current()?.getAttribute("aria-controls") ?? ""
    );
    expect(panel?.getAttribute("aria-labelledby")).toBe(current()?.id);
  });

  /**
   * 대본이 탭을 옮기면 **선택만** 바뀌고 포커스는 그대로다. 방향키가 선택값에서 출발하면, 스크립트에
   * 서 있던 키보드 사용자의 →가 타임라인이 아니라 그 옆의 요약으로 건너뛴다.
   */
  it("방향키는 대본이 고른 탭이 아니라 포커스가 선 탭에서 출발한다", () => {
    vi.useFakeTimers();
    seeImmediately();
    try {
      render(<ProductShot />);
      const script = tab("스크립트");
      act(() => {
        script.focus();
      });
      expect(playUntil(() => selected("타임라인"))).toBe(true);
      expect(document.activeElement).toBe(script);

      act(() => {
        fireEvent.keyDown(script, { key: "ArrowRight" });
      });
      expect(selected("타임라인")).toBe(true);
      expect(document.activeElement).toBe(tab("타임라인"));
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  /**
   * 두 벌이 다 마운트되므로 `id`가 겹치면 `aria-controls`가 숨은 쪽을 가리킨다. 타임라인과
   * 검토 문서에 펼침 관계가 늘어서, 그 화면들에서도 겹치지 않아야 한다.
   */
  it("좁은 화면용과 넓은 화면용의 id가 겹치지 않는다", () => {
    window.matchMedia = matchMedia(true);
    seeImmediately();
    try {
      render(<ProductShot />);
      for (const name of ["타임라인", "요약", "스크립트", "정보"]) {
        act(() => {
          fireEvent.click(tab(name));
        });
        const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
        expect(ids.length).toBeGreaterThan(0);
        expect(new Set(ids).size).toBe(ids.length);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("ProductShot 내 에이전트", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    window.matchMedia = matchMedia(false);
  });

  /** 레일에는 탭이 없다 — 「내 에이전트」 하나라 처음부터 열려 있다. */
  const asks = () =>
    within(
      screen.getAllByRole("group", { name: "예시 질문" })[0]
    ).getAllByRole("button");
  const refs = () =>
    screen.getAllByRole("button", { name: /참고한 회의록/ }).length;
  /**
   * 첫 벌 레일의 대화에 선 질문들, 위에서부터. 예시 질문 칩은 `<button>`이라 `span`만 집으면
   * 말풍선만 남고, 두 벌이 다 마운트돼 있으니 문서 순서로 늘어놓은 앞 절반이 첫 벌이다.
   */
  const thread = () => {
    const all = [SEED, ...ASKS].flatMap(({ q }) =>
      screen.queryAllByText(q, { selector: "span" })
    );
    all.sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );
    return all.slice(0, all.length / 2);
  };
  const said = () =>
    screen
      .getAllByRole("status")
      .map((el) => el.textContent)
      .join("");

  it("레일에 탭이 없고, 준비된 질문을 누르면 그 왕복이 대화에 쌓인다", () => {
    render(<ProductShot />);
    expect(
      screen.queryAllByRole("tab", { name: /내 에이전트|실시간 정리/ })
    ).toHaveLength(0);
    expect(
      screen.getAllByText("나만 보는 대화 · 현재 회의 범위").length
    ).toBeGreaterThan(0);

    // 누르기 전에도 칩 두 벌에 같은 글이 있다 — 그래서 개수의 **차이**를 본다.
    const question = asks()[0].textContent ?? "";
    const before = screen.getAllByText(question).length;
    fireEvent.click(asks()[0]);

    // 질문은 곧바로 선다 — 흐르는 것은 답뿐이다. 두 벌의 레일에 하나씩.
    expect(screen.getAllByText(question)).toHaveLength(before + 2);
  });

  it("먼저 생각하고, 흐르는 동안에는 근거가 안 붙고 다음 질문도 못 보낸다", () => {
    vi.useFakeTimers();
    render(<ProductShot />);
    const buttons = asks();
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
    // 이 회의 하나만 읽은 답이라 처음부터 펴져 있다.
    const latest = screen.getAllByRole("button", {
      name: "참고한 회의록 1개",
    });
    expect(latest.length).toBeGreaterThan(0);
    expect(latest[0]).toHaveAttribute("aria-expanded", "true");
  });

  /** 1건이면 펴 두고 여럿이면 접어 둔다(`chain-of-thought.tsx`의 `AnswerRefs`). */
  it("참고한 회의록이 여럿이면 접혀 있다가 누르면 펴진다", () => {
    render(<ProductShot />);
    const seed = screen.getAllByRole("button", {
      name: "참고한 회의록 2개",
    })[0];
    const chips = document.getElementById(
      seed.getAttribute("aria-controls") ?? ""
    );
    expect(seed).toHaveAttribute("aria-expanded", "false");
    expect(chips?.hidden).toBe(true);

    fireEvent.click(seed);
    expect(seed).toHaveAttribute("aria-expanded", "true");
    expect(chips?.hidden).toBe(false);
    expect(chips?.textContent).toContain("2차 스프린트 킥오프");
  });

  it("모션을 줄였으면 생각도 흐름도 없이 통째로 세운다", () => {
    window.matchMedia = matchMedia(true);
    vi.useFakeTimers();
    render(<ProductShot />);
    const buttons = asks();
    const before = refs();

    act(() => {
      fireEvent.click(buttons[2]);
    });

    // 타이머를 한 번도 안 돌렸는데 근거가 이미 서 있다.
    expect(refs()).toBeGreaterThan(before);
    expect(screen.queryByText("생각하는 중")).toBeNull();
    expect(buttons[0]).not.toBeDisabled();
  });

  /**
   * 대화는 **시간 순서로** 쌓인다. 대본의 질의를 늘 방문자 것 앞에 끼우면, 먼저 물은 왕복 위로
   * 나중 질문이 들어와 흐르는 답이 대화 끝에서 떨어지고(바닥 따라가기가 끝난 답에 붙는다),
   * 차례로 지은 `key`가 바뀌어 방문자의 왕복이 다시 마운트된다.
   */
  it("먼저 물은 왕복은 제자리에 남고, 대본의 질의는 그 아래에서 흐른다", () => {
    vi.useFakeTimers();
    seeImmediately();
    render(<ProductShot />);

    act(() => {
      fireEvent.click(asks()[0]);
    });
    // 칩이 다시 풀리면 답이 끝난 것이다.
    expect(playUntil(() => !asks()[0].hasAttribute("disabled"))).toBe(true);
    expect(thread().map((q) => q.textContent)).toEqual([SEED.q, ASKS[0].q]);
    const mine = thread()[1];

    expect(
      playUntil(() => screen.queryAllByText(/결정 둘입니다/).length > 0)
    ).toBe(true);
    expect(thread().map((q) => q.textContent)).toEqual([
      SEED.q,
      ASKS[0].q,
      ASKS[2].q,
    ]);
    // 방문자의 왕복은 같은 노드 그대로다 — 다시 마운트되지 않았다.
    expect(thread()[1]).toBe(mine);
    // 흐르는 커서는 마지막 왕복에 있다.
    const turnOf = (q: HTMLElement) => q.closest("[data-turn]");
    expect(turnOf(thread()[2])?.querySelector(".lp-caret")).not.toBeNull();
    expect(turnOf(mine)?.querySelector(".lp-caret")).toBeNull();
  });

  it("방문자가 대본과 같은 질문을 먼저 했으면 대본은 다시 묻지 않는다", () => {
    vi.useFakeTimers();
    seeImmediately();
    render(<ProductShot />);

    act(() => {
      fireEvent.click(asks()[2]);
    });
    // 대본의 질의 대목을 지나 회의가 멈출 때까지.
    expect(
      playUntil(() => screen.queryAllByText("중지됨").length > 0)
    ).toBe(true);
    expect(thread().map((q) => q.textContent)).toEqual([SEED.q, ASKS[2].q]);
  });

  /**
   * 스크린 리더는 **방문자가 보낸 답만, 다 흐른 뒤에 한 번** 듣는다. 대화 전체를 live 영역으로
   * 두면 아무도 안 누른 대본의 질의가 바퀴마다 끼어든다.
   */
  it("알림은 방문자가 보낸 답이 끝난 뒤에만 오고, 대본의 질의는 알리지 않는다", () => {
    vi.useFakeTimers();
    seeImmediately();
    render(<ProductShot />);
    expect(said()).toBe("");

    act(() => {
      fireEvent.click(asks()[0]);
    });
    // 흐르는 동안은 비어 있다 — 반쯤 적힌 문장을 읽히지 않는다.
    expect(said()).toBe("");
    expect(playUntil(() => !asks()[0].hasAttribute("disabled"))).toBe(true);
    expect(said()).toContain(ASKS[0].a);

    // 대본의 질의는 생각하는 동안에도, 다 흐른 뒤에도 알리지 않는다.
    expect(
      playUntil(() => screen.queryAllByText("생각하는 중").length > 0)
    ).toBe(true);
    expect(said()).toBe("");
    expect(
      playUntil(() => screen.queryAllByText("중지됨").length > 0)
    ).toBe(true);
    expect(said()).toBe("");
    expect(said()).not.toContain(ASKS[2].a);
  });

  /**
   * codex가 잡은 자리다. 대본의 `ask` 대목은 손수 보낸 답이 흐르는 동안 **진행**만 멈추고
   * **진입**은 막지 않았다 — 앞 대목의 예약이 이미 걸려 있으면 커서는 그대로 `ask`로
   * 들어온다. 그러면 흐르는 진행값은 손수 답 하나뿐이라 대본 답을 가리키는 것이 없어서,
   * 대본 답이 **완성본으로** 떴다가 손수 답이 끝나는 순간 「생각하는 중」으로 되감겼다.
   */
  it("손수 보낸 답이 흐르는 동안 대본 답이 완성본으로 새치기하지 않는다", () => {
    vi.useFakeTimers();
    seeImmediately();
    render(<ProductShot />);

    // 대본의 질의 바로 앞 대목(마지막 발화)에 들어선 때를 독의 타이머로 안다.
    expect(
      playUntil(() => screen.queryAllByText("01:48").length > 0)
    ).toBe(true);
    // 마지막 발화가 흐르는 중에 손수 묻는다 — 대본이 질의로 넘어갈 때도 답이 흐르고 있게.
    play(8);
    const buttons = asks();
    act(() => {
      fireEvent.click(buttons[1]);
    });

    // 마지막 발화가 끝나 대본이 `ask`로 넘어갈 만큼 당긴다(글자 32개 + 대기 560ms).
    play(40);

    // 칩이 아직 잠겨 있으면 손수 답이 흐르는 중이다 — 겹치는 그 순간이 맞다.
    expect(buttons[0]).toBeDisabled();
    expect(screen.queryAllByText(/결정 둘입니다/)).toHaveLength(0);

    // 손수 답이 끝나면 대본의 질의가 그제야 처음부터(생각하는 중부터) 흐른다.
    expect(
      playUntil(() => screen.queryAllByText(/결정 둘입니다/).length > 0)
    ).toBe(true);
  });
});
