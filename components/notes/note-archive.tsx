"use client";

import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { TranscriptSearch } from "@/components/notes/transcript-search";
import { ScrollToBottomButton } from "@/components/heymoa/scroll-to-bottom-button";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetWorkspaceMembers } from "@/lib/api/generated/workspace-members/workspace-members";
import { useGetWorkspaceGuests } from "@/lib/api/generated/workspaces/workspaces";
import {
  getGetNoteQueryKey,
  useCreateNoteGuestParticipant,
} from "@/lib/api/generated/notes/notes";
import { useGetAnalysisFlow } from "@/lib/api/generated/analysis/analysis";
import { okData } from "@/lib/api/ok-data";
import {
  getGetNoteTranscriptQueryKey,
  useAssignNoteSpeaker,
  useAssignSegmentSpeaker,
  useGetNoteTranscript,
} from "@/lib/api/generated/transcription/transcription";
import { TranscriptGapRow } from "@/components/notes/transcript-gap-row";
import {
  SpeakerAssignMenu,
  type AssignScope,
  type SpeakerCandidate,
  type SpeakerTarget,
} from "@/components/notes/speaker-assign-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CopyMarkdownButton } from "@/components/notes/copy-markdown-button";
import { transcriptToMarkdown, type NoteMeta } from "@/lib/notes/copy-markdown";
import { invalidateNoteLists } from "@/lib/notes/invalidate";
import {
  isSpeakerAssigneeQueryKey,
  isWorkspaceGuestsQueryKey,
} from "@/lib/notes/query-keys";
import { meetingLengthOf } from "@/lib/notes/meeting-state";
import {
  SpeakerDock,
  createCurrentMsStore,
} from "@/components/notes/speaker-dock";
import { SpeakerPanel, SpeakerTools } from "@/components/notes/speaker-panel";
import { useSpeakerFallbackNames } from "@/components/notes/speaker-chip";
import {
  summarizeSpeakers,
  type SpeakerJumpVia,
  type SpeakerStat,
} from "@/lib/notes/speaker-stats";
import { track } from "@/lib/analytics/track";
import { toast } from "@/lib/ui/toast";
import { toGapRows } from "@/lib/transcription/gaps";
import { createSpeakerIdentityResolver } from "@/lib/transcription/speaker-identity";
import {
  formatOffset,
  interleaveTranscript,
} from "@/lib/transcription/presentation";
import {
  useTranscriptFocus,
  type TranscriptFocus,
} from "@/components/notes/use-transcript-focus";
import { useEventStreamHealthy } from "@/lib/events/health";
import { hintedInterval } from "@/lib/events/interval";

const BOTTOM_THRESHOLD_PX = 48;
const DIARIZATION_POLL_MS = 5_000;

const TRANSCRIPT_SKELETON_WIDTHS = ["62%", "84%", "45%"];

function useAwayFromBottom() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [away, setAway] = useState(false);

  const sync = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setAway(
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight >
        BOTTOM_THRESHOLD_PX
    );
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // scroll 이벤트는 버블링하지 않아 부모에 onScroll을 걸 수 없다.
    viewport.addEventListener("scroll", sync, { passive: true });
    sync();

    // 높이 변화는 scroll 이벤트를 내지 않는다 — 늦게 온 조회로 바닥이 멀어져도 다시 재야 버튼이 뜬다.
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(sync);
    observer?.observe(viewport);
    if (viewport.firstElementChild) {
      observer?.observe(viewport.firstElementChild);
    }

    return () => {
      viewport.removeEventListener("scroll", sync);
      observer?.disconnect();
    };
  }, [sync]);

  const scrollToBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // 즉시 이동이다. smooth 는 애니메이션 중 scroll 이벤트가 「아직 바닥이 아니다」로 읽혀 버튼이 깜빡인다.
    viewport.scrollTop = viewport.scrollHeight;
    sync();
  }, [sync]);

  return { viewportRef, away, scrollToBottom };
}

const countOverrides = (
  rows: ReadonlyArray<{
    speakerLabel?: string | null;
    assignedParticipantId?: string | null;
  }>,
  label: string
) =>
  rows.filter(
    (segment) => segment.speakerLabel === label && segment.assignedParticipantId
  ).length;

const labelsToReset = (
  diarization:
    | {
        status?: string;
        speakers?: ReadonlyArray<{
          label: string;
          assignedParticipantId?: string | null;
          assignedName?: string | null;
        }>;
      }
    | null
    | undefined,
  segments: ReadonlyArray<{
    speakerLabel?: string | null;
    assignedParticipantId?: string | null;
  }>
) => {
  const labels = new Set<string>();
  if (diarization?.status === "MAPPED") {
    for (const speaker of diarization.speakers ?? []) {
      if (speaker.assignedParticipantId) {
        labels.add(speaker.label);
      }
    }
  }
  for (const segment of segments) {
    if (segment.assignedParticipantId && segment.speakerLabel) {
      labels.add(segment.speakerLabel);
    }
  }
  return [...labels];
};

