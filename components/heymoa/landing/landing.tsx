import { Ask } from "./ask";
import { Closing } from "./closing";
import { Evidence } from "./evidence";
import { Faq } from "./faq";
import { Hero } from "./hero";
import { MeetingCards } from "./meeting-cards";
import { TvMotionStyles } from "./motion";
import { Safety } from "./safety";
import { Team } from "./team";
import { TV_VARS } from "./tokens";
import { WorksWith } from "./works-with";

/**
 * 랜딩(`/`). 비슷한 서비스 랜딩 일곱 판을 비교해 고른 tl;dv 참고 시안을 옮겼다(APP-931).
 *
 * tl;dv 에서 가져온 것: 농담으로 여는 톤, 회의 종류별 카드 줄, 장면별 질문 카드, 색 면 하나로 닫는
 * CTA, 접이식 FAQ, 노란 쪽지, 형광펜.
 *
 * 일부러 바꾼 것: 후기 · 수상 · 로고 · 사용자 수 · 인증 배지 · ROI 계산기 · 플랫폼 아이콘 · 다국어는
 * HeyMoa 에 없어서 뺐고, 그 자리를 앱 그대로의 화면 조각과 확인된 사실로 채웠다. 창 안은 앱 색
 * (`--el-*` · 역할 색)이고, 이 페이지 팔레트(`--tv-*`)는 창 밖과 창 위 주석에만 쓴다. 히어로 창은
 * 기존 랜딩의 `use-demo` 대본으로 혼자 회의 한 바퀴를 돈다.
 *
 * 순서: 상단 바 → 히어로 → 회의 카드 → 근거 → 팀 → 물어보기 → 나가는 길 → FAQ → 어디서든 켜 두기 띠 → 마무리 →
 * 예시 고지. 푸터는 루트 레이아웃의 마케팅 `Footer`(약관 · 개인정보 링크)다 — 그래서 고지는 `<footer>` 가 아닌
 * 문단이다(겹치면 contentinfo 가 둘이 된다). 상단 바(`top-bar.tsx`)는 여기 없다 — `NavbarGate` 가 `/` 에서
 * 마케팅 `Navbar` 대신 `<main>` 밖에 세운다. 안에 두면 「본문으로 건너뛰기」 다음 Tab 이 다시 상단 바로 간다.
 * 바탕은 흰색 하나이고 색 면은 각 구간이 깐다. `overflow-x-clip` 은 기울인 쪽지 · 원 · 카드가 가로
 * 스크롤을 만들지 않게 하는 안전망이다(`hidden` 과 달리 sticky 상단 바를 깨지 않는다).
 * 여기서 `<main>` 을 따로 두지 않는 것은 루트 레이아웃이 이미 `<main id="main">` 으로 감싸서다
 * (겹치면 main 이 둘이 된다).
 */
export function Landing() {
  return (
    <div
      className="tv-root w-full overflow-x-clip bg-white font-sans text-[var(--tv-ink)]"
      style={TV_VARS}
    >
      <TvMotionStyles />
      <Hero />
      <MeetingCards />
      <Evidence />
      <Team />
      <Ask />
      <Safety />
      <Faq />
      <WorksWith />
      <Closing />
      <p className="m-0 bg-[var(--tv-paper)] px-5 pt-8 pb-4 text-center text-[13px] leading-[1.6] break-keep text-[var(--tv-muted)]">
        이 페이지의 회의, 인물, 날짜는 모두 지어낸 예시입니다.
      </p>
    </div>
  );
}
