"use client";

import { useState } from "react";

import { EXTERNAL_LABEL } from "@/components/notes/note-participants";
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
  speakerTintOfLabel,
  type SpeakerIdentity,
} from "@/lib/transcription/speaker-identity";

export type SpeakerCandidate = {
  /**
   * 이 회의의 참여 기록. 화자 지정이 가리키는 값이다.
   *
   * **아직 참여자가 아닌 워크스페이스 멤버는 `null` 이다** — 가리킬 기록이 아직 없다.
   * 고르는 순간 서버가 참여자로 넣으면서 만든다.
   */
  participantId: string | null;
  /** 계정 없는 임시 참여자면 `null`. 아바타·이메일 자리를 가르는 값이다. */
  userId: string | null;
  /**
   * 워크스페이스의 임시 참여자. **아직 이 회의에 없는 사람**을 가리킬 때 쓴다 —
   * 그 사람에게는 [participantId]도 [userId]도 없다.
   */
  guestId?: string | null;
  /**
   * **검색해야 보이는 후보.** 기본 목록에는 안 쌓고 이름을 쳤을 때만 나타난다.
   *
   * 이 회의와 무관한 워크스페이스 임시 참여자가 그렇다. 늘 보이면 드롭다운이 회의와 상관없는
   * 이름으로 불어나고, 아예 안 보이면 **사람이 같은 이름을 하나 더 만든다.**
   */
  searchOnly?: boolean;
  name: string;
  /** 계정 없는 참여자는 이메일이 없다. 그 자리에는 「외부」가 선다. */
  email: string | null;
  /** 프로필 사진. 서버가 `participants[]`로 이미 내려준다. */
  image?: string | null;
  /**
   * 이 사람이 **이미 붙어 있는** 화자 라벨들. 비었으면 아직 아무 화자도 아니다.
   *
   * 예전에는 하나였다 — 한 사람이 두 화자일 수 없어서, 여기 값이 있는 사람을 고르면
   * 저쪽에서 **떨어진다는 경고**였다. V31 이 그 유니크를 떼면서 뜻이 바뀌었다: 이제는
   * 「이 사람은 저기에도 붙어 있다」는 **정보**다. 골라도 저쪽은 그대로 남는다.
   *
   * 그래도 보여주는 이유는 같다 — pyannote 가 쪼갠 것을 합치는 중인지, 엉뚱한 사람을
   * 두 번 붙이는 중인지는 **누르기 전에** 알아야 한다.
   */
  assignedLabels?: string[];
};

/**
 * 화자로 가리킬 대상. **둘 중 하나이고 뜻이 다르다.**
 *
 * - `participantId` — 이 회의의 참여 기록. 임시 참여자와 워크스페이스를 떠난 사람은
 *   계정으로 가리킬 수 없어 이것만 쓴다
 * - `userId` — 계정. **아직 참여자가 아니면 서버가 참여자로 넣는다**
 * - `guestId` — 워크스페이스의 임시 참여자. 위와 같다
 */
export type SpeakerTarget =
  | { participantId: string }
  | { userId: string }
  | { guestId: string };

/**
 * 후보를 가리키는 열쇠로 바꾼다. 참여 기록이 있으면 그것이 우선이다 — 이미 이 회의에 있는
 * 사람을 계정으로 가리키면 서버가 한 번 더 조회할 뿐 결과가 같고, 임시 참여자는 계정이 없다.
 *
 * 둘 다 없는 후보는 만들 수 없지만(타입이 못 막는다) 그때는 `null` 을 돌려 아무것도 안 한다.
 */
export function targetOf(candidate: SpeakerCandidate): SpeakerTarget | null {
  if (candidate.participantId) return { participantId: candidate.participantId };
  if (candidate.userId) return { userId: candidate.userId };
  if (candidate.guestId) return { guestId: candidate.guestId };
  return null;
}

/** 콤보박스가 거르는 문자열과 **같은 값**이어야 한다. 두 곳이 갈리면 조합 전후로 목록이 튄다. */
const searchTextOf = (candidate: SpeakerCandidate) =>
  `${candidate.name} ${candidate.email ?? EXTERNAL_LABEL}`;

/** 참여 기록이 없는 후보도 있어 목록 키를 따로 만든다. */
export const candidateKey = (candidate: SpeakerCandidate) =>
  candidate.participantId ?? candidate.userId ?? candidate.guestId ?? candidate.name;

