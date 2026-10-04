import { CalendarDays, Clock, Folder } from "lucide-react";
import type { ReactNode } from "react";

import { PersonAvatar, personAvatarKey } from "@/components/heymoa/person-avatar";
import { formatAppDate } from "@/lib/format/date";
import type { NoteMeta } from "@/lib/notes/copy-markdown";
import { lengthLabel } from "@/lib/notes/review/moments";
import type { SpeakerFace } from "@/lib/transcription/speaker-identity";
import { cn } from "@/lib/utils";

const FACES = 4;

function Chip({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex h-[26px] min-w-0 items-center gap-1.5 rounded-control border border-[var(--el-hairline)] px-[9px] text-[12.5px] text-[var(--el-body)] [&>svg]:size-[13px] [&>svg]:shrink-0 [&>svg]:text-[var(--el-muted)]">
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

/**
 * 검토 화면의 머리 — 회의록 문서의 첫 줄이다(APP-865). 상태 배지 · 회의 제목 · 날짜 · 길이 · 참석자 ·
 * 프로젝트. [aside] 는 배지 줄 오른쪽 끝에 선다(요약 / 그래프 전환). 값이 아직 없으면 그 칩을 비운다 —
 * 그럴듯한 기본값을 채우지 않는다.
 */
export function ReviewHead({
  meta,
  participants,
  lengthMs,
  confirmed,
  aside,
}: {
  meta: NoteMeta | null | undefined;
  participants: readonly SpeakerFace[];
  /** 회의 길이. 전사가 아직 안 왔으면 null */
  lengthMs: number | null;
  confirmed: boolean;
  aside?: ReactNode;
}) {
  const names = participants.map((face) => face.name).filter((name): name is string => Boolean(name));

  return (
    <header className="pb-1">
      <div className="flex min-h-8 items-center gap-3">
        <span
          className={cn(
            "inline-flex h-5 items-center rounded-chip px-[7px] text-[11px] font-semibold transition-colors duration-200 ease-out",
            confirmed
              ? "bg-[var(--el-success)]/10 text-[var(--el-success-strong)]"
              : "bg-[var(--el-surface-strong)] text-[var(--el-body)]"
          )}
        >
          {confirmed ? "확정됨" : "검토 중"}
        </span>
        {aside ? <span className="ml-auto">{aside}</span> : null}
      </div>
      {meta ? (
        <h1 className="mt-2.5 font-serif text-[28px] leading-[38px] font-medium tracking-[-0.4px] break-keep text-[var(--el-ink)]">
          {meta.title}
        </h1>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {meta ? (
          <Chip icon={<CalendarDays aria-hidden />}>
            {formatAppDate(meta.whenIso, {
              month: "long",
              day: "numeric",
              weekday: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
          </Chip>
        ) : null}
        {lengthMs !== null && lengthMs > 0 ? (
          <Chip icon={<Clock aria-hidden />}>{lengthLabel(lengthMs)}</Chip>
        ) : null}
        {names.length > 0 ? (
          <span className="inline-flex h-[26px] min-w-0 items-center gap-1.5 rounded-control border border-[var(--el-hairline)] pr-[9px] pl-1 text-[12.5px] text-[var(--el-body)]">
            <span aria-hidden className="flex">
              {participants.slice(0, FACES).map((face, index) => (
                <PersonAvatar
                  key={face.participantId}
                  name={personAvatarKey(face)}
                  image={face.image}
                  size={18}
                  className={cn("ring-[1.5px] ring-white", index > 0 && "-ml-[5px]")}
                />
              ))}
            </span>
            <span className="truncate">
              {names.length > 1 ? `${names[0]} 외 ${names.length - 1}명` : names[0]}
            </span>
          </span>
        ) : null}
        {meta?.projectName ? (
          <Chip icon={<Folder aria-hidden />}>{meta.projectName}</Chip>
        ) : null}
      </div>
    </header>
  );
}
