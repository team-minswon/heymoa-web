"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import {
  isProjectNotesQueryKey,
  isWorkspaceGuestsQueryKey,
} from "@/lib/notes/query-keys";
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

/** 바닥에서 이만큼 안쪽이면 "바닥"으로 본다. 스크롤 위치는 소수점으로 떨어진다. */
const BOTTOM_THRESHOLD_PX = 48;

/** 발화 길이는 고르지 않다 — 전부 같은 폭이면 표처럼 보여서 대화로 안 읽힌다. */
const TRANSCRIPT_SKELETON_WIDTHS = ["62%", "84%", "45%"];

/**
 * 바닥에서 멀어졌는지만 본다. **따라가지 않는다.**
 *
 * 챗봇의 `useStickToBottom`은 내용이 자라면 바닥으로 붙이는데, 아카이브는 새 내용이 쌓이는
 * 면이 아니라 다 끝난 기록을 위에서부터 읽는 면이다. 그걸 그대로 쓰면 열자마자 맨 끝으로
 * 튄다. 전사 뷰의 엔진도 라이브 판정·프로그램 스크롤 가드가 붙어 있어 여기엔 과하다.
 */
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

    // **높이 변화는 scroll 이벤트를 내지 않는다.** 두 쿼리(`refetchOnMount: "always"`)가
    // 늦게 도착하면 스크롤 없이도 바닥이 멀어지는데, 그때 다시 재지 않으면 버튼이 안 뜬다.
    // 행·메시지 개수를 키로 쓰는 방법도 있지만 개수가 같고 문장만 길어지는 갱신을 놓친다.
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
    // 즉시 이동이다. smooth는 애니메이션 중 scroll 이벤트가 "아직 바닥이 아니다"로 읽혀
    // 버튼이 깜빡인다(APP-227에서 밟았다).
    viewport.scrollTop = viewport.scrollHeight;
    sync();
  }, [sync]);

  return { viewportRef, away, scrollToBottom };
}

/**
 * 종료된 회의의 아카이브. **전사 타임라인 하나다.**
 *
 * 예전에는 「대화 기록 / 회의 중 챗봇」 두 탭이었다. 공유 챗봇이 사라지면서 Q&A 탭이 빠졌고,
 * 개인 대화는 남의 아카이브에 노출할 수 없어 대체 표면을 두지 않는다.
 *
 * `ponytail:` 전사 응답에 세션 벽시계 시작이 생기면 `sessionStart + startedAtMs`로 하나의
 * 타임라인에 인터리브해 올린다 — 그때는 이 세그먼트가 필요 없어진다.
 */
/** 이 라벨에 걸린 개별 지정이 몇 줄인가. 「모든 발화에 적용」이 그만큼을 지운다. */
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

/** 이 회의의 참여자. 아직 참여자가 아닌 후보와 달리 참여 기록을 반드시 갖는다. */
type NoteParticipantFace = SpeakerCandidate & { participantId: string };