/** 지정 범위. 기본은 라벨 전체다 — 대개 그 화자의 말 전부가 같은 사람이다. */
export type AssignScope = "label" | "segment";

const SCOPES: ReadonlyArray<{ value: AssignScope; label: string }> = [
  { value: "label", label: "이 화자의 모든 발화에 적용" },
  { value: "segment", label: "현재 발화에만 적용" },
];

/** 칩과 같은 모양이어야 한다 — 고를 때와 확인할 때 같은 사람이 다르게 보이면 안 된다. */
function CandidateAvatar({
  candidate,
  tint,
}: {
  candidate: SpeakerCandidate;
  tint: string;
}) {
  if (candidate.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={candidate.image}
        alt=""
        className="size-5 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      // **붙고 나서 가질 색을 미리 보여준다.** 여기만 중립색이거나 다른 규칙이면, 고를
      // 때와 붙은 뒤가 달라져 내가 고른 사람이 맞는지 한 번 더 확인하게 된다.
      className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] text-[var(--el-ink)]"
      style={{ backgroundColor: tint }}
    >
      {[...candidate.name][0] ?? "?"}
    </span>
  );
}

/**
 * 읽다가 「이 사람 아닌데」를 알아본 **그 자리**가 고치는 자리다.
 *
 * 초안은 전사 위에 확인 카드를 얹었는데 프로토타입에서 뒤집혔다 — 화자 셋이면 카드가
 * 445px로 첫 화면을 통째로 먹고 전사 첫 줄이 접힌 아래로 밀렸다. 전사를 읽으러 온
 * 사람이 회의록을 못 본 채 카드만 보게 된다.
 *
 * **이제 그 자리에서 만들 수도 있다** (APP-494). 후보가 계정 있는 사람뿐이면 외부 참석자가
 * 온 회의에서는 고를 것이 없어, 「알아보는 자리와 고치는 자리가 같다」는 판단이 아예
 * 성립하지 않았다.
 *
 * **`DropdownMenu`가 아니라 `Combobox`다.** 검색창과 「＋ 추가」가 붙으면 메뉴의 타이핑
 * 탐색과 입력이 키를 서로 뺏는다. 참석자 필드가 이미 같은 조합이다.
 */
