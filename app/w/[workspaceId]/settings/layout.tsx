import { SettingsDialogShell } from "@/components/settings/settings-dialog-shell";

/**
 * 설정 절 여섯은 라우트지만 화면은 워크스페이스 위에 뜬 다이얼로그 하나다.
 * 절이 바뀌어도 다이얼로그는 안 사라진다 — 이 layout 이 안 갈리기 때문이다.
 */
export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  return (
    <SettingsDialogShell workspaceId={workspaceId}>
      {children}
    </SettingsDialogShell>
  );
}
