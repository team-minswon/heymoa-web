"use client";

import { useTranslations } from "next-intl";

import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PersonAvatar,
  personAvatarKey,
} from "@/components/heymoa/person-avatar";
import { cn } from "@/lib/utils";

export type Participant = {
  participantId: string;
  userId: string | null;
  guestId: string | null;
  name: string;
  email: string | null;
  image?: string | null;
};

export type ParticipantFace = Pick<Participant, "name" | "email" | "image"> &
  Partial<Pick<Participant, "participantId" | "userId" | "guestId">>;

const AVATAR_PX = { sm: 24, default: 32, lg: 40 } as const;

export function ParticipantAvatar({
  participant,
  className,
  size = "sm",
  isStarter = false,
  interactive = true,
}: {
  participant: ParticipantFace;
  className?: string;
  size?: "sm" | "default" | "lg";
  isStarter?: boolean;
  /** combobox 항목처럼 자기 롤(listbox option)을 가진 자리에서는 끈다 — 툴팁 트리거가 겹치면 키보드 이동과 선택이 서로 방해한다. */
  interactive?: boolean;
}) {
  const t = useTranslations("notes.participants");
  const avatar = (
    <PersonAvatar
      name={personAvatarKey(participant)}
      image={participant.image}
      size={AVATAR_PX[size]}
      className={className}
    />
  );

  if (!interactive) return avatar;

  const who = `${participant.name} (${participant.email ?? t("external")})`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            aria-label={isStarter ? t("hostLabel", { who }) : who}
            className="shrink-0"
          >
            {avatar}
          </span>
        }
      />
      <TooltipContent className="flex-col items-start gap-0.5">
        <span className="font-medium">
          {participant.name}
          {isStarter ? ` · ${t("host")}` : ""}
        </span>
        <span className="opacity-70">
          {participant.email ?? t("external")}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

export function NoteParticipantAvatars({
  participants = [],
  max = 5,
  size = "sm",
  className,
}: {
  participants?: Participant[];
  max?: number;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const t = useTranslations("notes.participants");
  if (participants.length === 0) return null;

  const visible = participants.length > max ? max - 1 : max;
  const shown = participants.slice(0, visible);
  const hidden = participants.slice(visible);

  return (
    <AvatarGroup
      className={cn("items-center", className)}
      aria-label={t("count", { count: participants.length })}
    >
      {shown.map((participant) => (
        <ParticipantAvatar
          key={participant.participantId}
          participant={participant}
          size={size}
        />
      ))}
      {hidden.length > 0 ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <AvatarGroupCount
                aria-label={t("more", { count: hidden.length })}
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
          <TooltipContent className="flex-col items-start gap-0.5">
            {hidden.map((participant) => (
              <span key={participant.participantId}>{participant.name}</span>
            ))}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </AvatarGroup>
  );
}
