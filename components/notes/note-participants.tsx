"use client";

import {
  Avatar,
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
}: {
  participant: Participant;
  className?: string;
  size?: "sm" | "default" | "lg";
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          // 툴팁은 포인터·포커스에만 열린다. 스크린리더는 이 라벨을 읽는다.
          <span
            aria-label={`${participant.name} (${participant.email})`}
            className="shrink-0"
          >
            <Avatar size={size} className={className}>
              {participant.image ? (
                <AvatarImage src={participant.image} alt="" />
              ) : null}
              <AvatarFallback className="bg-[var(--el-surface-strong)] text-[10px] text-[var(--el-ink)]">
                {initial(participant)}
              </AvatarFallback>
            </Avatar>
          </span>
        }
      />
      <TooltipContent className="flex-col items-start gap-0.5">
        <span className="font-medium">{participant.name}</span>
        <span className="opacity-70">{participant.email}</span>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * 참여자를 겹친 아바타로 보여준다. `max`를 넘으면 나머지는 `+N` 칩 하나로 접는다.
 *
 * `max`가 목록(3)과 상세(5)에서 다른 이유는 목록 행이 52px 한 줄이라 아바타가 넓어질수록
 * 제목이 먼저 잘리기 때문이다.
 */
export function NoteParticipantAvatars({
  participants = [],
  max = 5,
  size = "sm",
  className,
}: {
  /**
   * 계약상 필수지만 기본값을 둔다. 배포 직후 남아 있던 옛 응답이나 캐시가 이 필드 없이
   * 들어오면, 아바타 하나 때문에 **노트 목록 전체가 빈 화면**이 되기 때문이다.
   */
  participants?: Participant[];
  max?: number;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  if (participants.length === 0) return null;

  const shown = participants.slice(0, max);
  const hidden = participants.slice(max);

  return (
    <AvatarGroup
      className={cn("items-center", className)}
      aria-label={`참여자 ${participants.length}명`}
    >
      {shown.map((participant) => (
        <ParticipantAvatar
          key={participant.userId}
          participant={participant}
          size={size}
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
