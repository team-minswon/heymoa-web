"use client";

import { useState } from "react";

import { SpeakerChip } from "@/components/notes/speaker-chip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  speakerTint,
  type SpeakerIdentity,
} from "@/lib/transcription/speaker-identity";

export type SpeakerCandidate = {
  userId: string;
  name: string;
  email: string;
  /** 프로필 사진. 서버가 `participants[]`로 이미 내려준다. */
  image?: string | null;
  /**
   * 이 사람이 **이미 붙어 있는** 화자 라벨. 없으면 아직 아무 화자도 아니다.
   *
   * 한 사람이 두 화자일 수 없어서, 여기 값이 있는 사람을 고르면 저쪽에서 떨어진다.
   * 그 사실을 **고르기 전에** 알려야 실수를 안 한다.
   */
  assignedLabel?: string | null;
};

/**
 * 읽다가 「이 사람 아닌데」를 알아본 **그 자리**가 고치는 자리다.
 *
 * 초안은 전사 위에 확인 카드를 얹었는데 프로토타입에서 뒤집혔다 — 화자 셋이면 카드가
 * 445px로 첫 화면을 통째로 먹고 전사 첫 줄이 접힌 아래로 밀렸다. 전사를 읽으러 온
 * 사람이 회의록을 못 본 채 카드만 보게 된다.
 *
 * **후보는 이 회의의 참석자뿐이다.** 새 참여자를 여기서 만들지 않는다 — 회의에 없던
 * 사람은 대표 발화를 봐도 짐작할 근거가 없고, 그런 사람이 이름을 달면 회의록이 조용히
 * 틀린다. 대가는 외부 참석자가 온 회의에서 담당자가 빈다는 것이고, 지금은 감수한다.
 */
/** 칩과 같은 모양이어야 한다 — 고를 때와 확인할 때 같은 사람이 다르게 보이면 안 된다. */
function CandidateAvatar({ candidate }: { candidate: SpeakerCandidate }) {
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
      // **칩과 같은 해싱을 쓴다.** 여기만 중립색이면 고를 때 회색이던 사람이 붙는
      // 순간 파스텔로 바뀌어, 내가 고른 사람이 맞는지 한 번 더 확인하게 된다.
      className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] text-[var(--el-ink)]"
      style={{ backgroundColor: speakerTint(candidate.name) }}
    >
      {[...candidate.name][0] ?? "?"}
    </span>
  );
}

export function SpeakerAssignMenu({
  identity,
  candidates,
  disabled,
  onAssign,
}: {
  identity: SpeakerIdentity;
  candidates: SpeakerCandidate[];
  disabled?: boolean;
  onAssign: (userId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  // 참석자가 아니면 읽기 전용이다. 숨기지는 않는다 — 왜 담당자가 비었는지는 알아야 한다.
  if (disabled) return <SpeakerChip identity={identity} className="mb-1" />;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        data-testid="speaker-assign-trigger"
        aria-label={`${identity.displayName} 화자 지정`}
        className="mb-1 -mx-1 flex items-center rounded-chip px-1 transition-colors hover:bg-[var(--el-canvas-soft)]"
      >
        <SpeakerChip identity={identity} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        {candidates.map((candidate) => (
          <DropdownMenuItem
            key={candidate.userId}
            onClick={() => onAssign(candidate.userId)}
            className="gap-2"
          >
            <CandidateAvatar candidate={candidate} />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-1.5">
                <span className="truncate text-[13px]">{candidate.name}</span>
                {/* 고르면 저쪽에서 떨어진다. 누르기 전에 보여야 한다 */}
                {candidate.assignedLabel ? (
                  <span className="shrink-0 text-[11px] text-[var(--el-muted-soft)]">
                    화자 {candidate.assignedLabel}
                  </span>
                ) : null}
              </span>
              {/* 동명이인이 갈리는 유일한 단서다 */}
              <span className="block truncate text-[11px] text-[var(--el-muted-soft)]">
                {candidate.email}
              </span>
            </span>
          </DropdownMenuItem>
        ))}
        {candidates.length ? <DropdownMenuSeparator /> : null}
        {/* `null` 은 「모르겠다」가 아니라 「없다」다. 미결정은 이 메뉴를 아직 안 누른
            상태로 표현되므로, 되돌릴 값을 따로 두면 둘이 같은 값이 되어 남은 화자를
            셀 수 없게 된다. */}
        <DropdownMenuItem onClick={() => onAssign(null)}>
          참석자 아님
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