type NoteParticipantFace = SpeakerCandidate & { participantId: string };

export const NoteArchive = memo(function NoteArchive({
  noteId,
  workspaceId,
  participants = [],
  noteMeta,
  focusSegmentId,
  onFocusHandled,
  active = true,
}: {
  noteId: string;
  active?: boolean;
  workspaceId?: string;
  participants?: NoteParticipantFace[];
  noteMeta?: NoteMeta | null;
} & TranscriptFocus) {
  const t = useTranslations("notes.archive");
  const fallbackNames = useSpeakerFallbackNames();
  const tActions = useTranslations("common.actions");
  const streamHealthy = useEventStreamHealthy();
  const flowQuery = useGetAnalysisFlow(noteId, {
    query: {
      refetchInterval: (query) =>
        hintedInterval(
          streamHealthy,
          okData(query.state.data)?.status === "DIARIZING" ||
            okData(query.state.data)?.regions?.some(
              (row) => row.status === "PENDING"
            )
            ? DIARIZATION_POLL_MS
            : false
        ),
    },
  });
  const diarizing = okData(flowQuery.data)?.status === "DIARIZING";
  const awaitingSpeakerAnalysis =
    okData(flowQuery.data)?.regions?.some(
      (row) => row.region === "ITEM_ENRICHMENT" && row.status === "PENDING"
    ) ?? false;
  const transcriptQuery = useGetNoteTranscript(noteId, {
    query: {
      refetchOnMount: "always",
      refetchInterval: (query) => {
        const status = okData(query.state.data)?.diarization?.status;
        return diarizing ||
          (awaitingSpeakerAnalysis && status === "NOT_REQUESTED") ||
          status === "ASSEMBLING" ||
          status === "SUBMITTED"
          ? DIARIZATION_POLL_MS
          : false;
      },
    },
  });

  const transcript =
    transcriptQuery.data?.status === 200 && transcriptQuery.data.data.success
      ? transcriptQuery.data.data.data
      : null;
  const segments = useMemo(() => transcript?.segments ?? [], [transcript]);
  const rows = useMemo(
    () =>
      interleaveTranscript(
        segments,
        toGapRows(transcript?.gaps ?? [], transcript?.transcriptGaps)
      ),
    [segments, transcript]
  );
  const diarized = transcript?.diarization?.status === "MAPPED";
  const speakerOf = useMemo(
    () =>
      createSpeakerIdentityResolver(
        diarized ? transcript!.diarization.speakers : [],
        participants,
        fallbackNames.speaker
      ),
    [diarized, transcript, participants, fallbackNames]
  );
  const truncated = transcript?.recording?.seal === "TRUNCATED";
  const candidateQueryOptions = {
    query: {
      enabled: Boolean(workspaceId) && active,
      staleTime: 0,
      refetchOnMount: "always" as const,
    },
  };
  const membersQuery = useGetWorkspaceMembers(
    workspaceId ?? "",
    candidateQueryOptions
  );
  const guestsQuery = useGetWorkspaceGuests(
    workspaceId ?? "",
    undefined,
    candidateQueryOptions
  );
  const membersData = membersQuery.data;
  const guestsData = guestsQuery.data;
  /** TanStack 은 리패치가 실패해도 옛 `data` 를 들고, 캐시를 든 리패치 중에는 `isPending=false, isFetching=true` 다 — 둘 다 「못 읽었다」로 친다. */
  const candidatesRefetching =
    membersQuery.isFetching || guestsQuery.isFetching;
  const candidatesReady =
    !membersQuery.isError &&
    !guestsQuery.isError &&
    !candidatesRefetching &&
    membersData?.status === 200 &&
    membersData.data.success &&
    guestsData?.status === 200 &&
    guestsData.data.success;
  const candidatesPending =
    membersQuery.isPending || guestsQuery.isPending || candidatesRefetching;
  const candidatesFailed = !candidatesReady && !candidatesPending;
  const retryCandidates = useCallback(() => {
    // 수동 `refetch()` 는 `enabled: false` 를 무시해 `/v1/workspaces//members` 가 나가므로, 확인된 워크스페이스가 없으면 부르지 않는다.
    if (!workspaceId) return;
    void membersQuery.refetch();
    void guestsQuery.refetch();
  }, [workspaceId, membersQuery, guestsQuery]);

  const withAssignedLabels = useMemo(() => {
    const members =
      membersData?.status === 200 && membersData.data.success
        ? membersData.data.data.members
        : [];
    const speakers =
      transcript?.diarization?.status === "MAPPED"
        ? transcript.diarization.speakers
        : [];
    const labelsOf = new Map<string, string[]>();
    for (const speaker of speakers) {
      if (!speaker.assignedParticipantId) continue;
      const labels = labelsOf.get(speaker.assignedParticipantId) ?? [];
      labels.push(speaker.label);
      labelsOf.set(speaker.assignedParticipantId, labels);
    }
    const joined = participants
      .map((participant) => ({
        ...participant,
        assignedLabels: labelsOf.get(participant.participantId) ?? [],
      }))
      .sort(
        (a, b) =>
          Number(Boolean(b.assignedLabels.length)) -
          Number(Boolean(a.assignedLabels.length))
      );
    const already = new Set(
      participants.map((participant) => participant.userId).filter(Boolean)
    );
    const notYetParticipating = members
      .filter((member) => !already.has(member.userId))
      .map((member) => ({
        participantId: null,
        userId: member.userId,
        name: member.name,
        email: member.email,
        image: member.image,
        assignedLabels: [],
        searchOnly: participants.length > 0,
      }));

    const guests =
      guestsData?.status === 200 && guestsData.data.success
        ? guestsData.data.data.guests
        : [];
    const alreadyGuests = new Set(
      participants.map((participant) => participant.guestId).filter(Boolean)
    );
    const elsewhereGuests = guests
      .filter((guest) => !alreadyGuests.has(guest.guestId))
      .map((guest) => ({
        participantId: null,
        userId: null,
        guestId: guest.guestId,
        name: guest.displayName,
        email: null,
        image: null,
        assignedLabels: [],
        searchOnly: true,
      }));

    return [...joined, ...notYetParticipating, ...elsewhereGuests];
  }, [participants, transcript, membersData, guestsData]);

  const queryClient = useQueryClient();
  const refreshGuestSources = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(noteId) }),
        queryClient.invalidateQueries({
          predicate: (query) => isWorkspaceGuestsQueryKey(query.queryKey),
        }),
        invalidateNoteLists(queryClient),
      ]),
    [queryClient, noteId]
  );

  const refreshTranscript = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: getGetNoteTranscriptQueryKey(noteId),
      }),
    [queryClient, noteId]
  );
  const refreshAfterAssign = useCallback(
    () =>
      Promise.all([
        refreshTranscript(),
        refreshGuestSources(),
        queryClient.invalidateQueries({
          predicate: (query) =>
            isSpeakerAssigneeQueryKey(noteId, query.queryKey),
        }),
      ]),
    [refreshTranscript, refreshGuestSources, queryClient, noteId]
  );
  const assign = useAssignNoteSpeaker({
    mutation: { onSuccess: refreshAfterAssign },
  });
  const assignSegment = useAssignSegmentSpeaker({
    mutation: { onSuccess: refreshAfterAssign },
  });
  const createGuest = useCreateNoteGuestParticipant();

  const [pendingLabelAssign, setPendingLabelAssign] = useState<{
    label: string;
    target: SpeakerTarget | null;
    createName?: string;
    overrides: number | null;
  } | null>(null);

  /** `refetch()` 는 실패해도 reject 하지 않고 성공 캐시를 그대로 들고 오므로 `isError` 를 본다. */
  const [resolvingOverrides, setResolvingOverrides] = useState(false);

  const overrideCountOf = useCallback(
    async (label: string): Promise<number | null> => {
      const cached = countOverrides(segments, label);
      if (cached > 0) return cached;
      setResolvingOverrides(true);
      try {
        const fresh = await transcriptQuery.refetch();
        if (fresh?.isError) return null;
        const rows =
          fresh?.data?.status === 200 && fresh.data.data.success
            ? (fresh.data.data.data.segments ?? [])
            : segments;
        return countOverrides(rows, label);
      } catch {
        return null;
      } finally {
        setResolvingOverrides(false);
      }
    },
    [segments, transcriptQuery]
  );

  const applyToLabel = useCallback(
    (label: string, target: SpeakerTarget | null) => {
      assign.mutate({ noteId, label, data: target ?? { participantId: null } });
    },
    [assign, noteId]
  );

  const requestLabelAssign = useCallback(
    async (label: string, target: SpeakerTarget | null) => {
      const overrides = await overrideCountOf(label);
      if (overrides === 0) {
        applyToLabel(label, target);
        return;
      }
      setPendingLabelAssign({ label, target, overrides });
    },
    [overrideCountOf, applyToLabel]
  );

  const assignNewGuest = useCallback(
    async (
      label: string,
      segmentId: string,
      displayName: string,
      scope: AssignScope
    ) => {
      let createdId;
      try {
        const response = await createGuest.mutateAsync({
          noteId,
          data: { displayName },
        });
        if (response.status !== 201 || !response.data.success) return;
        createdId = response.data.data.participantId;
      } catch {
        return;
      } finally {
        void refreshGuestSources();
      }
      if (!createdId) return;
      if (scope === "segment") {
        assignSegment.mutate({
          noteId,
          segmentId,
          data: { participantId: createdId },
        });
      } else {
        applyToLabel(label, { participantId: createdId });
      }
    },
    [createGuest, assignSegment, applyToLabel, refreshGuestSources, noteId]
  );

  const requestNewGuest = useCallback(
    async (
      label: string,
      segmentId: string,
      displayName: string,
      scope: AssignScope
    ) => {
      const overrides = scope === "label" ? await overrideCountOf(label) : 0;
      if (overrides === 0) {
        void assignNewGuest(label, segmentId, displayName, scope);
        return;
      }
      setPendingLabelAssign({
        label,
        target: null,
        createName: displayName,
        overrides,
      });
    },
    [overrideCountOf, assignNewGuest]
  );

  const { viewportRef, away, scrollToBottom } = useAwayFromBottom();
  const [focusedSegmentId, setFocusedSegmentId] = useState<string | null>(
    focusSegmentId
  );
  const [preserveSearchFocus, setPreserveSearchFocus] = useState(false);
  const [lastCitation, setLastCitation] = useState<string | null>(
    focusSegmentId
  );
  if (focusSegmentId !== lastCitation) {
    setLastCitation(focusSegmentId);
    if (focusSegmentId) {
      setFocusedSegmentId(focusSegmentId);
      setPreserveSearchFocus(false);
    }
  }
  const clearFocus = useCallback(() => {
    setFocusedSegmentId(null);
    onFocusHandled();
  }, [onFocusHandled]);
  const [focusRequest, setFocusRequest] = useState(0);
  const jumpToSegment = useCallback(
    (segmentId: string, fromSearch = false) => {
      setPreserveSearchFocus(fromSearch);
      onFocusHandled();
      setFocusedSegmentId(segmentId);
      setFocusRequest((value) => value + 1);
    },
    [onFocusHandled]
  );
  const searchJump = useCallback(
    (id: string) => jumpToSegment(id, true),
    [jumpToSegment]
  );
  const [currentMsStore] = useState(createCurrentMsStore);
  const speakerJump = useCallback(
    (surface: "dock" | "panel") => (segmentId: string, via: SpeakerJumpVia) => {
      const at = segments.find((s) => s.segmentId === segmentId)?.startedAtMs;
      if (at !== undefined) currentMsStore.pin(at);
      if (workspaceId)
        track("speaker_timeline_jumped", {
          workspace_id: workspaceId,
          surface,
          via,
        });
      jumpToSegment(segmentId);
    },
    [jumpToSegment, workspaceId, segments, currentMsStore]
  );
  const dockJump = useMemo(() => speakerJump("dock"), [speakerJump]);
  const panelJump = useMemo(() => speakerJump("panel"), [speakerJump]);
  const viewAnchor = useRef<{ id: string; offset: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [listOffset, setListOffset] = useState(0);
  const [anchorRevision, setAnchorRevision] = useState(0);
  const [openMenuSegment, setOpenMenuSegment] = useState<string | null>(null);
  const [keyboardSegment, setKeyboardSegment] = useState<string | null>(null);
  const virtualized =
    rows.length > 200 &&
    process.env.NEXT_PUBLIC_TRANSCRIPT_VIRTUALIZATION !== "disabled";
  const rowIndexes = useMemo(
    () =>
      new Map(
        rows.map((row, index) => [
          row.type === "segment" ? row.segment.segmentId : row.gap.gapId,
          index,
        ])
      ),
    [rows]
  );
  // eslint-disable-next-line react-hooks/incompatible-library -- React Compiler 를 쓰지 않는다. 켜더라도 이 컴포넌트를 건너뛰는 것이 안전한 동작이다
  const virtualizer = useVirtualizer({
    count: rows.length,
    enabled: virtualized,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => 100,
    // 숨긴 탭(`display:none`)에서는 행이 높이 0으로 재진다. 그 값을 받으면 돌아왔을 때 읽던 줄이 밀린다.
    useCachedMeasurements: !active,
    overscan: 8,
    scrollMargin: listOffset,
    getItemKey: (index) =>
      rows[index].type === "segment"
        ? rows[index].segment.segmentId
        : rows[index].gap.gapId,
    rangeExtractor: (range) =>
      [
        ...new Set([
          ...defaultRangeExtractor(range),
          ...[focusedSegmentId, openMenuSegment, keyboardSegment].flatMap(
            (id) => {
              const index = id ? rowIndexes.get(id) : undefined;
              return index === undefined ? [] : [index];
            }
          ),
        ]),
      ].sort((a, b) => a - b),
  });
  useEffect(() => {
    // ResizeObserver can precede the scroll event after a jump. Compensating
    // from a stale offset would undo the user's new destination.
    virtualizer.shouldAdjustScrollPositionOnItemSizeChange = (
      item,
      _delta,
      instance
    ) => {
      const actual = viewportRef.current?.scrollTop ?? 0;
      return (
        Math.abs(actual - (instance.scrollOffset ?? 0)) < 1 &&
        item.end <= actual &&
        instance.scrollDirection !== "backward"
      );
    };
    return () => {
      virtualizer.shouldAdjustScrollPositionOnItemSizeChange = undefined;
    };
  }, [virtualizer, viewportRef]);
  // 숨긴 탭이 다시 보이면 브라우저가 스크롤 위치를 되살리지만 scroll 이벤트는 내지 않는다.
  // 가상 목록은 그 이벤트로만 위치를 읽어서, 안 알리면 맨 앞 행을 그린 빈 화면이 남는다.
  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() =>
      viewportRef.current?.dispatchEvent(new Event("scroll"))
    );
    return () => cancelAnimationFrame(frame);
  }, [active, viewportRef]);
  const captureAnchor = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const bounds = viewport.getBoundingClientRect();
    const toolsBottom =
      viewport
        .querySelector('[data-testid="transcript-tools"]')
        ?.getBoundingClientRect().bottom ?? bounds.top;
    const visible = Array.from(
      viewport.querySelectorAll<HTMLElement>("[data-segment-id]")
    ).find((node) => {
      const box = node.getBoundingClientRect();
      return box.bottom > toolsBottom && box.top < bounds.bottom;
    });
    viewAnchor.current = visible?.dataset.segmentId
      ? {
          id: visible.dataset.segmentId,
          offset: visible.getBoundingClientRect().top - toolsBottom,
        }
      : null;
  }, [viewportRef]);
  useEffect(() => {
    const viewport = viewportRef.current;
    const list = listRef.current;
    if (!virtualized || !viewport || !list) return;
    let width = viewport.clientWidth;
    const update = () => {
      // 탭이 숨으면 폭이 0이 된다. 폭 변화로 보고 다시 재면 돌아올 때 위치가 밀린다.
      if (viewport.clientWidth === 0) return;
      setListOffset(
        Math.round(
          list.getBoundingClientRect().top -
            viewport.getBoundingClientRect().top +
            viewport.scrollTop
        )
      );
      if (width === viewport.clientWidth) return;
      captureAnchor();
      width = viewport.clientWidth;
      virtualizer.measure();
      setAnchorRevision((value) => value + 1);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    const tools = viewport.querySelector('[data-testid="transcript-tools"]');
    if (tools) observer.observe(tools);
    return () => observer.disconnect();
  }, [virtualized, virtualizer, viewportRef, captureAnchor]);
  useEffect(() => {
    const anchor = viewAnchor.current;
    const viewport = viewportRef.current;
    if (!anchor || !viewport) return;
    viewAnchor.current = null;
    const index = rowIndexes.get(anchor.id);
    if (virtualized && index !== undefined)
      virtualizer.scrollToIndex(index, { align: "start" });
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const node = viewport.querySelector<HTMLElement>(
          `[data-segment-id="${CSS.escape(anchor.id)}"]`
        );
        if (!node) return;
        const offset =
          viewport.scrollTop +
          node.getBoundingClientRect().top -
          (viewport
            .querySelector('[data-testid="transcript-tools"]')
            ?.getBoundingClientRect().bottom ??
            viewport.getBoundingClientRect().top) -
          anchor.offset;
        if (virtualized) virtualizer.scrollToOffset(offset);
        else viewport.scrollTop = offset;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [virtualized, virtualizer, rowIndexes, viewportRef, anchorRevision]);
  const displayedRows = virtualized
    ? virtualizer
        .getVirtualItems()
        .map((item) => ({ row: rows[item.index], item }))
    : rows.map((row) => ({ row, item: null }));
  const scrollToSegment = useCallback(
    (segmentId: string) => {
      const index = rowIndexes.get(segmentId);
      if (index !== undefined)
        virtualizer.scrollToIndex(index, { align: "center" });
    },
    [virtualizer, rowIndexes]
  );
  const { segmentRef, isHighlighted, markProps } = useTranscriptFocus(
    segments,
    {
      focusSegmentId: focusedSegmentId,
      onFocusHandled: clearFocus,
      focusDestination: !preserveSearchFocus,
    },
    virtualized ? scrollToSegment : undefined,
    focusRequest
  );

  const startedAtOf = useMemo(
    () =>
      new Map(
        segments.map((segment) => [segment.segmentId, segment.startedAtMs])
      ),
    [segments]
  );
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const box = viewport.getBoundingClientRect();
      const toolsBottom =
        viewport
          .querySelector('[data-testid="transcript-tools"]')
          ?.getBoundingClientRect().bottom ?? box.top;
      const x = box.left + box.width / 2;
      const middle = (toolsBottom + box.bottom) / 2;
      for (const dy of [0, 24, -24, 56, -56]) {
        // jsdom 에는 `elementFromPoint` 가 없다.
        const id = document
          .elementFromPoint?.(x, middle + dy)
          ?.closest<HTMLElement>("[data-segment-id]")?.dataset.segmentId;
        const at = id ? startedAtOf.get(id) : undefined;
        if (at !== undefined) {
          currentMsStore.set(at);
          return;
        }
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const release = () => currentMsStore.release();
    const inputs = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    measure();
    viewport.addEventListener("scroll", onScroll, { passive: true });
    inputs.forEach((type) =>
      viewport.addEventListener(type, release, { passive: true })
    );
    return () => {
      viewport.removeEventListener("scroll", onScroll);
      inputs.forEach((type) => viewport.removeEventListener(type, release));
      if (frame) cancelAnimationFrame(frame);
    };
  }, [viewportRef, startedAtOf, rows.length, currentMsStore]);

  const [panelOpen, setPanelOpen] = useState(false);
  const meetingDurationMs = meetingLengthOf(
    transcript?.recording?.durationMs,
    transcript
  );
  const speakerStats = useMemo(
    () =>
      diarized
        ? summarizeSpeakers({
            segments,
            speakers: transcript!.diarization.speakers,
            participants,
            durationMs: meetingDurationMs,
            names: fallbackNames,
          })
        : [],
    [
      diarized,
      transcript,
      segments,
      participants,
      meetingDurationMs,
      fallbackNames,
    ]
  );
  const unassignedStats = speakerStats.filter(
    (stat) => stat.unassigned && stat.firstSegmentId
  );
  const [unassignedCursor, setUnassignedCursor] = useState(0);
  const jumpToNextUnassigned = useCallback(() => {
    if (!unassignedStats.length) return;
    const index = unassignedCursor % unassignedStats.length;
    setUnassignedCursor(index + 1);
    jumpToSegment(unassignedStats[index].firstSegmentId!);
  }, [unassignedStats, unassignedCursor, jumpToSegment]);
  const renderDockAssign = (stat: SpeakerStat) => {
    const label = stat.labels[0];
    if (!label) return null;
    return (
      <SpeakerAssignMenu
        triggerTestId="speaker-dock-assign"
        allowSegmentScope={false}
        identity={{
          displayName: stat.name,
          avatarName: stat.avatarName,
          imageUrl: stat.image,
          unassigned: stat.unassigned,
        }}
        candidates={withAssignedLabels}
        creating={createGuest.isPending}
        disabled={speakerMutating}
        candidatesFailed={candidatesFailed}
        candidatesPending={candidatesPending}
        onRetryCandidates={retryCandidates}
        onOpen={retryCandidates}
        onAssign={(target, scope) => {
          if (scope === "segment" && !target) return;
          if (scope === "segment" && stat.firstSegmentId) {
            assignSegment.mutate({
              noteId,
              segmentId: stat.firstSegmentId,
              data: target!,
            });
            return;
          }
          void requestLabelAssign(label, target);
        }}
        onCreateGuest={
          candidatesReady
            ? (displayName, scope) =>
                void requestNewGuest(
                  label,
                  stat.firstSegmentId ?? "",
                  displayName,
                  scope
                )
            : undefined
        }
      />
    );
  };
  const resettableLabels = useMemo(
    () => labelsToReset(transcript?.diarization, segments),
    [transcript, segments]
  );

  const resetSpeaker = useAssignNoteSpeaker({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const [resetting, setResetting] = useState(false);
  const [pendingReset, setPendingReset] = useState<string[] | null>(null);

  const requestReset = useCallback(async () => {
    setResetting(true);
    try {
      const fresh = await transcriptQuery.refetch();
      const payload =
        !fresh?.isError &&
        fresh?.data?.status === 200 &&
        fresh.data.data.success
          ? fresh.data.data.data
          : null;
      if (!payload) {
        toast.error(t("resetReadFailed"));
        return;
      }
      const labels = labelsToReset(payload.diarization, payload.segments ?? []);
      if (!labels.length) return;
      setPendingReset(labels);
    } catch {
      toast.error(t("resetReadFailed"));
    } finally {
      setResetting(false);
    }
  }, [transcriptQuery, t]);

  const resetSpeakers = useCallback(
    async (labels: string[]) => {
      setResetting(true);
      try {
        let failed = 0;
        for (const label of labels) {
          try {
            await resetSpeaker.mutateAsync({
              noteId,
              label,
              data: { participantId: null },
            });
          } catch {
            failed += 1;
          }
        }
        if (failed) toast.error(t("resetFailed", { count: failed }));
      } finally {
        await refreshAfterAssign();
        setResetting(false);
      }
    },
    [resetSpeaker, noteId, refreshAfterAssign, t]
  );

  const speakerMutating =
    createGuest.isPending ||
    assign.isPending ||
    assignSegment.isPending ||
    resolvingOverrides ||
    resetting;

  const dockShown = Boolean(
    diarized && !transcriptQuery.isError && rows.length && speakerStats.length
  );
  return (
    <ScrollArea
      className="h-full"
      viewportRef={viewportRef}
      overlay={
        <>
          {dockShown ? (
            <SpeakerDock
              stats={speakerStats}
              durationMs={meetingDurationMs}
              currentMsStore={currentMsStore}
              onJump={dockJump}
              renderAssign={renderDockAssign}
            />
          ) : null}
          {away ? (
            <ScrollToBottomButton
              label={t("scrollToBottom")}
              onClick={() =>
                virtualized
                  ? virtualizer.scrollToIndex(rows.length - 1, { align: "end" })
                  : scrollToBottom()
              }
              className={dockShown ? "bottom-44 lg:bottom-48" : "lg:bottom-20"}
            />
          ) : null}
        </>
      }
    >
      <div
        data-testid="note-archive-content"
        className="mx-auto w-full max-w-[calc(820px+2*var(--note-gutter))] px-[var(--note-gutter)] pb-7 pt-5 sm:pb-9 lg:pb-28"
      >

        <TranscriptSearch
          segments={transcriptQuery.isError ? [] : segments}
          onJump={searchJump}
        >
          {/* 다시 읽기가 실패해도 TanStack 은 옛 `data` 를 들고 있어 `diarized` 가 참으로 남는다 — 본문이 오류면 도구도 내린다. */}

          {diarized && !transcriptQuery.isError ? (
            <SpeakerTools
              onOpen={() => setPanelOpen(true)}
              onNextUnassigned={jumpToNextUnassigned}
              unassignedCount={unassignedStats.length}
            />
          ) : null}
          {/* 재조회가 실패하면 TanStack은 옛 `data`를 그대로 들고 `isError`가 된다 — 여기만 남으면 그 숨은 캐시가 복사된다. */}
          {noteMeta && rows.length && !transcriptQuery.isError ? (
            <CopyMarkdownButton
              kind="transcript"
              disabled={transcriptQuery.isFetching}
              build={(doc) =>
                transcriptToMarkdown({
                  doc,
                  note: {
                    ...noteMeta,
                    durationMs: meetingDurationMs,
                  },
                  rows,
                  truncated,
                  speakerNameOf: (label, assignedParticipantId) =>
                    diarized
                      ? (speakerOf(label, assignedParticipantId)?.displayName ??
                        null)
                      : null,
                })
              }
            />
          ) : null}
        </TranscriptSearch>

        <div aria-label={t("transcriptLabel")}>
          {transcriptQuery.isPending ? (
            <div className="mt-3" aria-label={t("loading")}>
              {[0, 1, 2].map((row) => (
                <div
                  key={row}
                  className="grid grid-cols-[58px_1fr] gap-4 border-b border-[var(--el-hairline)] py-5 sm:grid-cols-[66px_1fr] sm:gap-6"
                >
                  <Skeleton className="mt-1 h-3 w-10 rounded-chip" />
                  <div className="flex h-7 items-center">
                    <Skeleton
                      className="h-4 rounded-chip"
                      style={{ width: TRANSCRIPT_SKELETON_WIDTHS[row] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : transcriptQuery.isError ? (
            <div role="alert" className="mt-6 space-y-2">
              <p className="text-sm text-[var(--el-ink)]">
                {t("loadFailed")}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-[30px]"
                onClick={() => void transcriptQuery.refetch()}
              >
                {tActions("retry")}
              </Button>
            </div>
          ) : (
            <>
              <div
                ref={listRef}
                className="mt-3 relative"
                style={
                  virtualized
                    ? { height: virtualizer.getTotalSize() }
                    : undefined
                }
              >
                {displayedRows.map(({ row, item }) => (
                  <div
                    key={
                      row.type === "gap" ? row.gap.gapId : row.segment.segmentId
                    }
                    data-index={item?.index}
                    ref={item ? virtualizer.measureElement : undefined}
                    style={
                      item
                        ? {
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${item.start - listOffset}px)`,
                          }
                        : undefined
                    }
                  >
                    {row.type === "gap" ? (
                      <TranscriptGapRow key={row.gap.gapId} row={row.gap} />
                    ) : (
                      <article
                        key={row.segment.segmentId}
                        data-segment-id={row.segment.segmentId}
                        onFocus={() =>
                          setKeyboardSegment(row.segment.segmentId)
                        }
                        ref={segmentRef(row.segment.segmentId)}
                        tabIndex={-1}
                        data-testid="archive-transcript-block"
                        data-focused={
                          isHighlighted(row.segment.segmentId) || undefined
                        }
                        className="grid grid-cols-[58px_1fr] gap-4 border-b border-[var(--el-hairline)] py-5 sm:grid-cols-[66px_1fr] sm:gap-6"
                      >
                        <time className="pt-1 font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)]">
                          {formatOffset(row.segment.startedAtMs)}
                        </time>
                        <div className="max-w-3xl">
                          {speakerOf(
                            row.segment.speakerLabel,
                            row.segment.assignedParticipantId
                          ) ? (
                            <SpeakerAssignMenu
                              identity={
                                speakerOf(
                                  row.segment.speakerLabel,
                                  row.segment.assignedParticipantId
                                )!
                              }
                              candidates={withAssignedLabels}
                              creating={createGuest.isPending}
                              disabled={speakerMutating}
                              candidatesFailed={candidatesFailed}
                              candidatesPending={candidatesPending}
                              onRetryCandidates={retryCandidates}
                              onOpen={retryCandidates}
                              onMenuOpenChange={(open) =>
                                setOpenMenuSegment(
                                  open ? row.segment.segmentId : null
                                )
                              }
                              overridden={Boolean(
                                row.segment.assignedParticipantId
                              )}
                              onAssign={(target, scope) => {
                                if (scope === "segment") {
                                  if (!target) return;
                                  assignSegment.mutate({
                                    noteId,
                                    segmentId: row.segment.segmentId,
                                    data: target,
                                  });
                                  return;
                                }
                                void requestLabelAssign(
                                  row.segment.speakerLabel!,
                                  target
                                );
                              }}
                              onCreateGuest={
                                candidatesReady
                                  ? (displayName, scope) =>
                                      void requestNewGuest(
                                        row.segment.speakerLabel!,
                                        row.segment.segmentId,
                                        displayName,
                                        scope
                                      )
                                  : undefined
                              }
                              onClearOverride={() =>
                                assignSegment.mutate({
                                  noteId,
                                  segmentId: row.segment.segmentId,
                                  data: { participantId: null },
                                })
                              }
                            />
                          ) : null}
                          <p className="text-[15px] leading-7 text-[var(--el-ink)]">
                            <span {...markProps(row.segment.segmentId)}>
                              {row.segment.text}
                            </span>
                          </p>
                        </div>
                      </article>
                    )}
                  </div>
                ))}
              </div>
              {truncated ? (
                <p
                  data-testid="recording-truncated"
                  className="py-4 text-sm text-[var(--el-muted)]"
                >
                  {t("truncated")}
                </p>
              ) : null}
              {!rows.length ? (
                <p className="py-8 text-sm text-[var(--el-muted)]">
                  {t("empty")}
                </p>
              ) : null}
            </>
          )}
        </div>
        <SpeakerPanel
          open={panelOpen && !transcriptQuery.isError}
          onOpenChange={setPanelOpen}
          stats={speakerStats}
          durationMs={meetingDurationMs}
          onJump={panelJump}
          onReset={() => void requestReset()}
          resetting={resetting}
          resettable={resettableLabels.length > 0 && !speakerMutating}
        />

        <AlertDialog
          open={pendingReset !== null}
          onOpenChange={(next) => {
            if (!next) setPendingReset(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("resetDialog.title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("resetDialog.description", {
                  count: pendingReset?.length ?? 0,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tActions("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!pendingReset) return;
                  void resetSpeakers(pendingReset);
                  setPendingReset(null);
                }}
              >
                {t("resetDialog.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={pendingLabelAssign !== null}
          onOpenChange={(next) => {
            if (!next) setPendingLabelAssign(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("applyAllDialog.title")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingLabelAssign?.overrides === null
                  ? t("applyAllDialog.unknown", {
                      label: pendingLabelAssign?.label ?? "",
                    })
                  : t("applyAllDialog.description", {
                      label: pendingLabelAssign?.label ?? "",
                      count: pendingLabelAssign?.overrides ?? 0,
                    })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tActions("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!pendingLabelAssign) return;
                  const { label, target, createName } = pendingLabelAssign;
                  if (createName) {
                    void assignNewGuest(label, "", createName, "label");
                  } else {
                    applyToLabel(label, target);
                  }
                  setPendingLabelAssign(null);
                }}
              >
                {t("applyAllDialog.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ScrollArea>
  );
});
