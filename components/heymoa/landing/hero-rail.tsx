"use client";

import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";

import { THINKING, TITLE, type Demo } from "@/components/heymoa/landing/use-demo";
import { cn } from "@/lib/utils";

import { Composer, ScopeChip, ThreadTitle, UserBubble } from "./app";
import { AnswerRefs } from "./app-client";
import { APP, MARKER_DRAW } from "./tokens";

/*
 * 히어로의 「내 에이전트」 창(`note-agent-rail.tsx` · `personal-chat.tsx` · `chat-thread.tsx` ·
 * `chain-of-thought.tsx` · `chat-composer.tsx`). 노트 창 옆에 **따로 선 패널**이다 — 앱도 두 패널을
 * 나란히 세우고 서로 감싸지 않는다. 창 안 = `--el-*` 만, 창 위 형광펜만 페이지의 것(`--tv-*`).
 *
 * 예시 질문 칩은 두지 않는다. 앱은 빈 대화에만 세우고, 이 대화는 처음부터 한 왕복(`SEED`)이 서
 * 있다. 눌러 묻는 자리는 아래 「물어보기」 구간이 맡는다.
 *
 * 대화 제목 줄(`ThreadTitle`)은 lg 이상 · 높이 890 초과에서만 선다(잘라 보이기). 낮은 노트북(1366×650 의 창
 * 321 · 1280×720 · 1366×768)에서 그 52px 이 답 둘째 줄과 「참고한 회의록」 줄을 입력창 밑으로 밀어냈다.
 */

/**
 * 레일 머리(`note-agent-rail.tsx`). 물어보는 장면에서만 「나만 보는 대화」 밑에 형광펜이 칠해진다(창 위
 * 주석). 오른쪽 끝의 접기 아이콘은 잘라 보이기로 뺐다 — 312px 레일에서 그 자리를 비워야 「현재 회의
 * 범위」까지 말줄임 없이 선다. 형광펜의 `-mx-1 px-1` 은 서로 상쇄돼 칠이 붙었다 빠져도 글자가 안 움직인다.
 * 「나만 보는 대화 · 현재 회의 범위」는 앱의 muted-soft 대신 `APP.muted` 다 — 범위를 말하는 정보 글자라
 * 흰 바탕 4.5:1 을 넘겨야 한다(`hero-note.tsx` 머리 주석과 같은 규칙).
 */
function RailHead({ marked }: { marked: boolean }) {
  return (
    <div className={cn("flex h-11 shrink-0 items-center gap-2 border-b px-4 lg:h-12", APP.line)}>
      <Sparkles aria-hidden className={cn("size-[15px] shrink-0", APP.ink)} />
      <span className={cn("shrink-0 text-[13px] font-semibold", APP.ink)}>내 에이전트</span>
      <span className={cn("min-w-0 truncate text-[12px]", APP.muted)}>
        <span className={marked ? cn(MARKER_DRAW, APP.ink) : undefined}>나만 보는 대화</span>
        {" · 현재 회의 범위"}
      </span>
    </div>
  );
}

/**
 * 대화는 **방금 보낸 질문을 맨 위에 붙인다**(`personal-chat.tsx` 의 `pinSlackPx`). 마지막 왕복 아래에
 * 대화창 높이만큼 자리를 남겨 두고 그 질문의 머리로 올린다 — 바닥을 따라가면 좁은 창에 답의 꼬리만
 * 남고, 질문은 위로 잘려 나간다. 답은 그 아래로 흐른다. 바닥 14px 은 흐려 칩이 입력창 윗선에 칼로 잘린 듯
 * 보이지 않게 한다.
 *
 * **방금 물은 답이 다 흐르면(`done`) 「참고한 회의록」 줄의 바닥이 대화창 바닥 여백 위에 오도록 한 번 더
 * 굴린다** — 질문 머리는 위로 넘어가도 된다. 낮은 창(1366×650 의 레일 321)에서는 그 줄이 입력창 밑에 숨어서,
 * 바깥 손글씨 「답 아래엔 참고한 회의록이 붙어요」가 빈자리(입력창의 범위 칩)를 가리켰다. 다 들어가는 창에서는
 * 붙인 자리 그대로다. 처음부터 서 있는 왕복(`SEED`)은 굴리지 않는다. `scrollTop` 만 쓴다(페이지는 끌지 않는다).
 */
