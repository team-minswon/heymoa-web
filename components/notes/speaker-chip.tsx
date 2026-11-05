import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { SpeakerFallbackNames } from "@/lib/notes/speaker-stats";
import type { SpeakerIdentity } from "@/lib/transcription/speaker-identity";
import { PersonAvatar } from "@/components/heymoa/person-avatar";

/**
 * 화자 하나를 얼굴과 이름으로 그린다.
 *
 * 파스텔은 **바탕으로만** 쓴다 (`DESIGN.md` — never as text colors). 색은 저장하지 않고
 * 라벨 순번으로 렌더 시점에 낸다.
 *
 * **얼굴에 글자를 얹지 않는다.** 이름이 바로 옆에 있어 글자가 가려 주는 것이 없다.
 */
export function SpeakerChip({
  identity,
  className,
}: {
  identity: SpeakerIdentity;
  className?: string;
}) {
  const t = useTranslations("notes.speakers");
  return (
    <span
      data-testid="speaker-chip"
      data-unassigned={identity.unassigned || undefined}
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--el-muted)]",
        className
      )}
    >
      <PersonAvatar name={identity.avatarName} image={identity.imageUrl} />
      {identity.displayName}
      {/* 아직 아무도 안 본 화자. 눈에 띄어야 이름을 붙일 이유가 생긴다. */}
      {identity.unassigned ? (
        <span
          aria-label={t("unconfirmed")}
          className="size-1.5 shrink-0 rounded-full bg-[var(--el-muted-soft)]"
        />
      ) : null}
    </span>
  );
}

/**
 * 이름을 모르는 화자·참여자에게 세우는 말을 화면 언어로 만든다. 전사·타임라인·화자 집계가
 * 같은 말을 쓰도록 `createSpeakerIdentityResolver`·`summarizeSpeakers` 에 넘긴다.
 */
export function useSpeakerFallbackNames(): SpeakerFallbackNames {
  const t = useTranslations("notes.speakers");
  return useMemo(
    () => ({
      unnamedParticipant: t("unnamedParticipant"),
      speaker: (label: string) => t("fallback", { label }),
    }),
    [t]
  );
}
