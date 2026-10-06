import { ArrowDown } from "lucide-react";

import { LandingCta } from "@/components/heymoa/landing-cta";
import { cn } from "@/lib/utils";

import { HeroStage } from "./hero-stage";
import { Speech } from "./marks";
import { CONTAINER, FOCUS, H1, LEAD, MARKER_DRAW, vars } from "./tokens";

/**
 * 히어로. tl;dv 의 「농담 한 줄 + 큰 제목 + 바로 아래 제품 화면」 구성을 가져왔다. 농담은 한국 회사의
 * 회의록 당번 장면(두 사람의 말풍선, 얼굴만 있고 이름은 없다)이고, 제목은 「받아 적던 손」이다.
 *
 * 데스크톱은 머리를 좌우로 나눴다 — 왼쪽에 농담과 두 줄 제목, 오른쪽에 리드와 버튼. 그래야 1440×900 에서
 * **혼자 도는 창 전체가 스크롤 없이 첫 화면에 들어온다**(높이 계산은 아래). 창 안은 앱 그대로이고, 페이지의
 * 손맛(쪽지 · 화살표 · 색 면)은 창 밖에서 낸다(`hero-stage.tsx`).
 *
 * 버튼 밑의 「따로 설치할 건 없습니다. 마이크만 허용해 주세요.」 안내는 뺐다 — 랜딩에서 「설치할
 * 것 없음 · 신용카드 없음」 류 문구는 빼기로 했다(72f4c27). 오른쪽 열은 리드와 버튼만 남아 제목 바닥에 맞춰 선다.
 *
 * 높이는 **브라우저의 보이는 높이**로 잰다(기기 화면 크기가 아니다 — 탭 · 주소창 · 작업표시줄 · Safari
 * 툴바를 뺀 높이). 창 높이 셈은 `hero-stage.tsx` 의 `WINDOW_H`.
 *
 * - 1440×900: 상단 바 64 → pt 24 → 머리 ≈ 203(왼쪽 = 말풍선 45 + 20 + 제목 64px 두 줄 138 이 더 높다,
 *   오른쪽 = 리드 두 줄 58 + 24 + 버튼 52 = 134) → 무대 mt 32 → 무대 pt 56(「예시 회의」 테이프와 일시정지가
 *   서는 띠) → 창 500 ⇒ 창 바닥 ≈ 879.
 * - 높이 721~890(1366×768 · 1280×800 · 1440×790): 말풍선 위 여백은 그대로 24 다 — 8 로 줄였더니 기운
 *   말풍선 모서리가 상단 바 선 5px 아래에 붙었다. 대신 박지훈 말풍선의 늘어뜨림(−12)을 거두고 제목 위를
 *   20 → 8 로 줄여 그만큼 되찾는다(말풍선과 제목 글자 사이 약 13px 은 그대로, 무대 위 12 도 그대로 — 더
 *   줄이면 창 위 띠의 「② 그다음 회의 종료」 쪽지가 히어로 버튼에 닿는다) — 머리 191, 창 위끝 ≈ 347.
 * - 높이 720 이하(1366×650 — 1366×768 노트북의 Chrome 이 실제로 보이는 높이 · 1280×700): 제목을 52px 로
 *   줄여(lg 와 같은 크기) 머리 ≈ 165, 창 위끝 ≈ 321 ⇒ 1366×650 에서 창 321(바닥 642) — 독 · ① 쪽지의 화살표
 *   · 검토 막대와 그 쪽지까지 첫 화면에 든다.
 *
 * 모바일은 보조 링크 「예시 회의 먼저 보기」를 lg 미만에서 뺐다(회의 카드 구간이 바로 아래다). 390 은 버튼 바닥
 * ≈ 392, 무대 mt 24, 창 위끝 ≈ 472. 실제 휴대폰 브라우저는 툴바 때문에 390×664(아이폰 Safari) · 375×553(SE)
 * 처럼 낮아서, **높이 700 이하에서는** 머리 사이 여백(제목 · 리드 위 12 → 8, 버튼 위 20 → 16, 무대 위
 * 24 → 16)을 줄여 창 위끝을 ≈ 452 로 올린다. 대본은 창 위끝에서 64px(상단바 + 탭 글자)이 보이면 돌기
 * 시작한다(`hero-stage.tsx` 감시 점). 말풍선 위 24 는 줄이지 않는다(상단 바에 붙는다).
 *
 * **높이 600 이하(375×553 SE)는 한 단 더 줄인다** — 제목 34 → 30px(≈ 8), 버튼 52 → 44(8), 리드 위 8 → 4 · 버튼
 * 위 16 → 12(8), 무대 위 띠 56 → 48(8, `hero-stage.tsx`) ⇒ 창 위끝 ≈ 420. 예전(≈ 452)에는 첫 화면에 창 상단바와
 * 탭 줄(바닥 ≈ 536)만 들어, 움직임이 자막 교체와 탭 밑줄 한 번이 전부였다 — 0.18초 간격 비교로 5.2→11.7초 ·
 * 12.5→18.4초에 바뀐 픽셀이 거의 0 이었다. 이제 본문 위 ≈ 50px(타임라인 · 스크립트의 맨 위 줄 머리)이 들어,
 * 새 줄이 붙어 목록이 굴러갈 때마다 첫 화면에서도 보인다. 줄 하나를 다 넣으려면 60px 이 더 필요한데, 그만큼은
 * 당번 농담(말풍선 둘 — 한 줄에 나란히 서지 않는다)이나 버튼을 걷어야 해서 여기서 멈췄다. 제목 · 말풍선 사이
 * (8)와 무대 위(16, 원 조각이 버튼에 닿는다)는 그대로다. 700 단과 겹치는 여백은 높이 범위로 가른다(Tailwind 가
 * 600 단을 먼저 내보내 700 단이 이긴다 — `hero-stage.tsx` `WINDOW_H` 주석).
 */
