/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";
import type { SpeakerIdentity } from "@/lib/transcription/speaker-identity";

/**
 * 화자 하나를 얼굴과 이름으로 그린다.
 *
 * 파스텔은 **바탕으로만** 쓴다 (`DESIGN.md` — never as text colors). 색은 저장하지 않고
 * 이름을 해싱해서 렌더 시점에 낸다.
 */
export function SpeakerChip({
  identity,
  className,
}: {
  identity: SpeakerIdentity;
  className?: string;
}) {
  return (
    <span
      data-testid="speaker-chip"
      data-unassigned={identity.unassigned || undefined}
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--el-muted)]",
        className
      )}
    >
      {identity.imageUrl ? (
        <img
          src={identity.imageUrl}
          alt=""
          className="size-5 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] text-[var(--el-ink)]"
          style={{ backgroundColor: identity.tint }}
        >
          {identity.initial}
        </span>
      )}
      {identity.displayName}
      {/* 아직 아무도 안 본 화자. 눈에 띄어야 이름을 붙일 이유가 생긴다. */}
      {identity.unassigned ? (
        <span
          aria-label="아직 확인하지 않은 화자"
          className="size-1.5 shrink-0 rounded-full bg-[var(--el-muted-soft)]"
        />
      ) : null}
    </span>
  );
}
