/**
 * 외부 에이전트 인가 흐름(APP-888)의 화면 — 카드 하나를 가운데 세운다. 초대 화면과 같은 틀이다.
 * 머리글 · 발(`isFocusChromeRoute`)이 흐름 안에 서므로 화면 전체 높이가 아니라 그 사이를 채운다.
 */
export default function AgentOAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center bg-[var(--el-canvas)] p-4 text-[var(--el-ink)]">
      {children}
    </main>
  );
}
