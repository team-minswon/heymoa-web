"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { SpeakerChip } from "@/components/notes/speaker-chip";
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
  speakerAvatarName,
  type SpeakerIdentity,
} from "@/lib/transcription/speaker-identity";
import {
  PersonAvatar,
  personAvatarKey,
} from "@/components/heymoa/person-avatar";

export type SpeakerCandidate = {
  participantId: string | null;
  userId: string | null;
  guestId?: string | null;
  searchOnly?: boolean;
  name: string;
  email: string | null;
  image?: string | null;
  assignedLabels?: string[];
};

export type SpeakerTarget =
  | { participantId: string }
  | { userId: string }
  | { guestId: string };

export function targetOf(candidate: SpeakerCandidate): SpeakerTarget | null {
  if (candidate.participantId)
    return { participantId: candidate.participantId };
  if (candidate.userId) return { userId: candidate.userId };
  if (candidate.guestId) return { guestId: candidate.guestId };
  return null;
}

const searchTextOf = (candidate: SpeakerCandidate, guest: string) =>
  `${candidate.name} ${candidate.email ?? guest}`;

export const candidateKey = (candidate: SpeakerCandidate) =>
  candidate.participantId ??
  candidate.userId ??
  candidate.guestId ??
  candidate.name;

export type AssignScope = "label" | "segment";

const SCOPES: ReadonlyArray<AssignScope> = ["label", "segment"];

