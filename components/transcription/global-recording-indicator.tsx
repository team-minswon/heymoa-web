"use client";

import { AnimatePresence } from "motion/react";
import { usePathname, useRouter } from "next/navigation";

import {
  RecordingPill,
  RECORDING_PILL_EXIT_DURATION,
} from "@/components/transcription/recording-pill";
import { useRecording } from "@/components/transcription/recording-provider";
import { useGetWorkspaces } from "@/lib/api/generated/workspaces/workspaces";
import { isWorkspaceRoute } from "@/lib/routes/app-route";

const VISIBLE_PHASES = new Set([
  "requesting-permission",
  "connecting",
  "recording",
  "stopping",
]);

export const GLOBAL_RECORDING_EXIT_DURATION = RECORDING_PILL_EXIT_DURATION;

/**
 * 워크스페이스 **밖**(마케팅·약관·인증 면)에서 뜨는 녹음 표면.
 * 워크스페이스 안은 툴바가 같은 `RecordingPill` 을 띄운다 — 생김새를 두 벌로 만들지 않는다.
 */
export function GlobalRecordingIndicator() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, elapsedMs, phase, stop } = useRecording();
  const isVisible =
    !isWorkspaceRoute(pathname) &&
    Boolean(session) &&
    VISIBLE_PHASES.has(phase);
  const workspacesQuery = useGetWorkspaces({
    query: { enabled: isVisible, staleTime: 5 * 60 * 1000 },
  });

  const workspaceEnvelope =
    workspacesQuery.data?.status === 200
      ? workspacesQuery.data.data
      : undefined;
  const workspaces = workspaceEnvelope?.success
    ? (workspaceEnvelope.data.workspaces ?? [])
    : [];
  // 세션이 어느 워크스페이스의 것인지는 계약에 없다(계약 추가 목록 ⓘ). 그때까지는 기본 워크스페이스로 추정한다.
  const workspaceId =
    workspaces.find((workspace) => workspace.isDefault)?.workspaceId ??
    workspaces[0]?.workspaceId;
  const noteId = session?.noteId;
  // 목적지를 못 만들면 버튼 자체를 내린다 — 눌러도 안 가는 컨트롤에 포커스를 주지 않는다.
  const onOpen =
    workspaceId && noteId
      ? () =>
          router.push(
            `/w/${workspaceId}/meetings/${noteId}?view=full&tab=transcript`
          )
      : undefined;

  return (
    <AnimatePresence>
      {isVisible ? (
        <RecordingPill
          phase={phase}
          elapsedMs={elapsedMs}
          onOpen={onOpen}
          onStop={() => void stop()}
        />
      ) : null}
    </AnimatePresence>
  );
}
