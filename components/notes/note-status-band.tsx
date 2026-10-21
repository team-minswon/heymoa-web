"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Info, Pause } from "lucide-react";

import type {
  NoteListResponseData,
  NoteResponseData,
} from "@/lib/api/generated/models";
import { pausedDayCount } from "@/lib/notes/meeting-state";
import { isNoteListQueryKey } from "@/lib/notes/query-keys";
import { useAlignedNow } from "@/lib/notes/use-aligned-now";

/**
 * 이 노트의 중지 시각. **노트 응답에는 없고 목록 응답에만 있다**(APP-1310) — 그래서 읽어 둔 목록 캐시에서
 * 찾는다. 목록에서 눌러 연 노트는 늘 찾고, 링크로 바로 들어와 그 노트가 첫 쪽에 없으면 못 찾는다.
 */
function cachedPausedAt(queryClient: QueryClient, noteId: string) {
  for (const [, response] of queryClient.getQueriesData<{
    status: number;
    data: { success: boolean; data: NoteListResponseData };
  }>({ predicate: (query) => isNoteListQueryKey(query.queryKey) })) {
    if (response?.status !== 200 || !response.data.success) continue;
    const row = response.data.data.notes.find((note) => note.noteId === noteId);
    if (row?.pausedAt) return row.pausedAt;
  }
  return null;
}

/**
 * 노트 상단바 바로 아래의 한 줄 띠.
 *
 * - **오래 멈춘 회의**(APP-1313): 「N일째 중지 상태입니다」. 오늘 멈춘 회의는 중지 직후 안내(`EndNudge`)가 이미
 *   종료를 권했으므로 서지 않는다.
 * - **메일 링크로 도착**(APP-1312): 메일은 과거의 중지를 말하므로 **도착한 시점의 상태**를 말한다 — 여전히 중지면
 *   (기간을 몰라도) 중지 안내, 그새 녹음이 다시 시작됐거나 회의가 끝났으면 그 사실. 도착한 뒤 상태가 바뀌면 거둔다.
 *
 * 버튼은 두지 않는다: 재개는 레코더 독, 종료는 상단바 「회의 종료」, 종료 전 참여자 확인은 종료 확인 창이 한다
 * (PRO-67 userflow 「메일 링크로 도착한 사람」). 기기를 말하지 않는다 — web 의 재개는 기기를 가리지 않는다.
 */
export function NoteStatusBand({
  note,
  fromMail = false,
}: {
  note: NoteResponseData;
  fromMail?: boolean;
}) {
  const queryClient = useQueryClient();
  // 목록이 노트보다 늦게 도착해도 띠가 서도록 캐시를 구독한다. 값은 문자열이라 매 알림에 다시 그리지 않는다.
  const subscribe = useCallback(
    (notify: () => void) => queryClient.getQueryCache().subscribe(notify),
    [queryClient]
  );
  const pausedAt = useSyncExternalStore(
    subscribe,
    () => cachedPausedAt(queryClient, note.noteId),
    () => null
  );
  const now = useAlignedNow(60_000);
  // 메일로 도착했을 때의 상태. 노트를 처음 읽은 순간 한 번 적는다.
  const [arrival, setArrival] = useState<{
    noteId: string;
    status: NoteResponseData["meetingStatus"];
  } | null>(null);
  if (fromMail && arrival?.noteId !== note.noteId) {
    setArrival({ noteId: note.noteId, status: note.meetingStatus });
  }
  const landed =
    fromMail &&
    arrival?.noteId === note.noteId &&
    arrival.status === note.meetingStatus;

  let lead: string | null = null;
  let rest: string | null = null;
  if (note.meetingStatus === "PAUSED") {
    const days = pausedDayCount(pausedAt, now);
    if (days !== null) lead = `${days}일째 중지 상태입니다.`;
    else if (landed) lead = "중지 상태입니다.";
    // 띠는 중지 일수만 말한다(userflow 표). 할 수 있는 일은 메일로 온 사람에게만 덧붙인다(userflow 「모바일 메일」).
    if (landed) rest = "이어서 녹음하거나 종료할 수 있습니다.";
  } else if (landed && note.meetingStatus === "IN_PROGRESS") {
    lead = "메일을 보낸 뒤 녹음이 다시 시작되었습니다.";
  } else if (landed && note.meetingStatus === "ENDED") {
    lead = "메일을 보낸 뒤 회의가 종료되었습니다.";
  }
  if (lead === null) return null;
  const Icon = note.meetingStatus === "PAUSED" ? Pause : Info;

  return (
    <div
      role="status"
      data-testid="note-status-band"
      className="shrink-0 border-b border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-[var(--note-gutter)] py-2.5"
    >
      <p className="mx-auto flex w-full max-w-[820px] items-center gap-2 text-[13px] leading-5 text-[var(--el-body)]">
        <Icon
          aria-hidden
          className="size-3.5 shrink-0 text-[var(--el-muted)]"
        />
        <span>
          <span className="font-medium text-[var(--el-ink)]">{lead}</span>
          {rest ? ` ${rest}` : null}
        </span>
      </p>
    </div>
  );
}