/** `DropdownMenu` 가 아니라 `Combobox` 다 — 검색창이 붙으면 메뉴의 타이핑 탐색과 입력이 키를 서로 뺏는다. */
export function SpeakerAssignMenu({
  identity,
  candidates,
  disabled,
  creating = false,
  candidatesFailed = false,
  candidatesPending = false,
  onRetryCandidates,
  onOpen,
  onMenuOpenChange,
  overridden = false,
  onAssign,
  onCreateGuest,
  onClearOverride,
  triggerTestId = "speaker-assign-trigger",
  allowSegmentScope = true,
}: {
  identity: SpeakerIdentity;
  candidates: SpeakerCandidate[];
  disabled?: boolean;
  creating?: boolean;
  candidatesFailed?: boolean;
  candidatesPending?: boolean;
  onRetryCandidates?: () => void;
  onOpen?: () => void;
  onMenuOpenChange?: (open: boolean) => void;
  overridden?: boolean;
  onAssign: (target: SpeakerTarget | null, scope: AssignScope) => void;
  onCreateGuest?: (displayName: string, scope: AssignScope) => void;
  onClearOverride?: () => void;
  triggerTestId?: string;
  allowSegmentScope?: boolean;
}) {
  const t = useTranslations("notes.speakers.assign");
  const tNotes = useTranslations("notes");
  const tActions = useTranslations("common.actions");
  const guest = tNotes("participants.external");
  const textOf = (candidate: SpeakerCandidate) =>
    searchTextOf(candidate, guest);
  const [open, setOpen] = useState(false);
  /** base-ui 가 후보를 거를 때 쓰는 값. 한글 조합 중에는 안 올라온다. */
  const [search, setSearch] = useState("");
  /** 사람이 친 그대로의 값(조합 중인 글자 포함). 이름을 짓는 자리는 이쪽을 본다 — [search] 로 지으면 「이민형」이 「이민」이 된다. */
  const [typed, setTyped] = useState("");
  const [scope, setScope] = useState<AssignScope>("label");

  /** 닫는 길은 하나여야 한다 — `setOpen(false)` 만 부르면 controlled prop 만 바뀌어 `onOpenChange` 의 초기화가 안 돈다. */
  const close = () => {
    setOpen(false);
    onMenuOpenChange?.(false);
    setSearch("");
    setTyped("");
    setScope("label");
  };

  /** 잠긴 동안에도 같은 상자를 세운다 — `inline-flex` 칩은 줄상자에 앉아 글꼴 strut 이 붙어 높이가 달라진다. */
  if (disabled) {
    return (
      <span className="mb-1 -mx-1 flex items-center rounded-chip px-1">
        <SpeakerChip identity={identity} />
      </span>
    );
  }

  const trimmedSearch = typed.trim();
  /**
   * 조합 중인 글자로도 거른다. 콤보박스는 조합이 끝나기 전까지 controlled 값을 안 올리는데 한글은 한 글자가 곧 조합이다.
   * `inputValue` 에 조합 중인 값을 되쓰면 조합이 깨지므로 목록만 여기서 거른다.
   */
  const shown = filterByTyped(
    trimmedSearch ? candidates : candidates.filter((c) => !c.searchOnly),
    trimmedSearch,
    textOf
  );
  const canCreateGuest =
    Boolean(onCreateGuest) &&
    trimmedSearch.length > 0 &&
    !candidates.some((candidate) => candidate.name === trimmedSearch);

  return (
    <Combobox
      items={shown}
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setOpen(true);
          onMenuOpenChange?.(true);
          onOpen?.();
          return;
        }
        close();
      }}
      inputValue={search}
      onInputValueChange={(value: string) => {
        setSearch(value);
        setTyped(value);
      }}
      itemToStringLabel={textOf}
      onValueChange={(candidate: SpeakerCandidate | null) => {
        const target = candidate && targetOf(candidate);
        if (target) onAssign(target, scope);
        close();
      }}
    >
      <ComboboxTrigger
        render={
          <button
            type="button"
            data-testid={triggerTestId}
            onKeyDown={(event) => {
              if (open && event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                close();
              }
            }}
            aria-label={t("trigger", { name: identity.displayName })}
            className="mb-1 -mx-1 flex items-center rounded-chip px-1 transition-colors hover:bg-[var(--el-canvas-soft)]"
          >
            <SpeakerChip identity={identity} />
          </button>
        }
      />
      <ComboboxContent
        align="start"
        className="w-64"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close();
          }
        }}
      >
        <ComboboxInput
          aria-label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          showTrigger={false}
          onTypedValueChange={setTyped}
          // 일치하는 사람이 없을 때 Enter 는 「＋ 추가」의 확인이다. 한글 조합 중 Enter 는 글자를 확정할 뿐이라 거른다.
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.nativeEvent.isComposing &&
              canCreateGuest &&
              shown.length === 0
            ) {
              event.preventDefault();
              onCreateGuest?.(trimmedSearch, scope);
              close();
            }
          }}
        />
        {candidatesFailed ? (
          <div
            role="alert"
            className="px-2 py-1.5 text-[13px] text-[var(--el-danger)]"
          >
            {t("loadFailed")}{" "}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => onRetryCandidates?.()}
            >
              {tActions("retry")}
            </button>
          </div>
        ) : null}
        <ComboboxEmpty>
          {candidatesPending ? t("loading") : t("empty")}
        </ComboboxEmpty>
        <ComboboxList>
          {(candidate: SpeakerCandidate) => (
            <ComboboxItem
              key={candidateKey(candidate)}
              value={candidate}
              className="gap-2"
            >
              <PersonAvatar
                name={speakerAvatarName(candidate.assignedLabels ?? [], {
                  hashKey: personAvatarKey(candidate),
                })}
                image={candidate.image}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-1.5">
                  <span className="truncate text-[13px]">{candidate.name}</span>
                  {candidate.assignedLabels?.length ? (
                    <span className="shrink-0 text-[11px] text-[var(--el-muted-soft)]">
                      {t("assignedLabels", {
                        labels: candidate.assignedLabels.join("·"),
                      })}
                    </span>
                  ) : null}
                </span>
                <span className="block truncate text-[11px] text-[var(--el-muted-soft)]">
                  {candidate.email ?? guest}
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
              loading={creating}
              onClick={() => {
                onCreateGuest?.(trimmedSearch, scope);
                close();
              }}
            >
              {t("create", { name: trimmedSearch })}
            </Button>
          </div>
        ) : null}
        {allowSegmentScope ? (
          <fieldset className="border-t border-border p-1">
            <legend className="sr-only">{t("scope.legend")}</legend>
            {SCOPES.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2 rounded-chip px-2 py-1.5 text-[13px] hover:bg-[var(--el-canvas-soft)]"
              >
                <input
                  type="radio"
                  name="speaker-assign-scope"
                  className="accent-[var(--el-ink)]"
                  checked={scope === option}
                  onChange={() => setScope(option)}
                />
                {t(`scope.${option}`)}
              </label>
            ))}
          </fieldset>
        ) : null}

        <div className="border-t border-border p-1">
          {scope === "label" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                onAssign(null, "label");
                close();
              }}
            >
              {t("noName")}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              disabled={!overridden}
              onClick={() => {
                onClearOverride?.();
                close();
              }}
            >
              {t("clearOverride")}
            </Button>
          )}
        </div>
      </ComboboxContent>
    </Combobox>
  );
}
