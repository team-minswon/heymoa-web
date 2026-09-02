/**
 * 랜딩 섹션이 공유하는 치수. 아트보드 1440의 값을 그대로 옮겼다.
 *
 * **세로 리듬은 위 여백이 만든다.** TA 원본은 섹션마다 위 104 / 아래 0이고, 섹션 사이 간격은
 * 다음 섹션의 위 여백이 낸다. 위아래를 대칭으로 주면 그 사이가 두 배로 벌어진다 — 한 번
 * 겪었다. 아래 여백이 필요한 곳은 흰 밴드(작동 방식)와 제품 화면 둘뿐이다.
 */
export const SECTION_X = "px-5 lg:px-10";

/** 본문 폭. 1440에서 좌우 40을 빼고 남는 1120에 맞춘 안쪽 기둥이다. */
export const CONTAINER = "mx-auto w-full max-w-[1120px]";

/** 섹션 위 여백 — 모바일 64 / 데스크톱 104. */
export const SECTION_TOP = "pt-16 lg:pt-[104px]";

/**
 * 화자마다 다른 원 색. 제품 샷의 22px 원과 「기능 소개」 카드의 18px 원이 같은 값을 쓴다 —
 * 두 곳이 갈리면 같은 사람이 화면마다 다른 색이 된다.
 *
 * 더 작은 목업(`mocks.tsx`의 17px)은 이 지도를 안 쓴다. 그 크기에서는 색만 튀고 누가
 * 누구인지는 안 읽혀서 시안도 한 색으로 통일했다.
 */
export const SPEAKER_TINT: Record<string, string> = {
  김민서: "#366c4f",
  박지훈: "#8a5a3c",
  이서연: "#3d5a80",
  정우재: "#7a4a63",
};

/**
 * 초록 eyebrow. 섹션마다 하나씩 붙고, 무엇을 말하는 자리인지만 표시한다.
 * 대비 5.8:1 (#366c4f on #faf8f5).
 */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 text-[13px] font-semibold tracking-[0.4px] text-[var(--lp-green)]">
      {children}
    </p>
  );
}

/** 섹션 제목 — 모바일 26 / 데스크톱 46. `text-balance`로 마지막 줄 홀로 남기를 막는다. */
export function SectionTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`m-0 mt-3 text-balance break-keep text-[26px] font-extrabold leading-[1.28] tracking-[-0.9px] text-[var(--lp-ink)] lg:mt-3.5 lg:text-[46px] lg:leading-[1.2] lg:tracking-[-1.6px] ${className}`}
    >
      {children}
    </h2>
  );
}

/** 섹션 리드 문단 — 제목 아래 한 문단. 데스크톱에서 640으로 묶어 한 줄이 80자를 넘지 않게 한다. */
export function SectionLead({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 mt-3.5 max-w-[640px] break-keep text-[16px] leading-[1.75] text-[var(--lp-body)] lg:mt-4">
      {children}
    </p>
  );
}
