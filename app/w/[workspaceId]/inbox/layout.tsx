import { InboxDialogShell } from "@/components/notification/inbox-dialog-shell";

export default async function InboxLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  return (
    <InboxDialogShell workspaceId={workspaceId}>{children}</InboxDialogShell>
  );
}
