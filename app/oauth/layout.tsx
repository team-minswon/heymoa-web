/** 외부 에이전트 인가 흐름(APP-888)의 화면 — 카드 하나를 가운데 세운다. 초대 화면과 같은 틀이다. */
export default function AgentOAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--el-canvas)] p-4 text-[var(--el-ink)]">
      {children}
    </main>
  );
}