export function Hero() {
  return (
    <section className="overflow-visible pb-14 lg:pb-24">
      <div
        className={cn(
          CONTAINER,
          "relative z-10 pt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-end lg:gap-10"
        )}
      >
        <div>
          <div className="flex flex-col items-start gap-1 lg:flex-row lg:items-end lg:gap-3">
            <Speech who="김민서" tone="butter" tilt={-2} anim="pop">
              이번 주 회의록 당번 누구예요?
            </Speech>
            <Speech
              who="박지훈"
              side="right"
              tone="white"
              size="sm"
              tilt={3}
              anim="pop"
              delay={600}
              className="-mt-1 ml-16 lg:mt-0 lg:-mb-3 lg:ml-0 lg:[@media(max-height:890px)]:mb-0"
            >
              저… 지난주에 했는데요
            </Speech>
          </div>
          {/* 줄은 「회의에서 받아 적던 손, / 이제 쉬어도 됩니다」로만 갈린다(320 은 「회의에서」가 먼저 떨어진다). */}
          <h1
            className={cn(
              H1,
              "mt-3 max-lg:[@media(max-height:600px)]:text-[30px] max-lg:[@media(max-height:700px)]:mt-2 lg:mt-5 lg:text-[52px] lg:[@media(max-height:890px)]:mt-2 xl:text-[64px] xl:[@media(max-height:720px)]:text-[52px]"
            )}
          >
            회의에서 <span className="whitespace-nowrap">받아 적던 손,</span>{" "}
            <span className="whitespace-nowrap">
              이제{" "}
              <span className={MARKER_DRAW} style={vars({ "--d": "300ms" })}>
                쉬어도
              </span>{" "}
              됩니다
            </span>
          </h1>
        </div>

        <div className="mt-3 max-lg:[@media(max-height:600px)]:mt-1 max-lg:[@media(min-height:601px)_and_(max-height:700px)]:mt-2 lg:mt-0">
          {/* 「누가」는 회의 뒤의 일이다 — 회의 중 스크립트 · 타임라인에는 화자가 없고, 끝나면 「화자 A」로
              갈린다(아래 창도 그렇게 돈다). 「몇 분에 누가」는 이 리드가 하는 말이다(아래 근거 구간 리드는 하지
              않는다). **리드는 그 사실까지만 말하고, 「훑어보고 검토 완료」 · 「프로젝트에 올린다」는 말하지
              않는다** — 그 이야기는 창 옆 쪽지(xl, 「훑어보고, 맞으면 검토 완료 / 누르기 전엔 프로젝트에 안
              올라가요」)와 자막(xl 미만, 「맞으면 검토 완료」)이 마지막 장면에서 한다. 리드가 「맞는지 확인하고
              프로젝트에 올리세요」(넓은 판) · 「끝나면 훑어보고 검토 완료를 누르세요」(좁은 판)로 같은 말을 먼저 해서
              한 히어로에서 두 번이 됐다(공통 규칙 5).
              오른쪽 열이 왼쪽(203 · 높이 890 이하 191 · 720 이하 165)보다 높아지면 창이 그만큼 밀린다 — 지금 두
              줄이라 더 낮다. 좁은 판은 「회의가」를 빼 390 에서도 두 줄(「…할 일을 / 골라 둡니다. 끝나면 …」)이다 —
              세 줄이 되면 창이 28px 밀리니 렌더에서 확인한다. 「누가 한 말인지」는 낱말 사이에서 갈리지 않게 묶는다.
              **시각은 회의 중에도 붙는다**(스크립트 · 타임라인 모두) — 회의 뒤에 더해지는 것은 화자 나누기뿐이라
              「화자와 시각까지 붙는다」고 쓰면 아래 창(기록 중에도 00:14 · 01:02 가 보인다)과 어긋난다. */}
          <p className={cn(LEAD, "lg:text-[17px] lg:leading-[1.7]")}>
            말하는 동안 HeyMoa가 받아 적고 결정과 할 일을{" "}
            <span className="whitespace-nowrap">골라 둡니다.</span>{" "}
            <span className="hidden sm:inline">회의가 </span>끝나면{" "}
            <b className="font-bold whitespace-nowrap text-[var(--tv-ink)]">누가 한 말인지</b>도 갈라 둡니다.
          </p>
          <div className="mt-5 flex flex-col gap-2 max-lg:[@media(max-height:600px)]:mt-3 max-lg:[@media(min-height:601px)_and_(max-height:700px)]:mt-4 lg:mt-6 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-5 lg:gap-y-2">
            {/* 포커스 링은 보라 outline(`FOCUS`) 하나다 — `Button` 기본의 `focus-visible:border-ring` ·
                `ring-3` 을 끈다(`top-bar.tsx` · `closing.tsx` 와 같은 처리). 안 끄면 회색 링이 한 겹 더 붙는다. */}
            <LandingCta
              label="Google 계정으로 시작"
              className={cn(
                "h-[52px] w-full justify-center gap-2 max-lg:[@media(max-height:600px)]:h-11 border-transparent bg-[var(--tv-brand)] px-6 text-[15px] font-bold text-white hover:bg-[var(--tv-brand-deep)] focus-visible:border-transparent focus-visible:ring-0 lg:w-auto lg:px-5",
                FOCUS
              )}
            />
            {/* 보조 길은 글자 링크다 — 오른쪽 열(400px)에 알약 둘이 한 줄로 서지 않는다. */}
            <a
              href="#meetings"
              className={cn(
                "hidden h-11 items-center gap-1.5 self-start rounded-[6px] lg:inline-flex text-[15px] font-bold text-[var(--tv-ink)] underline decoration-[var(--tv-pop)] decoration-[3px] underline-offset-[5px] transition-colors hover:decoration-[var(--tv-brand)] lg:self-auto",
                FOCUS
              )}
            >
              예시 회의 먼저 보기
              <ArrowDown aria-hidden className="size-4" />
            </a>
          </div>
        </div>
      </div>

      <HeroStage />
    </section>
  );
}
