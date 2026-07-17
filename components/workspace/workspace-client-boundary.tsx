"use client";

import dynamic from "next/dynamic";

import { WorkspaceAppLoading } from "@/components/workspace/workspace-app-loading";

const ClientWorkspaceRoute = dynamic(
  () =>
    import("@/components/workspace/workspace-route-client").then(
      (module) => module.WorkspaceRouteClient
    ),
  {
    loading: WorkspaceAppLoading,
    ssr: false,
  }
);

const ClientNoteRoute = dynamic(
  () =>
    import("@/components/notes/note-route-client").then(
      (module) => module.NoteRouteClient
    ),
  {
    loading: WorkspaceAppLoading,
    ssr: false,
  }
);

export function WorkspaceClientBoundary({
  workspaceId,
}: {
  workspaceId: string;
}) {
  return <ClientWorkspaceRoute workspaceId={workspaceId} />;
}

export function NoteClientBoundary({
  workspaceId,
  noteId,
  initialQuery,
}: {
  workspaceId: string;
  noteId: string;
  initialQuery: { view?: string; tab?: string };
}) {
  return (
    <ClientNoteRoute
      workspaceId={workspaceId}
      noteId={noteId}
      initialQuery={initialQuery}
    />
  );
}