function usePinLast(count: number, done: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  /** 마지막으로 굴려 둔 자리와 그때의 왕복 수 — 같은 왕복에서 그 자리를 벗어났으면 방문자가 옮긴 것이다. */
  const placed = useRef({ count: -1, top: 0 });
  useEffect(() => {
    const el = ref.current;
    const last = el?.lastElementChild;
    if (!el || !(last instanceof HTMLElement)) return;
    const top = parseFloat(getComputedStyle(el).paddingTop) || 0;
    const bottom = parseFloat(getComputedStyle(el).paddingBottom) || 0;
    el.style.setProperty("--slack", `${el.clientHeight - top - bottom}px`);
    const pin = count > 1 ? last.offsetTop - top : 0;
    const end = last.lastElementChild;
    const fit =
      count > 1 && done && end instanceof HTMLElement
        ? end.offsetTop + end.offsetHeight + bottom - el.clientHeight
        : 0;
    // 답이 다 흘러 한 번 더 굴릴 때, 그새 방문자가 위로 올려 앞 답을 읽고 있으면 그 자리를 둔다.
    if (count === placed.current.count && Math.abs(el.scrollTop - placed.current.top) > 2) return;
    el.scrollTop = Math.max(pin, fit);
    placed.current = { count, top: el.scrollTop };
  }, [count, done]);
  return ref;
}

export function HeroRail({ demo, asking }: { demo: Demo; asking: boolean }) {
  const { turns, typing, typingAt } = demo;
  /**
   * 답이 다 흘렀는가. 대본은 다 흐른 뒤에도 잠시 진행값을 쥔 채 머무르므로(`HOLD.ask`) `typing` 이 null 이
   * 되기를 기다리면 「참고한 회의록」이 다음 장면에야 붙는다. 글자가 끝나면 끝난 것으로 본다.
   */
  const streaming =
    typing !== null && typingAt >= 0 && typing < (turns[typingAt]?.a.length ?? 0);
  const threadRef = usePinLast(turns.length, !streaming);
  const chip = <ScopeChip kind="note" title={TITLE} />;

  return (
    <>
      <RailHead marked={asking} />
      <ThreadTitle
        title="결제 화면 개편을 미룬 이유"
        className="hidden pl-4 lg:flex lg:[@media(max-height:890px)]:hidden"
      />
      {/* `data-view` — 바닥 흐림 폭. 무대가 「참고한 회의록」 줄이 보이는 칸 안에 들었는지 잴 때 쓴다. */}
      <div
        ref={threadRef}
        data-view="14"
        className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-4 [mask-image:linear-gradient(to_bottom,#000_calc(100%-14px),transparent)] lg:pt-4"
      >
        {turns.map((turn, i) => {
          const running = streaming && i === typingAt;
          return (
            <div
              key={turn.key}
              // 처음부터 서 있는 왕복(`SEED`)은 안 든다 — 창이 뜰 때 이미 있다. 마지막 왕복은 대화창
              // 높이만큼 자리를 잡는다(위 `usePinLast`).
              className={cn(
                "flex shrink-0 flex-col gap-2.5 last:min-h-[var(--slack,0px)]",
                i > 0 && "chat-rise"
              )}
            >
              <UserBubble chip={chip}>{turn.q}</UserBubble>
              {running && typing === THINKING ? (
                <p className="chat-shimmer m-0 text-[14px]">생각하는 중</p>
              ) : (
                // 답(`markdown.tsx` 본문 — 말풍선 없음). 흐르는 동안은 반쯤 적힌 문장을 읽히지 않는다.
                <p
                  aria-hidden={running || undefined}
                  className={cn("m-0 text-[14px] leading-[1.65] break-keep", APP.body)}
                >
                  {running ? turn.a.slice(0, typing ?? 0) : turn.a}
                  {running ? (
                    <span
                      aria-hidden
                      className="tv-caret ml-0.5 inline-block h-4 w-px bg-[var(--el-muted)] align-middle"
                    />
                  ) : null}
                </p>
              )}
              {/* 근거는 답이 끝난 뒤에 선다(`chat-thread.tsx`). 한 건이면 펴 두고 여럿이면 접는다. 마지막
                  왕복의 것은 `data-refs` — 무대의 손글씨 화살표가 그 줄을 재서 가리킨다(`hero-stage.tsx`). */}
              {running || turn.refs.length === 0 ? null : (
                <div data-refs={i === turns.length - 1 ? "" : undefined}>
                  <AnswerRefs refs={turn.refs} className={i > 0 ? "chat-rise" : undefined} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* 입력창은 앱처럼 창 양옆 20(lg 16) · 바닥 16 안쪽에 선다(`chat-composer.tsx` 의 `px-5 py-4`). 앱의
          입력창은 hairline 선 상자지만 **여기는 선 대신 옅은 면이다** — 창 테와 둥근 선이 16~20px 안쪽에
          나란히 서서 테두리 두 겹으로 읽혔다(화면 규칙 1, 간격을 12 → 20 으로 넓혀도 24 안쪽이라 같았다).
          아래 물어보기 구간(`ask-chat.tsx`)의 입력창과 같은 모양이다. */}
      <Composer
        chip={chip}
        busy={streaming}
        className="mx-5 mb-4 border-transparent bg-[var(--el-canvas)] lg:mx-4"
      />
    </>
  );
}
