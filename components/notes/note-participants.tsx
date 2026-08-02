"use client";

import { Mic } from "lucide-react";

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type Participant = {
  userId: string;
  name: string;
  email: string;
  image?: string | null;
};

/** 이름이 비었을 때도 아바타가 빈 원으로 남지 않게 이메일 앞글자까지 떨어진다. */
function initial(participant: Participant) {
  return (participant.name.trim() || participant.email).slice(0, 1);
}

export function ParticipantAvatar({
  participant,
  className,
  size = "sm",
  isStarter = false,
  interactive = true,
}: {
  participant: Participant;
  className?: string;
  size?: "sm" | "default" | "lg";
  /** 회의를 시작한 사람. 아바타에 마이크 배지가 붙는다. */
  isStarter?: boolean;
  /**
   * 툴팁을 붙일지. combobox 항목처럼 이미 자기 롤(listbox option)을 가진 자리에서는
   * 끈다 — 툴팁 트리거가 그 위에 겹치면 키보드 이동과 선택이 서로 방해한다.
   */
  interactive?: boolean;
}) {
  const avatar = (
    <Avatar size={size} className={className}>
      {participant.image ? (
        <AvatarImage src={participant.image} alt="" />
      ) : null}
      <AvatarFallback className="bg-[var(--el-surface-strong)] text-[10px] text-[var(--el-ink)]">
        {initial(participant)}
      </AvatarFallback>
      {isStarter ? (
        <AvatarBadge aria-hidden>
          <Mic />
        </AvatarBadge>
      ) : null}
    </Avatar>
  );

  if (!interactive) return avatar;

  const who = participant.email
    ? `${participant.name} (${participant.email})`
    : participant.name;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          // 툴팁은 포인터·포커스에만 열린다. 스크린리더는 이 라벨을 읽는다.
          <span
            aria-label={isStarter ? `진행자 ${who}` : who}
            className="shrink-0"
          >
            {avatar}
          </span>
        }
      />
      <TooltipContent className="flex-col items-start gap-0.5">
        <span className="font-medium">
          {participant.name}
          {isStarter ? " · 진행자" : ""}
        </span>
        {participant.email ? (
          <span className="opacity-70">{participant.email}</span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * 참여자를 겹친 아바타로 보여준다. `max`를 넘으면 나머지는 `+N` 칩 하나로 접는다.
 *
 * **진행자는 따로 세우지 않고 이 뭉치 안에서 배지로 구분한다.** 예전에는 목록 행에 참여자
 * 뭉치와 진행자 아바타가 나란히 떠서, 라벨이 없으니 **어느 쪽이 무엇인지 알 수 없었고**
 * 진행자가 참여자이기도 하면 같은 얼굴이 두 번 나왔다. 배지 하나면 한 뭉치로 끝난다.
 *
 * 진행자가 참여자 목록에 없으면 맨 앞에 세운다 — 녹음을 켰다는 것은 그 자리에 있었다는 뜻이다.
 *
 * `max`가 목록(3)과 상세(5)에서 다른 이유는 목록 행이 52px 한 줄이라 아바타가 넓어질수록
 * 제목이 먼저 잘리기 때문이다.
 */
export function NoteParticipantAvatars({
  participants = [],
  starter = null,
  max = 5,
  size = "sm",
  className,
}: {
  /**
   * 계약상 필수지만 기본값을 둔다. 배포 직후 남아 있던 옛 응답이나 캐시가 이 필드 없이
   * 들어오면, 아바타 하나 때문에 **노트 목록 전체가 빈 화면**이 되기 때문이다.
   */
  participants?: Participant[];
  /** 회의를 시작한 사람. 이 뭉치 안에서 마이크 배지로 구분된다. */
  starter?: { userId: string; name: string } | null;
  max?: number;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  // **진행자는 언제나 맨 앞이다.** 참여자로 이미 있더라도 이름순으로는 `max` 밖으로 밀릴 수
  // 있고, 그러면 배지가 접힘(+N) 안으로 들어가 사라진다. 좁은 화면에서는 둘째 줄의 진행자
  // 이름도 접히므로, 그 경우 진행자를 알아볼 방법이 아예 없어진다.
  const ordered: Participant[] = starter
    ? [
        participants.find(
          (participant) => participant.userId === starter.userId
        ) ?? {
          // 참여자에 없는 진행자는 이메일을 모른다 — 툴팁이 빈 괄호를 그리지 않게 이름만 쓴다.
          userId: starter.userId,
          name: starter.name,
          email: "",
        },
        ...participants.filter(
          (participant) => participant.userId !== starter.userId
        ),
      ]
    : participants;

  if (ordered.length === 0) return null;

  const shown = ordered.slice(0, max);
  const hidden = ordered.slice(max);

  return (
    <AvatarGroup
      className={cn("items-center", className)}
      aria-label={`참여자 ${ordered.length}명`}
    >
      {shown.map((participant) => (
        <ParticipantAvatar
          key={participant.userId}
          participant={participant}
          size={size}
          isStarter={participant.userId === starter?.userId}
        />
      ))}
      {hidden.length > 0 ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <AvatarGroupCount
                aria-label={`외 ${hidden.length}명`}
                className={cn(
                  "text-[10px]",
                  size === "sm" && "size-6",
                  size === "default" && "size-8"
                )}
              >
                +{hidden.length}
              </AvatarGroupCount>
            }
          />
          {/* 접힌 사람은 hover로만 알 수 있다 — 이름을 다 적는다. */}
          <TooltipContent className="flex-col items-start gap-0.5">
            {hidden.map((participant) => (
              <span key={participant.userId}>{participant.name}</span>
            ))}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </AvatarGroup>
  );
}