export function NoteArchive({
  noteId,
  workspaceId,
  participants = [],
  noteMeta,
  focusSegmentId,
  onFocusHandled,
}: {
  noteId: string;
  /**
   * 화자 후보가 **이 회의의 참여자를 넘어** 워크스페이스 사람 전체라 필요하다.
   *
   * **확인된 소속만 받는다.** 조회가 끝나기 전에는 `undefined` 이고, 그동안 후보 조회를
   * 안 걸어 만들기가 잠긴다 — URL 의 워크스페이스로 후보를 세우면 남의 목록이 선다.
   */
  workspaceId?: string;
  /**
   * 이 회의의 참여자. 후보([SpeakerCandidate])와 달리 **참여 기록이 반드시 있다** —
   * 아직 참여자가 아닌 멤버는 여기 안 들어온다.
   */
  participants?: NoteParticipantFace[];
  /** 복사본 머리말. 셸이 읽어 내린다 — 여기서 노트를 다시 구독하지 않는다. */
  noteMeta?: NoteMeta | null;
} & TranscriptFocus) {
  // 종료 직후 마운트다 — 전역 staleTime(60초)을 그대로 두면 방금 전 라이브 캐시를 재사용해
  // 마지막 전사가 빠질 수 있다. 마운트할 때 최종 상태를 다시 당긴다.
  const transcriptQuery = useGetNoteTranscript(noteId, {
    query: { refetchOnMount: "always" },
  });

  const transcript =
    transcriptQuery.data?.status === 200 && transcriptQuery.data.data.success
      ? transcriptQuery.data.data.data
      : null;
  const segments = useMemo(() => transcript?.segments ?? [], [transcript]);
  // 종료된 회의를 여는 자리가 여기다. 공백과 화자를 `TranscriptView`에만 넣으면
  // 정작 볼 사람이 못 본다.
  const rows = useMemo(
    () => interleaveTranscript(segments, toGapRows(transcript?.gaps ?? [])),
    [segments, transcript]
  );
  const diarized = transcript?.diarization?.status === "MAPPED";
  // **참석자에 이름이 실려 있어야 한다.** 발화 단위 지정은 라벨이 아니라 사람을 가리키므로,
  // 그 줄에 쓸 이름을 참석자 목록에서 찾는다.
  const speakerOf = useMemo(
    () =>
      createSpeakerIdentityResolver(
        diarized ? transcript!.diarization.speakers : [],
        participants
      ),
    [diarized, transcript, participants]
  );
  const truncated = transcript?.recording?.seal === "TRUNCATED";
  // **한 사람이 여러 화자를 맡을 수 있다** (V31). 예전에는 하나였고 「고르면 저쪽에서
  // 떨어진다」는 경고였는데, 이제는 「저기에도 붙어 있다」는 정보다. 그래도 보여주는 이유는
  // 같다 — 쪼개진 것을 합치는 중인지 엉뚱한 사람을 두 번 붙이는 중인지는 누르기 전에 알아야 한다.
  // **전사에 들어올 때마다 다시 읽는다.** 전역 staleTime 이 60초라, 다른 화면에서 채운
  // 캐시가 있으면 그 사이 남이 만든 임시 참여자가 후보에 없는 채로 「＋ 추가」가 열린다.
  const candidateQueryOptions = {
    query: { enabled: Boolean(workspaceId), refetchOnMount: "always" as const },
  };
  const membersQuery = useGetWorkspaceMembers(workspaceId ?? "", candidateQueryOptions);
  const guestsQuery = useGetWorkspaceGuests(workspaceId ?? "", candidateQueryOptions);
  const membersData = membersQuery.data;
  const guestsData = guestsQuery.data;
  /**
   * **후보를 다 못 읽었으면 새 이름을 만들 수 없다.**
   *
   * 조회가 실패하거나 아직 도는 동안에는 그 갈래가 빈 목록이 되는데, 「＋ 추가」를 그대로
   * 두면 **이미 있는 사람의 이름을 쳤을 때 후보를 못 찾아 같은 이름을 하나 더 만든다** —
   * 방금 고친 그 버그가 로딩 창으로 되돌아온다.
   */
  /**
   * **리패치 실패도 「못 읽었다」로 친다.** TanStack 은 백그라운드 리패치가 실패해도 직전
   * 데이터를 들고 있어서 `.data` 만 보면 늘 성공으로 읽힌다 — 그 사이 남이 만든 임시
   * 참여자가 후보에 없는데 「＋ 추가」는 살아 있어 **같은 이름을 또 만든다.**
   */
  /**
   * **다시 읽는 중도 「아직」이다.** TanStack 은 캐시를 든 채 리패치할 때
   * `isPending=false, isFetching=true` 라, 이것을 안 보면 **다시 읽는 중을 다 읽었다로
   * 번역**한다. 마운트 직후(`refetchOnMount: "always"`)와 메뉴를 열 때가 정확히 그 창이다.
   *
   * **표시 규칙과 다르다.** 「리패치로 화면을 덮지 않는다」는 *무엇을 그리나*의 규칙이고,
   * 이것은 *만들기를 열어도 되나*의 판정이다. 후보 목록 자체는 그대로 그린다.
   */
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
  /**
   * **실패를 「없음」으로 위장하지 않는다.** 조회가 실패하면 후보가 이 회의 사람으로 줄어드는데,
   * 그대로 두면 사람이 참여자 아닌 멤버를 검색하고 「일치하는 참석자가 없습니다」를 보고
   * **그 사람이 없다고 믿는다.** 로딩은 실패가 아니라 아직 아닌 것이라 가른다.
   */
  const candidatesPending =
    membersQuery.isPending || guestsQuery.isPending || candidatesRefetching;
  const candidatesFailed = !candidatesReady && !candidatesPending;
  const retryCandidates = useCallback(() => {
    // **확인된 워크스페이스가 없으면 안 부른다.** 수동 `refetch()` 는 `enabled: false` 를
    // 무시해서 `/v1/workspaces//members` 가 그대로 나간다 — 로딩이던 후보 UI 가
    // **거짓 실패**로 바뀐다.
    if (!workspaceId) return;
    void membersQuery.refetch();
    void guestsQuery.refetch();
  }, [workspaceId, membersQuery, guestsQuery]);

  const withAssignedLabels = useMemo(() => {
    // **useMemo 안에서 푼다.** 밖에서 풀면 매 렌더 새 배열이라 의존이 늘 바뀌어
    // 아무것도 기억 못 한다 — 기억하는 척하는 비용만 남는다.
    // 실패하면 빈 목록이다. 후보가 이 회의의 참여자로 좁아질 뿐 화면이 안 깨진다.
    const members =
      membersData?.status === 200 && membersData.data.success
        ? membersData.data.data.members
        : [];
    const speakers =
      transcript?.diarization?.status === "MAPPED"
        ? transcript.diarization.speakers
        : [];
    // **참여 기록으로 잇는다.** 계정으로 이으면 계정 없는 사람은 그 값이 없어 「이미
    // 화자 B」 표시가 원리적으로 안 붙는다.
    const labelsOf = new Map<string, string[]>();
    for (const speaker of speakers) {
      if (!speaker.assignedParticipantId) continue;
      const labels = labelsOf.get(speaker.assignedParticipantId) ?? [];
      labels.push(speaker.label);
      labelsOf.set(speaker.assignedParticipantId, labels);
    }
    const joined = participants.map((participant) => ({
      ...participant,
      assignedLabels: labelsOf.get(participant.participantId) ?? [],
    }));
    // **아직 참여자가 아닌 멤버도 후보다.** 참여자로 안 찍힌 사람을 화자로 못 고르면,
    // 회의록을 정리하는 사람이 먼저 정보 화면에 가서 체크하고 돌아와야 한다. 고르는 순간
    // 서버가 참여자로 넣으므로 여기서는 참여 기록 없이(`participantId: null`) 올린다.
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
      }));

    // **이 회의 밖의 임시 참여자는 검색해야 보인다.** 늘 보이면 회의와 상관없는 이름으로
    // 드롭다운이 불어나고, 아예 빼면 사람이 **같은 이름을 하나 더 만든다** — 실제로 그렇게
    // 됐다. 이름을 친 순간에만 내보내 둘 다 피한다.
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
  /**
   * 임시 참여자를 만들면 **세 곳이 같이 바뀐다** — 이 회의의 참석자, 워크스페이스의 임시
   * 참여자 목록(설정과 참석자 필드가 후보를 여기서 세운다), 그리고 참여자 수를 그리는 노트
   * 목록이다. 하나만 갱신하면 이미 열어 둔 화면이 새 사람을 못 찾아 같은 이름을 또 만든다.
   */
  const refreshGuestSources = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(noteId) }),
        queryClient.invalidateQueries({ predicate: (query) => isWorkspaceGuestsQueryKey(query.queryKey) }),
        queryClient.invalidateQueries({ predicate: (query) => isProjectNotesQueryKey(query.queryKey) }),
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
  /**
   * 화자 지정이 **참여자를 늘릴 수 있다** — 아직 참여자가 아닌 멤버를 고르면 서버가 같은
   * 요청 안에서 참여자로 넣는다. 정보 화면의 참석자 필드와 아바타가 그 목록을 읽으므로
   * 전사와 함께 다시 읽는다.
   *
   * 늘었는지 안 늘었는지 안 가린다. 가리려면 「무엇을 보냈나」를 성공 콜백까지 들고 가야
   * 하는데, 노트 조회 한 번이 그 배관보다 싸다.
   */
  const refreshAfterAssign = useCallback(
    // 참여자가 늘면 **노트 하나만 낡는 게 아니다** — 회의 목록의 참여자 아바타와 설정의
    // 임시 참여자 「쓰이는 회의록 수」도 같이 뒤처진다. `refreshGuestSources` 가 그 셋을
    // 이미 갖고 있어 전사만 더한다.
    () => Promise.all([refreshTranscript(), refreshGuestSources()]),
    [refreshTranscript, refreshGuestSources]
  );
  // 라벨 지정은 그 화자의 **발화 단위 지정을 함께 지운다** — 응답에 그 사실이 안 실리므로
  // 전사를 통째로 다시 읽는다.
  const assign = useAssignNoteSpeaker({
    mutation: { onSuccess: refreshAfterAssign },
  });
  // 발화 하나만 바꿔도 마찬가지다. 응답은 그 줄뿐이지만 캐시를 부분 수정하면 그 줄만
  // 손으로 맞추는 코드가 하나 더 생긴다 — 다시 읽는 편이 짧고 틀릴 자리가 없다.
  const assignSegment = useAssignSegmentSpeaker({
    mutation: { onSuccess: refreshAfterAssign },
  });
  const createGuest = useCreateNoteGuestParticipant();

  /**
   * 「모든 발화에 적용」을 눌렀는데 그 화자에 **발화 단위 지정이 남아 있을 때** 확인을 받는다.
   *
   * 서버는 어차피 지운다 — 「모든」이 말 그대로여야 하기 때문이다. 다만 그 몇 줄은 사람이
   * 콕 집어 고쳐 둔 것이라, 말없이 사라지면 「분명 고쳤는데」가 된다. 건수는 이미 손에 든
   * 발화 목록에서 세므로 서버에 묻지 않는다.
   */
  const [pendingLabelAssign, setPendingLabelAssign] = useState<{
    label: string;
    target: SpeakerTarget | null;
    /**
     * 확인을 받은 **뒤에** 만들 이름. 먼저 만들면 사람이 취소해도 임시 참여자와 참여 기록이
     * 영구히 남는다 — 「취소」가 취소가 아니게 된다.
     */
    createName?: string;
    /** `null` 은 「확인 못 했다」다 — 0(「없다」)과 다르다. */
    overrides: number | null;
  } | null>(null);

  /**
   * 이 라벨에 개별 지정이 **몇 줄** 걸려 있나. 「모든 발화에 적용」이 그것을 지운다.
   *
   * **0으로 보일 때만 다시 읽는다.** 종료된 전사는 마운트할 때만 당기므로, 그 사이 다른
   * 사람이 발화 하나를 고쳤으면 캐시로는 0이다 — 그러면 **확인 없이 보내고 서버가 그
   * 지정을 지운다.** 사람이 콕 집어 고쳐 둔 것이 경고도 없이 사라지는 자리다.
   *
   * 반대 방향(캐시가 더 세는 것)은 확인창이 한 번 더 뜰 뿐이라 다시 안 읽는다.
   *
   * **못 읽었으면 `null` 이다.** 실패를 0으로 돌려주면 「없다」와 구분이 안 돼 확인창 없이
   * 보내고, 서버가 그 지정을 지운다 — 막지 않으려던 것이 **모른 채 지우는** 길이 된다.
   * `refetch()` 는 실패해도 reject 하지 않고 성공 캐시를 그대로 들고 오므로 `isError` 를 본다.
   */
  /**
   * **잠금을 여기 둔다.** 호출부마다 켜면 다음에 이 함수를 부르는 세 번째 자리가 또 샌다 —
   * 실제로 한 번 그랬다. 개별 지정이 0인 라벨은 이 조회가 끝나야 mutation 이 시작하는데,
   * 그 사이 `assign.isPending` 이 아직 꺼져 있다. 그때 다른 행에서 「현재 발화에만」을
   * 지정하면 그 PUT 이 먼저 끝나고 **뒤늦게 도착한 라벨 지정이 그것을 지운다.**
   */
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
      // 대상이 없으면 「이름 안 붙임」이다. 열쇠 둘을 다 비워 보낸다.
      assign.mutate({ noteId, label, data: target ?? { participantId: null } });
    },
    [assign, noteId]
  );

  const requestLabelAssign = useCallback(
    async (label: string, target: SpeakerTarget | null) => {
      const overrides = await overrideCountOf(label);
      // **모르면 물어본다.** `null` 은 「없다」가 아니라 「확인 못 했다」다.
      if (overrides === 0) {
        applyToLabel(label, target);
        return;
      }
      setPendingLabelAssign({ label, target, overrides });
    },
    [overrideCountOf, applyToLabel]
  );

  /**
   * 읽던 자리에서 이름을 만들어 그 화자에 붙인다 (APP-494).
   *
   * **만든 사람을 응답에서 바로 집는다.** 참여자 목록을 다시 조회해 찾으면 그 사이에
   * 다른 사람이 참여자를 바꿨을 때 엉뚱한 사람을 붙일 수 있고, 무엇보다 조회가 돌아오기
   * 전에는 집을 것이 없다.
   */
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
        // **응답이 만든 사람을 직접 짚어 준다.** 예전에는 「로컬 목록에 없는 id」와 이름으로
        // 추측했는데, 같은 이름을 막지 않는 것이 이 기능의 규칙이라(동명이인이 정상 입력)
        // 그 사이 남이 같은 이름을 더하면 엉뚱한 참여 기록에 화자가 붙었다.
        createdId = response.data.data.participantId;
      } catch {
        // 실패 토스트는 전역이 서버 문구 그대로 띄운다.
        return;
      } finally {
        // **만들기가 성공했으면 뒤가 어떻게 되든 목록은 갱신한다.** 화자 지정만 실패했을 때
        // 여기서 빠져나가면, 사람은 만든 이름을 후보에서 못 찾아 같은 이름을 또 만든다.
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

  /**
   * 이름을 만들어 붙이는 진입점. **덮어쓰기 확인이 만들기보다 앞선다.**
   *
   * 방금 만든 사람을 발화 단위 지정이 가리킬 리는 없지만, 「모든 발화에 적용」이 지우는 것은
   * *다른 사람*을 가리키던 개별 지정이라 같은 규칙을 탄다. 만들기를 먼저 하면 사람이 확인창에서
   * 취소해도 **임시 참여자와 참여 기록이 이미 영구히 생긴 뒤**다.
   */
  const requestNewGuest = useCallback(
    async (label: string, segmentId: string, displayName: string, scope: AssignScope) => {
      const overrides = scope === "label" ? await overrideCountOf(label) : 0;
      if (overrides === 0) {
        void assignNewGuest(label, segmentId, displayName, scope);
        return;
      }
      setPendingLabelAssign({ label, target: null, createName: displayName, overrides });
    },
    [overrideCountOf, assignNewGuest]
  );


  const { viewportRef, away, scrollToBottom } = useAwayFromBottom();
  const { segmentRef, isHighlighted, markProps } = useTranscriptFocus(
    segments,
    {
      focusSegmentId,
      onFocusHandled,
    }
  );

  return (
    <ScrollArea
      className="h-full"
      viewportRef={viewportRef}
      overlay={
        away ? (
          <ScrollToBottomButton
            label="맨 아래로"
            onClick={scrollToBottom}
            // desktop에서는 레코더 독이 하단 중앙에 떠 있어 그 위로 올린다.
            className="lg:bottom-20"
          />
        ) : null
      }
    >
      <div
        data-testid="note-archive-content"
        className="mx-auto w-full max-w-[calc(820px+2*var(--note-gutter))] px-[var(--note-gutter)] pb-7 pt-5 sm:pb-9 lg:pb-28"
      >
        {/*
          예전에는 「대화 기록 / 회의 중 챗봇」 두 탭이었다. 공유 챗봇이 사라지면서
          Q&A 탭이 빠졌고, 개인 대화는 남의 아카이브에 노출할 수 없어 **대체 표면을 두지
          않는다**. 회의 아카이브에서 그때 뭘 물어봤는지 찾는 일이 실제로 생기면 그때 본다.

          **복사 버튼은 탭이 사라져도 남는다.** 전사는 길어서, 아래로 한참 내려간 자리에서
          복사하려고 맨 위로 올라가야 한다면 그 버튼은 없는 것과 같다 — 스크롤 컨테이너
          위에 붙인다. `-mt-5 pt-5`로 콘텐츠의 위 여백을 이 바가 들고 올라간다. 안 그러면
          지나가는 글이 바 위쪽 20px 틈으로 비친다.
        */}
        <div className="sticky top-0 z-10 -mt-5 flex items-center justify-end bg-white pt-5">
          {/* 재조회가 실패하면 TanStack은 옛 `data`를 그대로 들고 `isError`가 된다 —
              본문은 오류·재시도로 바뀌는데 여기만 남으면 그 숨은 캐시가 복사된다. */}
          {noteMeta && rows.length && !transcriptQuery.isError ? (
            <CopyMarkdownButton
              label="전사"
              // **최종 조회가 끝나기 전에는 못 누른다.** 아카이브는 종료 직후 마운트되어
              // 라이브 캐시를 그대로 보여주며 다시 읽는다(`refetchOnMount: "always"`).
              // 그 창에서 복사하면 마지막 발화가 빠진 회의록이 남는다.
              disabled={transcriptQuery.isFetching}
              build={() =>
                transcriptToMarkdown({
                  note: {
                    ...noteMeta,
                    durationMs: transcript?.recording?.durationMs ?? 0,
                  },
                  rows,
                  truncated,
                  // 화자 분리 전에는 라벨이 있어도 안 적는다 — `화자 A`는 아직 아무도
                  // 아닌 이름이라, 복사본에서는 시각만 남기는 편이 사실에 가깝다.
                  // **발화 단위 지정도 따른다.** 화면에서 고친 이름이 복사본에서 옛
                  // 이름으로 돌아가면, 남에게 보내는 쪽이 틀린 회의록이 된다.
                  speakerNameOf: (label, assignedParticipantId) =>
                    diarized
                      ? (speakerOf(label, assignedParticipantId)?.displayName ??
                        null)
                      : null,
                })
              }
            />
          ) : null}
        </div>

        <div aria-label="회의 전사 아카이브">
            {transcriptQuery.isPending ? (
              /* **실제 행과 같은 격자·같은 여백이다.** 예전에는 `mt-6`에 `h-24`/`h-28` 막대
                 둘이라 248이었고 실제는 288이었다 — 첫 줄이 12px 아래에서 시작했고 행
                 경계도 없어 도착하는 순간 모양이 통째로 바뀌었다. */
              <div className="mt-3" aria-label="대화 기록 불러오는 중">
                {[0, 1, 2].map((row) => (
                  <div
                    key={row}
                    className="grid grid-cols-[58px_1fr] gap-4 border-b border-[var(--el-hairline)] py-5 sm:grid-cols-[66px_1fr] sm:gap-6"
                  >
                    <Skeleton className="mt-1 h-3 w-10 rounded-chip" />
                    {/* 실제 발화는 15px·leading-7이라 한 줄이 28이다 — 막대는 그 줄 안에 놓는다.
                        막대 높이만 맞추면(16) 행이 12px 낮아진다. */}
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
              // 실패를 "없음"으로 위장하지 않는다 — 아카이브가 TranscriptView의 재시도 경로를
              // 대체하므로 그 실패 피드백을 여기서 되살린다.
              <div role="alert" className="mt-6 space-y-2">
                <p className="text-sm text-[var(--el-ink)]">
                  전사를 불러오지 못했습니다.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-[30px]"
                  onClick={() => void transcriptQuery.refetch()}
                >
                  다시 시도
                </Button>
              </div>
            ) : (
              <div className="mt-3">
                {rows.map((row) =>
                  row.type === "gap" ? (
                    <TranscriptGapRow key={row.gap.gapId} row={row.gap} />
                  ) : (
                    <article
                      key={row.segment.segmentId}
                      ref={segmentRef(row.segment.segmentId)}
                      /* 도착한 줄로 포커스를 옮긴다(`use-transcript-focus` 참조). */
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
                            // **지정이 도는 동안 다른 메뉴도 잠근다.**
                            //
                            // 만들기는 두 왕복(POST 뒤 PUT)이고, 그 사이 다른 발화에서 고른
                            // 최신 선택이 먼저 저장되면 **늦게 도착한 PUT 이 그것을 되돌린다.**
                            // `createGuest` 만 보면 POST 가 끝난 시점에 풀려 **첫 PUT 이 아직
                            // 도는 동안** 다음 지정이 나가고, 둘의 도착 순서가 뒤집히면 화면이
                            // 앞 선택으로 되돌아간다. 지정끼리도 같은 경쟁이라 함께 잠근다.
                            disabled={
                              createGuest.isPending ||
                              assign.isPending ||
                              assignSegment.isPending ||
                              resolvingOverrides
                            }
                            candidatesFailed={candidatesFailed}
                            candidatesPending={candidatesPending}
                            onRetryCandidates={retryCandidates}
                            // 열 때 다시 읽는다. 그동안 `candidatesPending` 이 서서
                            // 「＋ 추가」가 닫히므로, 낡은 캐시로 동명이인을 만들 창이 없다.
                            onOpen={retryCandidates}
                            overridden={Boolean(
                              row.segment.assignedParticipantId
                            )}
                            onAssign={(target, scope) => {
                              if (scope === "segment") {
                                // 해제가 아니라 지정이다 — 「이름 안 붙임」은 라벨 범위에만 있다
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
                            // **후보를 다 못 읽었으면 만들기를 아예 안 내보낸다.** 메뉴가
                            // `onCreateGuest` 가 없으면 「＋ 추가」를 숨긴다.
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
                                // 행을 비우는 게 아니라 지운다 — 다시 라벨을 따른다
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
                  )
                )}
                {truncated ? (
                  <p
                    data-testid="recording-truncated"
                    className="py-4 text-sm text-[var(--el-muted)]"
                  >
                    기록이 끝까지 저장되지 못했습니다.
                  </p>
                ) : null}
                {!rows.length ? (
                  <p className="py-8 text-sm text-[var(--el-muted)]">
                    전사된 대화가 없습니다.
                  </p>
                ) : null}
              </div>
            )}
        </div>
        {/* **「모든 발화에 적용」이 무엇을 지우는지 누르기 전에 말한다.**

            서버는 어차피 그 화자의 발화 단위 지정을 지운다 — 「모든」이 말 그대로여야 하기
            때문이다. 다만 그 몇 줄은 사람이 콕 집어 고쳐 둔 것이라, 말없이 사라지면
            「분명 고쳤는데」가 된다. 취소하면 요청 자체를 안 보낸다. */}
        <AlertDialog
          open={pendingLabelAssign !== null}
          onOpenChange={(next) => {
            if (!next) setPendingLabelAssign(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                개별로 고친 발화도 함께 바뀝니다
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingLabelAssign?.overrides === null
                  ? `화자 ${pendingLabelAssign?.label}에 개별로 지정한 발화가 있는지 확인하지 못했습니다. 모든 발화에 적용하면 그 지정이 사라집니다.`
                  : `화자 ${pendingLabelAssign?.label}에 개별로 지정한 발화가 ${pendingLabelAssign?.overrides ?? 0}개 있습니다. 모든 발화에 적용하면 그 지정이 사라집니다.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
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
                모든 발화에 적용
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ScrollArea>
  );
}
