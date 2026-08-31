"use client";

import { useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import {
  EXTERNAL_LABEL,
  NoteParticipantAvatars,
  ParticipantAvatar,
  type Participant,
} from "@/components/notes/note-participants";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  filterByTyped,
} from "@/components/ui/combobox";
import {
  getGetNoteQueryKey,
  getGetNotesQueryKey,
  useCreateNoteGuestParticipant,
  useReplaceNoteGuestParticipants,
  useReplaceNoteParticipants,
} from "@/lib/api/generated/notes/notes";
import {
  getGetWorkspaceGuestsQueryKey,
  useGetWorkspaceGuests,
} from "@/lib/api/generated/workspaces/workspaces";
import {
  getGetWorkspaceMembersQueryKey,
  useGetWorkspaceMembers,
} from "@/lib/api/generated/workspace-members/workspace-members";

/**
 * 후보 하나. 계정 멤버와 임시 참여자가 같은 목록에 선다.
 *
 * `key`가 `user:<id>` / `guest:<id>` 인 이유는 **저장할 때 어느 요청에 실을지가 여기서
 * 갈리기** 때문이다. 두 종류를 한 배열에 담고 나중에 타입을 되짚으면 그 판정이 목록 조회
 * 결과에 의존하게 되는데, 방금 만든 임시 참여자는 아직 그 목록에 없을 수 있다.
 */
type Candidate = {
  key: string;
  userId: string | null;
  guestId: string | null;
  name: string;
  email: string | null;
  image?: string | null;
  /**
   * 이 회의의 참여자인데 **워크스페이스 멤버도 임시 참여자도 아닌** 사람.
   *
   * 멤버를 내보내도 참여 기록은 남는다 — 그 회의록은 그 사람이 실제로 참여한 기록이고
   * 전사의 화자 연결이 그 위에 선다. 후보를 멤버·게스트로만 세우면 **그 사람이 화면에서
   * 사라져 뺄 수도 없다.**
   *
   * 이미 고른 상태로만 선다. **새로 붙이는 길은 아니다** — 참여자가 아니었던 회의록에는
   * 애초에 안 나타나고, 서버도 「이미 참여자」인 경우에만 받는다.
   */
  departed?: boolean;
};

/**
 * 워크스페이스를 떠난 참여자의 부표시.
 *
 * 이메일 대신 이걸 세운다 — 이메일은 「이 사람이 누구인가」를 말하는데, 여기서 답해야 할
 * 물음은 「멤버 목록에 없는 사람이 왜 후보에 있나」다. 나갔다/내보내졌다를 가르지 않는다.
 * 화면에서 할 수 있는 일이 같고, 가르려면 멤버십 이력이 있어야 한다.
 */
const DEPARTED_LABEL = "워크스페이스에 없음";

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((value) => b.includes(value));
}

function keyOf(participant: Participant) {
  return participant.userId
    ? `user:${participant.userId}`
    : `guest:${participant.guestId}`;
}

/**
 * 참석자를 combobox에서 고른다. 후보는 **워크스페이스 멤버와 임시 참여자**다 — 계정 없는
 * 사람도 회의 참여자가 될 수 있어서다(APP-490).
 *
 * **닫힐 때 한 번만 저장한다.** 고를 때마다 보내면 요청이 줄줄이 나가고 응답이 보낸 순서대로
 * 돌아온다는 보장도 없다. 서버가 전체 교체라 마지막 상태 한 번이면 충분하다.
 *
 * **저장은 두 요청으로 갈라 보낸다.** 계정 참여자와 임시 참여자의 경로가 서버에서 다르고,
 * 한 요청에 섞으면 멤버 하나를 바꿀 때마다 임시 참여자가 함께 지워진다.
 */
