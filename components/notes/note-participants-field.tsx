"use client";

import { useEffect, useRef, useState } from "react";
import { Settings2, UserPlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import {
  NoteParticipantAvatars,
  ParticipantAvatar,
  type Participant,
} from "@/components/notes/note-participants";
import { Button } from "@/components/ui/button";
import { useOpenSettings } from "@/components/workspace/workspace-app-shell";
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
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import {
  getGetNoteQueryKey,
  getGetNotesQueryKey,
  getNote,
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
import { okData } from "@/lib/api/ok-data";
import { toast } from "@/lib/ui/toast";

type Candidate = {
  key: string;
  userId: string | null;
  guestId: string | null;
  name: string;
  email: string | null;
  image?: string | null;
  departed?: boolean;
};

const PARTICIPANTS_CONFLICT = "NOTE_PARTICIPANTS_CONFLICT";

const meta = { suppressErrorToast: true };

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((value) => b.includes(value));
}

function keyOf(participant: Participant) {
  return participant.userId
    ? `user:${participant.userId}`
    : `guest:${participant.guestId}`;
}

export function NoteParticipantsField({
  noteId,
  projectId,
  workspaceId,
  participants,
  autoOpen = false,
  onAutoOpened,
}: {
  noteId: string;
  projectId: string;
  workspaceId?: string;
  participants: Participant[];
  autoOpen?: boolean;
  onAutoOpened?: () => void;
}) {
  const t = useTranslations("notes.participantsField");
  const tParticipants = useTranslations("notes.participants");
  const tActions = useTranslations("common.actions");
  const queryClient = useQueryClient();
  const openSettings = useOpenSettings();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const workspaceQueryOptions = { query: { enabled: Boolean(workspaceId) } };
  const membersResponse = useGetWorkspaceMembers(
    workspaceId ?? "",
    workspaceQueryOptions
  );
  const guestsResponse = useGetWorkspaceGuests(
    workspaceId ?? "",
    undefined,
    workspaceQueryOptions
  );
  const replaceParticipants = useReplaceNoteParticipants({
    mutation: { meta },
  });
  const replaceGuestParticipants = useReplaceNoteGuestParticipants({
    mutation: { meta },
  });
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

  const membersPending = membersResponse.isPending;
  const membersFailed =
    membersResponse.isError || (!membersPending && members.length === 0);
  const guestsPending = guestsResponse.isPending;
  const guestsFailed =
    guestsResponse.isError ||
    (!guestsPending && guestsData !== undefined && guestsData.status !== 200);

  /** TanStack 은 캐시를 든 리패치 중 `isPending=false, isFetching=true` 라, 만들기 판정은 `isFetching` 도 「아직」으로 친다. */
  const candidatesRefetching =
    membersResponse.isFetching || guestsResponse.isFetching;

  /** `isError` 를 보면 안 된다 — TanStack 은 리패치가 실패해도 `data` 를 들고 `isError=true` 가 된다. */
  const candidatesLoaded =
    members.length > 0 && guestsData?.status === 200 && guestsData.data.success;

  const candidateSourcesReady =
    Boolean(workspaceId) &&
    candidatesLoaded &&
    !membersPending &&
    !membersFailed &&
    !guestsPending &&
    !guestsFailed &&
    !candidatesRefetching;

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
    ...participants
      .filter(
        (participant) =>
          (participant.userId === null ||
            (candidatesLoaded &&
              !members.some(
                (member) => member.userId === participant.userId
              ))) &&
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
  const [draft, setDraft] = useState<string[] | null>(null);
  const baseRef = useRef<string[] | null>(null);
  const desiredRef = useRef<string[] | null>(null);
  const flushingRef = useRef(false);
  const openRef = useRef(false);
  const [pinned, setPinned] = useState<string[]>([]);
  /** base-ui 가 후보를 거를 때 쓰는 값. 한글 조합 중에는 안 올라온다. */
  const [search, setSearch] = useState("");
  /** 사람이 친 그대로의 값(조합 중인 글자 포함). 이름을 짓는 자리는 이쪽을 본다 — [search] 로 지으면 「이민형」이 「이민」이 된다. */
  const [typed, setTyped] = useState("");
  const selectedKeys = draft ?? saved;
  const selectedCandidates = candidates.filter((candidate) =>
    selectedKeys.includes(candidate.key)
  );
  const unlistedKeys = selectedKeys.filter(
    (key) => !candidates.some((candidate) => candidate.key === key)
  );

  const trimmedSearch = typed.trim();
  const searchTextOf = (candidate: Candidate) =>
    `${candidate.name} ${candidate.email ?? tParticipants("external")}`;
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
      queryClient.invalidateQueries({
        queryKey: getGetWorkspaceGuestsQueryKey(workspaceId ?? ""),
      }),
    ]);
  }

  function mergeDraft(next: string[], base: string[], current: string[]) {
    const turnedOn = next.filter((key) => !base.includes(key));
    const turnedOff = base.filter((key) => !next.includes(key));
    const merged = new Set(current);
    for (const key of turnedOn) merged.add(key);
    for (const key of turnedOff) merged.delete(key);
    return [...merged];
  }

  async function save(
    next: string[],
    from: string[]
  ): Promise<string[] | null> {
    if (sameSet(next, from)) return from;
    let base = from;

    try {
      let target = next;
      for (let attempt = 0; ; attempt++) {
        const failures = await send(target, base);
        if (failures.length === 0) return target;
        if (
          attempt === 0 &&
          failures.some((e) => errorCodeOf(e) === PARTICIPANTS_CONFLICT)
        ) {
          const latest = okData(
            await getNote(noteId).catch(() => undefined)
          )?.participants.map(keyOf);
          if (latest) {
            target = mergeDraft(next, base, latest);
            base = latest;
            continue;
          }
        }
        for (const error of failures) {
          toast.error(errorMessageOf(error, t("saveFailed")));
        }
        return null;
      }
    } finally {
      await invalidateNote();
    }
  }

  async function send(target: string[], base: string[]) {
    const idsOf = (keys: string[], prefix: string) =>
      keys
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length));
    const userIds = idsOf(target, "user:");
    const guestIds = idsOf(target, "guest:");
    const expectedUserIds = idsOf(base, "user:");
    const expectedGuestIds = idsOf(base, "guest:");

    const requests: Array<Promise<unknown>> = [];
    if (!sameSet(userIds, expectedUserIds)) {
      requests.push(
        replaceParticipants.mutateAsync({
          noteId,
          data: { userIds, expectedUserIds },
        })
      );
    }
    if (!sameSet(guestIds, expectedGuestIds)) {
      requests.push(
        replaceGuestParticipants.mutateAsync({
          noteId,
          data: { guestIds, expectedGuestIds },
        })
      );
    }
    const results = await Promise.allSettled(requests);
    return results.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : []
    );
  }

  const shown = filterByTyped(
    [...candidates].sort(
      (a, b) => Number(pinned.includes(b.key)) - Number(pinned.includes(a.key))
    ),
    typed,
    searchTextOf
  );

  async function createGuest(displayName: string) {
    let createdKey: string | undefined;
    try {
      const response = await createGuestParticipant.mutateAsync({
        noteId,
        data: { displayName },
      });
      if (response.status === 201 && response.data.success) {
        const created = response.data.data.participants.find(
          (participant) =>
            participant.participantId === response.data.data.participantId
        );
        createdKey = created?.guestId ? `guest:${created.guestId}` : undefined;
      }
    } catch {
      return;
    }
    if (createdKey) {
      const withCreated = (keys: string[]) =>
        keys.includes(createdKey) ? keys : [...keys, createdKey];
      if (baseRef.current) baseRef.current = withCreated(baseRef.current);
      if (desiredRef.current) {
        desiredRef.current = withCreated(desiredRef.current);
        setDraft(desiredRef.current);
      }
    }
    setSearch("");
    setTyped("");
    await Promise.all([
      invalidateNote(),
      queryClient.invalidateQueries({
        queryKey: getGetWorkspaceGuestsQueryKey(workspaceId ?? ""),
      }),
    ]);
  }

  async function flush() {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      while (desiredRef.current && baseRef.current) {
        const target = desiredRef.current;
        const achieved = await save(target, baseRef.current);
        if (achieved === null) {
          desiredRef.current = null;
          break;
        }
        baseRef.current = achieved;
        if (desiredRef.current === target) desiredRef.current = null;
        else if (desiredRef.current) {
          desiredRef.current = mergeDraft(desiredRef.current, target, achieved);
          setDraft(desiredRef.current);
        }
      }
    } finally {
      flushingRef.current = false;
      baseRef.current = null;
      desiredRef.current = null;
      setDraft(null);
    }
  }

  const saving =
    replaceParticipants.isPending ||
    replaceGuestParticipants.isPending ||
    createGuestParticipant.isPending;

  useEffect(() => {
    if (!autoOpen) return;
    const trigger = anchorRef.current?.querySelector<HTMLButtonElement>(
      'button[data-slot="participants-add"]'
    );
    if (!trigger || trigger.disabled) return;
    trigger.click();
    if (openRef.current) onAutoOpened?.();
  }, [autoOpen, onAutoOpened, saving]);

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
          {t("empty")}
        </span>
      )}

      {/* 검색 입력을 팝업 안에 두면 기본 앵커(입력)가 팝업 자신이 되어 위치가 무너진다 — 트리거를 앵커로 명시한다. */}
      <span ref={anchorRef} className="inline-flex">
        <Combobox
          // base-ui 는 조합이 끝나기 전까지 controlled 값을 안 올려 한글 한 글자로는 목록이 안 좁혀진다. 조합 중인 글자로도 거른다.
          items={shown}
          multiple
          value={selectedCandidates}
          itemToStringLabel={searchTextOf}
          isItemEqualToValue={(a: Candidate, b: Candidate) => a.key === b.key}
          onValueChange={(next: Candidate[]) => {
            const keys = [
              ...next.map((candidate) => candidate.key),
              ...unlistedKeys,
            ];
            if (baseRef.current === null) baseRef.current = saved;
            desiredRef.current = keys;
            setDraft(keys);
            void flush();
          }}
          inputValue={search}
          onInputValueChange={(value: string) => {
            setSearch(value);
            setTyped(value);
          }}
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            openRef.current = nextOpen;
            if (nextOpen) {
              setPinned(selectedKeys);
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
          }}
        >
          <ComboboxTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                // combobox 롤은 내용에서 이름을 안 가져온다 — 라벨을 명시해야 읽힌다.
                aria-label={t("add")}
                data-slot="participants-add"
                className="rounded-full"
              >
                <UserPlus /> {t("add")}
              </Button>
            }
          />
          <ComboboxContent anchor={anchorRef} align="start" className="w-72">
            <ComboboxInput
              // 이 입력도 role="combobox"라 placeholder로는 이름이 안 붙는다.
              aria-label={t("searchLabel")}
              placeholder={t("searchPlaceholder")}
              // 일치하는 사람이 없을 때 Enter 는 「＋ 추가」의 확인이다. 한글 조합 중 Enter 는 글자를 확정할 뿐이라 거른다.
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.nativeEvent.isComposing &&
                  canCreateGuest &&
                  !createGuestParticipant.isPending &&
                  shown.length === 0
                ) {
                  event.preventDefault();
                  void createGuest(trimmedSearch);
                }
              }}
              // 바깥에 이미 트리거가 있다 — 켜 두면 같은 id의 이름 없는 트리거가 하나 더 생긴다.
              showTrigger={false}
              onTypedValueChange={setTyped}
            />
            <ComboboxEmpty>
              {membersPending || guestsPending
                ? t("loading")
                : membersFailed
                  ? t("membersFailed")
                  : guestsFailed
                    ? t("guestsFailed")
                    : t("noMatch")}
            </ComboboxEmpty>
            <ComboboxList>
              {(candidate: Candidate) => (
                <ComboboxItem key={candidate.key} value={candidate}>
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
                      {candidate.departed
                        ? t("departed")
                        : (candidate.email ?? tParticipants("external"))}
                    </span>
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
            {canCreateGuest ? (
              <div className="border-t border-border p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  loading={createGuestParticipant.isPending}
                  onClick={() => void createGuest(trimmedSearch)}
                >
                  {t("createGuest", { name: trimmedSearch })}
                </Button>
                <p className="px-2 pt-0.5 pb-1 text-xs text-[var(--el-muted)]">
                  {t("createGuestHint")}
                </p>
              </div>
            ) : null}
            {membersFailed || guestsFailed ? (
              <div className="border-t border-border p-1">
                <p className="px-2 pb-1 text-xs text-[var(--el-muted)]">
                  {membersFailed && guestsFailed
                    ? t("bothFailed")
                    : membersFailed
                      ? t("membersFailed")
                      : t("guestsFailed")}
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
                  {tActions("retry")}
                </Button>
              </div>
            ) : null}
            {openSettings ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-xs text-[var(--el-muted)] hover:text-[var(--el-ink)]"
                onClick={() => {
                  setOpen(false);
                  openRef.current = false;
                  openSettings("guests");
                }}
              >
                <Settings2 aria-hidden className="size-3.5 shrink-0" />
                {t("manageGuests")}
              </button>
            ) : null}
          </ComboboxContent>
        </Combobox>
      </span>
    </div>
  );
}
