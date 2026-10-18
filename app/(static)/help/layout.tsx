import { helpGroups } from "@/app/(static)/help/_content/groups";
import { helpTopics } from "@/app/(static)/help/_content/topics";
import { HelpMotion } from "@/components/help/help-motion";
import { HelpSidebar } from "@/components/help/help-sidebar";
import { HELP_VARS } from "@/components/help/help-vars";

/**
 * 사용 가이드 셸. 상단바(검색 · 탭)는 `<main>` 밖의 `NavbarGate` 가 세우고, 여기서는 상단바 아래 전체 높이로 붙는 사이드바와
 * 페이지 칸을 놓는다. 화면 폭을 거의 다 쓴다 — 사이드바는 왼쪽 끝에 붙고 바깥 상한은 초광폭(1800)에서만 걸린다.
 * 레이아웃이라 페이지를 옮겨도 사이드바가 다시 그려지지 않는다(스크롤 위치 유지). 모션 배선도 여기 한 곳이다.
 * 사이드바에는 제목만 넘긴다 — 본문(React 노드)이 클라이언트 번들로 넘어가지 않게.
 */
export default function HelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const topics = helpTopics.map(({ slug, group, title }) => ({
    slug,
    group,
    title,
  }));
  return (
    <div
      style={HELP_VARS}
      data-help-root=""
      className="w-full flex-1 bg-white text-[var(--tv-ink)]"
    >
      <HelpMotion />
      <div className="mx-auto flex w-full max-w-[1800px]">
        <HelpSidebar groups={helpGroups} topics={topics} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