export function NoteParticipantsField({
  noteId,
  projectId,
  workspaceId,
  participants,
}: {
  noteId: string;
  projectId: string;
  /** 확인된 소속. 확인 전에는 `undefined` 라 조회를 안 걸고 만들기를 안 연다. */
  workspaceId?: string;
  participants: Participant[];
}) {
  const queryClient = useQueryClient();
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  // **소속이 확인되기 전에는 안 읽는다.** 확인 전 값으로 읽으면 남의 워크스페이스 후보가 선다.
  const workspaceQueryOptions = { query: { enabled: Boolean(workspaceId) } };
  const membersResponse = useGetWorkspaceMembers(workspaceId ?? "", workspaceQueryOptions);
  const guestsResponse = useGetWorkspaceGuests(workspaceId ?? "", workspaceQueryOptions);
  // 실패 토스트는 전역(`MutationCache.onError`)이 서버 문구 그대로 띄운다. 여기서 또 띄우면
  // 두 개가 겹친다 — opt-out은 화면이 인라인으로 그리거나 코드별 문구가 갈릴 때만 쓴다.
  const replaceParticipants = useReplaceNoteParticipants();
  const replaceGuestParticipants = useReplaceNoteGuestParticipants();
  const createGuestParticipant = useCreateNoteGuestParticipant();

  const membersData = membersResponse.data;
  const members =
    membersData?.status === 200 && membersData.data.success
      ? membersData.data.data.members
      : [];
  const guestsData = guestsResponse.data;
  const guests =
    guestsData?.status === 200 && guestsData.data.success
      ? guestsData.data.data.guests
      : [];

  // 로딩과 실패를 뭉치면 목록을 연 직후 "불러오지 못했습니다"가 먼저 뜬다.
  const membersPending = membersResponse.isPending;
  /**
   * **빈 목록만 보지 않는다.** 워크스페이스에는 최소한 부른 사람이 있으므로 빈 목록은 실패다.
   * 그런데 **캐시가 있는 채로 리패치만 실패하면** 길이가 0이 아니라 그 신호를 놓친다 —
   * 그 사이 새로 들어온 멤버가 후보에 없는데 「＋ 추가」는 살아 있어 **같은 사람을 임시
   * 참여자로 또 만든다.**
   */
  const membersFailed =
    membersResponse.isError || (!membersPending && members.length === 0);
  /**
   * **임시 참여자 조회 실패를 따로 본다.**
   *
   * 멤버 조회만 보면, 임시 참여자 쪽이 실패해도 멤버가 한 명이라도 있는 한 화면은 「없음」과
   * 구분이 안 된다 — 사람은 그 사람이 없다고 믿고 같은 이름을 하나 더 만든다.
   *
   * 빈 목록은 실패가 아니다 — 한 명도 없는 것이 정상이라, `isError` 와 오류 봉투만 본다.
   */
  const guestsPending = guestsResponse.isPending;
  const guestsFailed =
    guestsResponse.isError ||
    (!guestsPending && guestsData !== undefined && guestsData.status !== 200);

  /**
   * **후보 두 갈래를 다 읽었나.**
   *
   * 못 읽은 갈래는 빈 목록이라 「없다」와 구분이 안 된다. 그 상태에서 판정하면 둘이 함께
   * 틀린다 — 멀쩡한 참여자가 **「워크스페이스에 없음」**으로 보이고, 이미 있는 사람의 이름을
   * 쳐도 **「＋ 추가」가 떠서 같은 이름이 하나 더** 만들어진다.
   */
  /**
   * **`isFetching` 도 「아직」이다.** TanStack 은 캐시를 든 채 다시 읽을 때
   * `isPending=false, isFetching=true` 다. `isPending` 만 보면 **다시 읽는 중을 다 읽었다로
   * 번역**하고, 그 창에서 이미 있는 이름을 치면 낡은 캐시에 그가 없어 「＋ 추가」가 열려
   * **같은 이름이 하나 더** 만들어진다. 메뉴를 열 때마다 다시 읽으므로 이 창은 늘 생긴다.
   *
   * **표시 규칙과 다르다.** 「이미 그린 데이터를 리패치로 덮지 않는다」(rule `error-loading`)는
   * *무엇을 그리나*의 규칙이고, 이것은 *만들기를 열어도 되나*의 판정이다. 아래 로딩 표시는
   * 그대로 `isPending` 으로 가른다 — 후보 목록이 깜빡이지 않아야 한다.
   */
  const candidatesRefetching =
    membersResponse.isFetching || guestsResponse.isFetching;

  /**
   * **지금 손에 목록을 들고 있나.** 「이 사람이 목록에 없다」를 말해도 되는 조건이다.
   *
   * **`isError` 를 보면 안 된다.** TanStack 은 캐시를 든 채 리패치가 실패해도 `data` 를 그대로
   * 들고 `isError=true` 가 된다. 그것을 「못 읽었다」로 읽으면 워크스페이스를 떠난 참여자가
   * 「위 둘에 없는 사람」으로 안 걸려 목록에서 사라지고, **그 사이 해제할 수 없다.**
   *
   * 실패도 리패치도 여기 안 들어온다 — **들고 있는 것이 있으면 그것으로 그린다.**
   */
  const candidatesLoaded =
    members.length > 0 && guestsData?.status === 200 && guestsData.data.success;

  /**
   * **지금 이 순간 목록이 최신인가.** 새 이름을 만들어도 되는 조건이다.
   *
   * 위와 달리 리패치 중을 **「아직」으로 친다.** 캐시로 그리는 것은 괜찮지만, 그 캐시에 없다는
   * 이유로 **같은 이름을 하나 더 만들면** 되돌릴 수 없다. 판정 둘을 한 변수로 겸용하면 한쪽을
   * 고칠 때 다른 쪽이 조용히 망가진다 — 실제로 그렇게 됐다.
   */
  /**
   * **지금 이 순간 목록이 최신인가.** 새 이름을 만들어도 되는 조건이다.
   *
   * 위와 달리 **실패도 리패치도 「아직」으로** 친다. 캐시로 그리는 것은 괜찮지만, 그 캐시에
   * 없다는 이유로 **같은 이름을 하나 더 만들면** 되돌릴 수 없다. 판정 둘을 한 변수로 겸용하면
   * 한쪽을 고칠 때 다른 쪽이 조용히 망가진다 — 실제로 두 번 그랬다.
   */
  const candidateSourcesReady =
    Boolean(workspaceId) &&
    candidatesLoaded &&
    !membersPending &&
    !membersFailed &&
    !guestsPending &&
    !guestsFailed &&
    !candidatesRefetching;

  /**
   * 멤버와 임시 참여자를 이름순으로 섞는다 — 서버가 참여자를 돌려주는 순서와 같다.
   *
   * `useMemo`를 안 쓴다. 두 목록이 매 렌더 새 배열이라 의존이 늘 바뀌어 아무것도 기억하지
   * 못했다 — 기억하는 척하는 비용만 남는다. 워크스페이스 하나의 사람 수가 팀 규모다.
   */
  const candidates: Candidate[] = [
    ...members.map((member) => ({
      key: `user:${member.userId}`,
      userId: member.userId,
      guestId: null,
      name: member.name,
      email: member.email,
      image: member.image,
    })),
    ...guests.map((guest) => ({
      key: `guest:${guest.guestId}`,
      userId: null,
      guestId: guest.guestId,
      name: guest.displayName,
      email: null,
      image: null,
    })),
    // **참여자인데 위 둘에 없는 사람.** 워크스페이스를 떠난 뒤에도 이 회의록에는 남아 있다.
    //
    // **조회를 못 읽었으면 「없다」고 판정하지 않는다.** 로딩 중이거나 실패하면 그 목록이
    // 비는데, 그대로 두면 **멀쩡한 참여자가 전부 「워크스페이스에 없음」으로 보인다.**
    ...participants
      .filter(
        (participant) =>
          (participant.userId === null ||
            (candidatesLoaded &&
              !members.some((member) => member.userId === participant.userId))) &&
          (participant.guestId === null ||
            (candidatesLoaded &&
              !guests.some((guest) => guest.guestId === participant.guestId)))
      )
      .map((participant) => ({
        key: keyOf(participant),
        userId: participant.userId,
        guestId: participant.guestId,
        name: participant.name,
        email: participant.email,
        image: participant.image,
        departed: true,
      })),
  ].sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key));

  const saved = participants.map(keyOf);
  /**
   * 사용자가 **실제로 골랐을 때만** 채워지는 임시 선택. 열 때 미리 채우지 않는다 —
   * 열어만 두고 닫는 동안 폴링이 다른 사람의 변경을 가져오면, 아무것도 안 건드린 사용자가
   * 열던 시점의 낡은 목록으로 그 변경을 되돌리게 된다. null이면 보낼 것이 없다는 뜻이다.
   */
  const [draft, setDraft] = useState<string[] | null>(null);
  /**
   * **draft 를 시작한 순간의 저장된 목록.** 3자 병합의 기준점이다.
   *
   * 이것 없이 draft 를 그대로 전체 교체로 보내면, 메뉴를 연 뒤 도착한 참여자가 **draft 에
   * 없다는 이유로 지워진다** — 열 때 최신을 당기는 것이 오히려 남의 참여자를 지우는 길이 된다.
   * 사람이 실제로 한 것은 「무엇을 켰고 무엇을 껐나」지 「목록이 이것이다」가 아니다.
   */
  const draftBaseRef = useRef<string[] | null>(null);
  /**
   * 메뉴가 지금 열려 있나. **ref 다** — 임시 참여자 만들기가 비동기라, 그 사이 닫혔는지를
   * 완료 시점에 봐야 하는데 state 는 그 클로저에 갇힌 옛 값을 준다.
   */
  const openRef = useRef(false);
  /**
   * **만드는 동안 닫히면 저장을 여기 맡긴다.**
   *
   * 그때의 draft 는 방금 만드는 사람을 아직 모른다. 그대로 저장하면 POST 뒤에 도착한 PUT 이
   * **방금 만든 사람을 회의에서 다시 뺀다.** 만들기가 끝난 뒤 그 사람을 합쳐서 저장한다.
   */
  const deferredSave = useRef<string[] | null>(null);
  /**
   * 만들기가 도는 중인가. **훅의 `isPending` 을 안 쓴다** — 저 값은 렌더 사이에 갱신되는
   * 상태라 같은 틱에 닫히는 경로가 옛 값을 읽는다. 여기서 직접 들고 있으면 순서가 확실하다.
   */
  const creatingRef = useRef(false);
  /** base-ui 가 후보를 거를 때 쓰는 값. 조합 중에는 안 올라온다 — 그게 맞는 동작이다. */
  const [search, setSearch] = useState("");
  /**
   * 사람이 **친 그대로**의 값. 조합 중인 마지막 글자까지 들어 있다.
   *
   * 이름을 짓는 자리(「＋ 추가」)는 이쪽을 봐야 한다. [search]로 지으면 「이민형」이
   * 「이민」으로 만들어진다.
   */
  const [typed, setTyped] = useState("");
  const selectedKeys = draft ?? saved;
  const selectedCandidates = candidates.filter((candidate) =>
    selectedKeys.includes(candidate.key)
  );
  /**
   * **후보 목록에 없는 선택**. 조회가 실패했거나 아직 안 들어온 사람들이다.
   *
   * 이 값이 없으면 저장된 참여자가 조용히 지워진다 — 목록 컴포넌트는 후보에 있는 것만
   * 골라 돌려주고 그걸로 draft 를 통째로 다시 만드는데, 임시 참여자 조회가 실패한 상태에서
   * 멤버 하나만 눌러도 `guestIds: []` 가 나가 **화자 연결까지 함께 사라진다.**
   *
   * 보이지 않는 것은 지울 수도 없어야 한다. 그래서 저장은 하되 화면에는 안 세운다.
   */
  const unlistedKeys = selectedKeys.filter(
    (key) => !candidates.some((candidate) => candidate.key === key)
  );

  /**
   * 정확히 같은 이름의 후보가 없을 때만 만들기를 보여준다.
   *
   * 부분 일치로 열어 두면 「박」을 치는 동안 계속 떠서, 이미 있는 사람을 옆에 두고 같은
   * 이름을 하나 더 만들기 쉬워진다. 동명이인은 허용하지만 **실수로 만드는 것**은 막는다.
   */
  const trimmedSearch = typed.trim();
  /** 콤보박스가 거르는 문자열과 **같은 값**이어야 한다. 갈리면 조합 전후로 목록이 튄다. */
  const searchTextOf = (candidate: Candidate) =>
    `${candidate.name} ${candidate.email ?? EXTERNAL_LABEL}`;
  /**
   * **후보를 다 못 읽었으면 새 이름을 만들 수 없다.**
   *
   * 조회가 도는 동안이나 실패한 뒤에는 그 갈래가 빈 목록이라, 이미 있는 사람의 이름을 쳐도
   * 후보에서 못 찾고 **같은 이름을 하나 더 만든다.**
   */
  const canCreateGuest =
    candidateSourcesReady &&
    trimmedSearch.length > 0 &&
    !candidates.some((candidate) => candidate.name === trimmedSearch);

  async function invalidateNote() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(noteId) }),
      queryClient.invalidateQueries({
        queryKey: getGetNotesQueryKey(projectId),
      }),
      // **임시 참여자 목록의 「회의록 N개」도 이 편집으로 바뀐다.** 안 지우면 설정을 곧바로
      // 열었을 때 삭제가 「회의록 3개에서 사라집니다」로 옛 숫자를 말한다 — 되돌릴 수 없는
      // 조작 앞에 보여주는 숫자라 틀리면 안 된다.
      queryClient.invalidateQueries({
        queryKey: getGetWorkspaceGuestsQueryKey(workspaceId ?? ""),
      }),
    ]);
  }

  /**
   * **사람이 켠 것과 끈 것만 반영한다.**
   *
   * `base` 는 고르기 시작한 순간의 저장 목록, `current` 는 지금 서버가 아는 목록이다. 그 사이
   * 남이 넣은 사람은 `next` 에 없지만 **끈 적도 없으므로 살려야 한다.** 스냅샷을 그대로
   * 보내면 전체 교체라 그 사람과 그의 화자 연결이 함께 사라진다.
   */
  function mergeDraft(next: string[], base: string[], current: string[]) {
    // **최신에서 출발해 내 델타만 얹는다.** `next` 에서 출발하면 그 안에 `base` 시절 사람이
    // 그대로 들어 있어, 그 사이 남이 **뺀** 사람까지 되살아난다 — 그 사람의 화자 연결은
    // 이미 지워졌으므로 이름만 돌아오고 연결은 안 돌아온다.
    const turnedOn = next.filter((key) => !base.includes(key));
    const turnedOff = base.filter((key) => !next.includes(key));
    const merged = new Set(current);
    for (const key of turnedOn) merged.add(key);
    for (const key of turnedOff) merged.delete(key);
    return [...merged];
  }

  async function save(next: string[]) {
    if (sameSet(next, saved)) return;

    // **key에서 바로 뽑는다.** 후보 목록에서 되찾으면 방금 만든 임시 참여자가 아직 조회에
    // 안 들어와 조용히 빠진 채로 전체 교체가 나간다.
    const userIds = next
      .filter((key) => key.startsWith("user:"))
      .map((key) => key.slice("user:".length));
    const guestIds = next
      .filter((key) => key.startsWith("guest:"))
      .map((key) => key.slice("guest:".length));

    const savedUserIds = saved
      .filter((key) => key.startsWith("user:"))
      .map((key) => key.slice("user:".length));
    const savedGuestIds = saved
      .filter((key) => key.startsWith("guest:"))
      .map((key) => key.slice("guest:".length));

    // `apiFetch`는 비-2xx 봉투를 그대로 throw한다(`parseResponse`). 실패는 전역 토스트가
    // 서버 문구로 알린다.
    //
    // **성공 여부와 무관하게 다시 읽는다.** 요청이 둘이라 앞이 성공하고 뒤가 실패하는
    // 부분 성공이 있다 — 그때 갱신을 건너뛰면 서버에는 앞 변경이 적용됐는데 화면은 둘 다
    // 실패한 것처럼 옛 목록을 들고 있어, 사람이 본 것과 저장된 것이 갈린다.
    //
    // **둘을 이어 붙이지 않는다.** `try { A; B }` 로 두면 A 가 실패했을 때 B 를 **아예 안
    // 보낸다** — 사람은 한 번의 저장으로 둘을 다 바꿨는데 임시 참여자 변경은 시도조차 안 된
    // 채 토스트만 하나 뜬다. 두 경로는 서로 독립이라 각자 보내고, 결과는 아래 갱신이 맞춘다.
    const requests: Array<Promise<unknown>> = [];
    if (!sameSet(userIds, savedUserIds)) {
      requests.push(replaceParticipants.mutateAsync({ noteId, data: { userIds } }));
    }
    if (!sameSet(guestIds, savedGuestIds)) {
      requests.push(
        replaceGuestParticipants.mutateAsync({ noteId, data: { guestIds } })
      );
    }
    try {
      // 실패는 전역 토스트가 서버 문구로 알린다. 여기서는 삼키되 **갱신은 건너뛰지 않는다.**
      await Promise.allSettled(requests);
    } finally {
      await invalidateNote();
    }
  }

  async function createGuest(displayName: string) {
    let createdKey: string | undefined;
    creatingRef.current = true;
    try {
      const response = await createGuestParticipant.mutateAsync({
        noteId,
        data: { displayName },
      });
      if (response.status === 201 && response.data.success) {
        // **응답이 만든 사람을 직접 짚어 준다.** 이름으로 되찾으면 동명이인이 섞였을 때
        // 엉뚱한 사람이 골라진다 — 같은 이름을 막지 않는 것이 이 기능의 규칙이다.
        const created = response.data.data.participants.find(
          (participant) =>
            participant.participantId === response.data.data.participantId
        );
        createdKey = created?.guestId ? `guest:${created.guestId}` : undefined;
      }
    } catch {
      // **만들기가 실패해도 보류해 둔 변경은 저장한다.** 사람이 생성 전에 토글한 다른
      // 참석자까지 같이 버리면, 토스트는 「만들기 실패」 하나인데 **고른 것도 통째로**
      // 사라진다. 새 사람만 빠지고 나머지는 사람이 고른 그대로여야 한다.
      creatingRef.current = false;
      const pending = deferredSave.current;
      deferredSave.current = null;
      if (pending) void save(pending);
      return;
    } finally {
      creatingRef.current = false;
    }
    // **만든 사람을 지금 draft 에 넣는다.** 만들기 API 는 그 사람을 회의에 곧바로 넣지만,
    // 메뉴를 닫을 때 도는 `save(draft)` 가 그를 모르면 `guestIds` 에서 빠뜨려 **방금 만든
    // 사람을 다시 지운다.**
    //
    // **닫힌 뒤에는 안 세운다.** 만드는 동안 Escape 로 닫으면 `onOpenChange` 가 draft 를
    // 비우고 이미 저장까지 마친다. 거기서 draft 를 되살리면 **아무도 안 연 채로 낡은
    // 선택이 남아**, 다음에 열었다 닫을 때 그것이 최신 참여자를 통째로 되돌린다.
    if (createdKey && openRef.current) {
      setDraft((current) => {
        // **여기서도 기준점을 박는다.** 만들기로만 draft 가 생기면 `base` 가 없어서, 닫을 때
        // 현재값을 기준으로 삼는다 — 그 사이 남이 넣은 사람을 「사람이 껐다」로 오인해
        // **전체 교체가 지운다.** 토글로 생긴 draft 만 기준점을 잡던 것이 이 구멍이었다.
        if (current === null) draftBaseRef.current = saved;
        const next = current ?? saved;
        return next.includes(createdKey) ? next : [...next, createdKey];
      });
    } else if (createdKey && deferredSave.current) {
      // 만드는 사이 닫혔다 — 미뤄 둔 저장에 이 사람을 합쳐 지금 보낸다.
      const pending = deferredSave.current;
      deferredSave.current = null;
      void save(pending.includes(createdKey) ? pending : [...pending, createdKey]);
    } else {
      deferredSave.current = null;
    }
    setSearch("");
    setTyped("");
    // 만든 사람은 이 회의의 참여자이자 워크스페이스의 임시 참여자다 — 둘 다 다시 읽는다.
    await Promise.all([
      invalidateNote(),
      queryClient.invalidateQueries({
        queryKey: getGetWorkspaceGuestsQueryKey(workspaceId ?? ""),
      }),
    ]);
  }

  const saving =
    replaceParticipants.isPending ||
    replaceGuestParticipants.isPending ||
    createGuestParticipant.isPending;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {participants.length > 0 ? (
        <NoteParticipantAvatars
          participants={participants}
          max={5}
          size="default"
        />
      ) : (
        <span className="text-sm text-[var(--el-muted)]">
          아직 참여자가 없습니다.
        </span>
      )}

      {/* 팝업이 트리거가 아니라 화면 엉뚱한 곳에 붙던 자리다. 검색 입력을 팝업 안에 두면
          기본 앵커(입력)가 팝업 자신이 되어 위치가 무너진다 — 트리거를 앵커로 명시한다. */}
      <span ref={anchorRef} className="inline-flex">
        <Combobox
          // **조합 중인 글자로도 거른다.** base-ui 는 조합이 끝나기 전까지 controlled 값을
          // 안 올려, 한글 한 글자를 쳐도 목록이 안 좁혀진다 — 이유는 `filterByTyped` 에.
          items={filterByTyped(candidates, typed, searchTextOf)}
          multiple
          value={selectedCandidates}
          // 이름과 이메일을 한 문자열로 합쳐 어느 쪽으로 쳐도 걸리게 한다.
          itemToStringLabel={searchTextOf}
          isItemEqualToValue={(a: Candidate, b: Candidate) => a.key === b.key}
          onValueChange={(next: Candidate[]) =>
            // 후보에 없어 화면에 못 선 선택을 **그대로 들고 간다.** 안 그러면 조회가
            // 실패한 쪽의 저장된 참여자가 이 토글 한 번에 전체 교체로 지워진다.
            setDraft((current) => {
              // 첫 토글에서 기준점을 박는다. 그 뒤 도착하는 것은 병합으로 살린다.
              if (current === null) draftBaseRef.current = saved;
              return [...next.map((candidate) => candidate.key), ...unlistedKeys];
            })
          }
          inputValue={search}
          onInputValueChange={(value: string) => {
            setSearch(value);
            // 지우기 버튼처럼 입력 이벤트 없이 값이 바뀌는 길도 있다
            setTyped(value);
          }}
          onOpenChange={(open) => {
            openRef.current = open;
            if (open) {
              // 종료된 노트는 폴링이 멈춰 있어 다른 사람이 바꾼 참여자가 안 들어온다.
              // 고르기 직전에 한 번 당겨 선택 상태를 최신으로 맞춘다.
              //
              // **후보 목록도 같이 당긴다.** 후보 조회는 이 메뉴 밖에 마운트되어 캐시를 계속
              // 쓰므로, 다른 회의나 다른 사람이 만든 사람은 여기 안 뜬다 — 그러면 「최신 선택
              // 상태」라는 위 약속이 절반만 지켜지고, **없는 줄 알고 같은 이름을 또 만든다.**
              //
              // **멤버도 당긴다.** 임시 참여자만 당기면 그새 들어온 멤버가 후보에 없어 같은
              // 사람을 임시 참여자로 만들게 된다 — 한쪽만 최신인 것이 더 헷갈린다.
              void Promise.all([
                queryClient.invalidateQueries({
                  queryKey: getGetNoteQueryKey(noteId),
                }),
                queryClient.invalidateQueries({
                  queryKey: getGetWorkspaceGuestsQueryKey(workspaceId ?? ""),
                }),
                queryClient.invalidateQueries({
                  queryKey: getGetWorkspaceMembersQueryKey(workspaceId ?? ""),
                }),
              ]);
              return;
            }
            setSearch("");
            setTyped("");
            const base = draftBaseRef.current;
            // **기준점이 없으면 아무것도 안 껐다는 뜻이다.** `saved` 를 기준으로 삼으면 그
            // 사이 도착한 사람이 「껐다」로 읽혀 지워진다 — 폴백이 곧 구멍이었다. draft 는
            // 토글이든 만들기든 늘 기준점과 함께 생기므로, 없으면 병합할 것도 없다.
            const next =
              draft === null ? null : base === null ? draft : mergeDraft(draft, base, saved);
            setDraft(null);
            draftBaseRef.current = null;
            if (!next) return;
            // 만드는 중이면 저장을 `createGuest` 에 맡긴다. 지금 보내면 그 사람이 빠진다.
            if (creatingRef.current) {
              deferredSave.current = next;
              return;
            }
            void save(next);
          }}
        >
          <ComboboxTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                // combobox 롤은 내용에서 이름을 안 가져온다 — 라벨을 명시해야 읽힌다.
                aria-label="참여자 선택"
                className="rounded-full"
                loading={saving}
              >
                <UserPlus /> 참여자 선택
              </Button>
            }
          />
          <ComboboxContent anchor={anchorRef} align="start" className="w-72">
            <ComboboxInput
              // 이 입력도 role="combobox"라 placeholder로는 이름이 안 붙는다.
              aria-label="이름이나 이메일로 참여자 검색"
              placeholder="이름이나 이메일로 검색"
              // 바깥에 이미 트리거가 있다 — 켜 두면 같은 id의 이름 없는 트리거가 하나 더 생긴다.
              showTrigger={false}
              onTypedValueChange={setTyped}
            />
            <ComboboxEmpty>
              {membersPending || guestsPending
                ? "참여자를 불러오는 중입니다."
                : membersFailed
                  ? "멤버를 불러오지 못했습니다."
                  : guestsFailed
                    ? "임시 참여자를 불러오지 못했습니다."
                    : "일치하는 사람이 없습니다."}
            </ComboboxEmpty>
            <ComboboxList>
              {(candidate: Candidate) => (
                <ComboboxItem key={candidate.key} value={candidate}>
                  {/* 이니셜이 옵션 이름에 섞여 "김 김민수 …"로 읽힌다 — 장식이라 숨긴다. */}
                  <span aria-hidden="true" className="contents">
                    <ParticipantAvatar
                      participant={candidate}
                      size="sm"
                      interactive={false}
                    />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{candidate.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {/* **왜 여기 있는지 말한다.** 멤버 목록에 없는 사람이 후보에 서
                          있으면, 이유가 안 보이면 잘못 남은 것으로 읽고 지운다 */}
                      {candidate.departed
                        ? DEPARTED_LABEL
                        : (candidate.email ?? EXTERNAL_LABEL)}
                    </span>
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
            {canCreateGuest ? (
              // 계정 없는 사람을 그 자리에서 만든다. 이름 말고는 아무것도 안 묻는다 —
              // 이메일을 물으면 대부분 비고, 없는 데이터를 개인정보로 하나 더 들게 된다.
              <div className="border-t border-border p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  loading={createGuestParticipant.isPending}
                  onClick={() => void createGuest(trimmedSearch)}
                >
                  ＋ &quot;{trimmedSearch}&quot; 추가
                </Button>
              </div>
            ) : null}
            {membersFailed || guestsFailed ? (
              // 조회 훅이 목록 밖에 마운트되어 있어 닫았다 열어도 다시 안 부른다.
              <div className="border-t border-border p-1">
                {/* **실패한 쪽을 말한다.** 「불러오지 못했습니다」만 뜨면 무엇이 빠졌는지
                    모른 채 없는 사람으로 여기고 같은 이름을 또 만든다 */}
                <p className="px-2 pb-1 text-xs text-[var(--el-muted)]">
                  {membersFailed && guestsFailed
                    ? "멤버와 임시 참여자를 불러오지 못했습니다."
                    : membersFailed
                      ? "멤버를 불러오지 못했습니다."
                      : "임시 참여자를 불러오지 못했습니다."}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    if (membersFailed) void membersResponse.refetch();
                    if (guestsFailed) void guestsResponse.refetch();
                  }}
                >
                  다시 시도
                </Button>
              </div>
            ) : null}
          </ComboboxContent>
        </Combobox>
      </span>
    </div>
  );
}