export function SpeakerAssignMenu({
  identity,
  candidates,
  disabled,
  creating = false,
  candidatesFailed = false,
  candidatesPending = false,
  onRetryCandidates,
  onOpen,
  overridden = false,
  onAssign,
  onCreateGuest,
  onClearOverride,
}: {
  identity: SpeakerIdentity;
  candidates: SpeakerCandidate[];
  disabled?: boolean;
  creating?: boolean;
  /**
   * **후보를 못 불러왔다.** 그냥 빈 목록으로 두면 「일치하는 참석자가 없습니다」로 보여서,
   * 사람은 **그 사람이 없다고 믿는다** — 실패를 정상 상태로 위장하는 것이다.
   */
  candidatesFailed?: boolean;
  /** 후보를 아직 읽는 중인가. **로딩을 「없음」으로 말하면 사람이 없다고 믿는다.** */
  candidatesPending?: boolean;
  onRetryCandidates?: () => void;
  /**
   * **열 때마다 후보를 다시 읽는다.** 마운트 때만 읽으면, 전사를 켜 둔 채 남이 임시 참여자를
   * 만든 뒤 이 메뉴를 열었을 때 그가 후보에 없다 — 같은 이름을 치면 「＋ 추가」가 열려
   * **하나 더 만들어진다.**
   */
  onOpen?: () => void;
  /**
   * 이 발화에 **개별 지정이 걸려 있나.** 걸려 있을 때만 「개별 지정 해제」를 누를 수 있다 —
   * 없는 것을 해제하는 버튼이 서 있으면 무엇이 되돌려지는지가 거짓말이 된다.
   */
  overridden?: boolean;
  /**
   * 가리킨 대상. `null`은 「이름 안 붙임」으로 사람이 확정한 것이다.
   *
   * [scope]가 `"segment"`면 **이 발화 하나에만** 붙인다.
   */
  onAssign: (target: SpeakerTarget | null, scope: AssignScope) => void;
  /** 그 자리에서 임시 참여자를 만들어 붙인다. */
  onCreateGuest?: (displayName: string, scope: AssignScope) => void;
  /** 이 발화의 개별 지정을 뗀다 — 다시 화자 라벨의 지정을 따른다. */
  onClearOverride?: () => void;
}) {
  const [open, setOpen] = useState(false);
  /** base-ui 가 후보를 거를 때 쓰는 값. 조합 중에는 안 올라온다 — 그게 맞는 동작이다. */
  const [search, setSearch] = useState("");
  /**
   * 사람이 **친 그대로**의 값. 조합 중인 마지막 글자까지 들어 있다.
   *
   * 이름을 짓는 자리(「＋ 추가」)는 이쪽을 봐야 한다. [search]로 지으면 「이민형」이
   * 「이민」으로 만들어진다.
   */
  const [typed, setTyped] = useState("");
  // 기본은 라벨 전체다. 대개 그 화자의 말 전부가 같은 사람이고, 한 줄만 고치는 것은
  // 예외라 사람이 명시적으로 골라야 한다.
  const [scope, setScope] = useState<AssignScope>("label");

  /**
   * **닫는 길이 하나여야 한다.**
   *
   * 아래 버튼들이 `setOpen(false)` 만 부르면 controlled prop 만 바뀌어 `onOpenChange` 의
   * 초기화가 안 돈다. 그러면 「현재 발화에만 적용」을 골라 둔 채로 남아, **다음에 다른 화자를
   * 누른 사람이 「모든 발화」인 줄 알고 한 줄만 바꾼다** — 라디오는 메뉴 아래라 안 보인다.
   */
  const close = () => {
    setOpen(false);
    setSearch("");
    setTyped("");
    setScope("label");
  };

  // **`disabled` 는 권한이 아니다.** 참석 여부로 막던 규칙은 걷혔다 — 노트에 닿는 멤버면
  // 누구나 고친다. 지금 이것을 켜는 곳은 임시 참여자를 **만드는 동안**뿐이다(두 왕복이라
  // 그 사이 다른 메뉴가 저장하면 늦게 도착한 쪽이 되돌린다). 참여 여부를 여기 다시
  // 연결하면 이번에 뗀 제한이 되살아난다.
  if (disabled) return <SpeakerChip identity={identity} className="mb-1" />;

  const trimmedSearch = typed.trim();
  // **검색 전에는 이 회의 밖 사람을 안 보여준다.** 아래 `canCreateGuest` 는 그래도 후보
  // 전체를 본다 — 안 보인다고 같은 이름을 또 만들게 두면 이 필터가 버그가 된다.
  /**
   * **조합 중인 글자로도 거른다.**
   *
   * 콤보박스는 조합이 끝나기 전까지 controlled 값(`search`)을 안 올린다 — 옵션이 조기에
   * 걸러져 「결과 없음」이 잘못 뜨는 것을 막으려는 것이고, 거기까지는 맞는 판단이다.
   * 그런데 **한글은 한 글자가 곧 조합**이라, 「박」을 친 순간 목록이 하나도 안 좁혀졌다.
   * 후보가 워크스페이스 전원으로 넓어지면서 남 이름이 그대로 서 있는 것이 눈에 띄게 됐다.
   *
   * **입력값에는 손대지 않는다.** `inputValue` 에 조합 중인 값을 되쓰면 조합이 깨진다 —
   * 그래서 목록만 여기서 한 번 더 거른다. 조합이 끝나면 콤보박스도 같은 기준으로 거르므로
   * 결과가 같다.
   */
  const shown = filterByTyped(
    trimmedSearch ? candidates : candidates.filter((c) => !c.searchOnly),
    trimmedSearch,
    searchTextOf
  );
  // 정확히 같은 이름이 없을 때만 만들기를 보여준다. 부분 일치로 열어 두면 「박」을 치는
  // 동안 계속 떠서, 이미 있는 사람을 옆에 두고 같은 이름을 하나 더 만들기 쉬워진다.
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
          onOpen?.();
          return;
        }
        close();
      }}
      inputValue={search}
      onInputValueChange={(value: string) => {
        setSearch(value);
        // 지우기 버튼처럼 입력 이벤트 없이 값이 바뀌는 길도 있다
        setTyped(value);
      }}
      itemToStringLabel={searchTextOf}
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
            data-testid="speaker-assign-trigger"
            aria-label={`${identity.displayName} 화자 지정`}
            className="mb-1 -mx-1 flex items-center rounded-chip px-1 transition-colors hover:bg-[var(--el-canvas-soft)]"
          >
            <SpeakerChip identity={identity} />
          </button>
        }
      />
      <ComboboxContent align="start" className="w-64">
        <ComboboxInput
          aria-label="이름으로 참석자 검색"
          placeholder="이름으로 검색"
          showTrigger={false}
          onTypedValueChange={setTyped}
        />
        {candidatesFailed ? (
          <div role="alert" className="px-2 py-1.5 text-[13px] text-[var(--el-danger)]">
            후보를 불러오지 못했습니다.{" "}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => onRetryCandidates?.()}
            >
              다시 시도
            </button>
          </div>
        ) : null}
        <ComboboxEmpty>
          {candidatesPending ? "후보를 불러오는 중입니다…" : "일치하는 참석자가 없습니다."}
        </ComboboxEmpty>
        <ComboboxList>
          {(candidate: SpeakerCandidate) => (
            <ComboboxItem
              key={candidateKey(candidate)}
              value={candidate}
              className="gap-2"
            >
              <span aria-hidden="true" className="contents">
                <CandidateAvatar
                  candidate={candidate}
                  // 이미 다른 화자에 붙어 있으면 **거기 색**이다 — 화면에서 그 색으로 보고
                  // 있는 사람이라 알아보는 단서가 된다. 아직 아무 데도 아니면 여기 붙었을 때
                  // 가질 색을 미리 보여준다
                  tint={
                    candidate.assignedLabels?.length
                      ? speakerTintOfLabel(candidate.assignedLabels[0])
                      : identity.tint
                  }
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-1.5">
                  <span className="truncate text-[13px]">{candidate.name}</span>
                  {/* 「저기에도 붙어 있다」는 정보다. 골라도 저쪽은 안 떨어진다 */}
                  {candidate.assignedLabels?.length ? (
                    <span className="shrink-0 text-[11px] text-[var(--el-muted-soft)]">
                      화자 {candidate.assignedLabels.join("·")}
                    </span>
                  ) : null}
                </span>
                {/* 동명이인이 갈리는 유일한 단서다. 계정 없는 사람에게는 그 단서가 없다 */}
                <span className="block truncate text-[11px] text-[var(--el-muted-soft)]">
                  {candidate.email ?? EXTERNAL_LABEL}
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
              ＋ &quot;{trimmedSearch}&quot; 추가
            </Button>
          </div>
        ) : null}
        {/* **범위를 고르는 자리.** pyannote 가 한 사람을 둘로 쪼갠 회의에서는 두 화자를
            각각 같은 사람으로 두면 되지만(그것도 「모든 발화」다), 라벨은 맞는데 한 줄만
            남의 말로 붙은 경우가 따로 있다. 그 둘은 고치는 범위가 다르다. */}
        <fieldset className="border-t border-border p-1">
          <legend className="sr-only">화자 지정 범위</legend>
          {SCOPES.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 rounded-chip px-2 py-1.5 text-[13px] hover:bg-[var(--el-canvas-soft)]"
            >
              <input
                type="radio"
                name="speaker-assign-scope"
                className="accent-[var(--el-ink)]"
                checked={scope === option.value}
                onChange={() => setScope(option.value)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        {/* **아래 버튼이 범위를 따라 바뀐다.**

            「모든 발화」일 때는 「이름 안 붙임」이다. 문구만 바뀌고 저장하는 값은 `null`인데,
            「참석자 아님」은 계정 없는 사람이 참석자가 될 수 있게 된 뒤로 거짓이 됐다 — 뜻은
            「이 목소리에 붙일 이름을 못 찾았다」이고, 미결정(메뉴를 아직 안 누른 상태)과 다르다.

            「현재 발화」일 때는 「개별 지정 해제」다. 발화 단위에는 「참석자 아님」이 없어서
            그 자리가 비는데, 대신 **개별 지정을 되돌릴 길**이 필요하다 — 그 둘을 같은 칸에
            둔다. 저장 쪽도 이 구분을 그대로 지킨다: 라벨의 `null` 은 「참석자 중에 없다」로
            행을 남기고, 발화의 해제는 행을 지운다. */}
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
              이름 안 붙임
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              // 없는 것을 해제하는 버튼이 서 있으면 무엇이 되돌려지는지가 거짓말이 된다
              disabled={!overridden}
              onClick={() => {
                onClearOverride?.();
                close();
              }}
            >
              개별 지정 해제
            </Button>
          )}
        </div>
      </ComboboxContent>
    </Combobox>
  );
}
