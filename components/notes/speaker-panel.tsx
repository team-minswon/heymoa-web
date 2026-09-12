"use client";

 
import { motion, useReducedMotion } from "motion/react";
import { CornerDownRight, RotateCcw, SkipForward, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatSpeakingTime, type SpeakerStat } from "@/lib/notes/speaker-stats";
import { formatOffset } from "@/lib/transcription/presentation";
import { speakerAvatarName } from "@/lib/transcription/speaker-identity";
import { PersonAvatar } from "@/components/heymoa/person-avatar";
import { cn } from "@/lib/utils";

/**
 * 화자 패널. **누가 얼마나 말했나와 화자 붙이기를 한 면에서 한다.**
 *
 * 둘을 나누면 이름을 붙이려는 사람이 목록과 전사를 오가야 하는데, 붙일 사람을 고르는 단서가
 * 정확히 이 수치다 — 「앞 15분만 말한 사람」과 「내내 고르게 말한 사람」은 비중이 같아도
 * 다른 사람이고, 그 차이는 타임라인에만 나온다.
 *
 * 왼쪽에서 연다. 오른쪽은 노트 표면이 이미 쓰고 있고, 읽던 전사를 덜 가리는 쪽이 왼쪽이다.
 */

/** 한 줄이 들어오는 데 걸리는 시간과 줄 사이 간격. 목록이 위에서 아래로 한 번 훑고 선다. */
const ROW_STAGGER_S = 0.035;

/**
 * 그 줄의 얼굴 열쇠. **규칙은 `speakerAvatarName` 하나뿐이다** — 전사의 칩이 같은 것을
 * 부른다. 목록에서 고른 사람을 본문에서 얼굴로 되찾는 것이 이 아바타의 일이고, 두 곳이
 * 갈리면 그 일을 못 한다.
 */
const avatarNameOf = (stat: SpeakerStat) =>
  speakerAvatarName(stat.ownedLabels, {
    label: stat.unassigned ? stat.labels[0] : null,
    hashKey: stat.key,
  });

function Sparkline({ timeline, dim }: { timeline: number[]; dim: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex h-6 items-end gap-px",
        dim && "opacity-45"
      )}
    >
      {timeline.map((value, bin) => (
        <span
          key={bin}
          className="min-h-px flex-1 rounded-[1px] bg-current"
          style={{
            // 0인 칸도 실선으로 남긴다 — 빈 자리가 회의 축이라는 것을 띠가 스스로 말한다.
            height: `${Math.max(3, value * 100)}%`,
            opacity: value > 0 ? 0.25 + value * 0.75 : 0.12,
          }}
        />
      ))}
    </div>
  );
}

function SpeakerRow({
  stat,
  index,
  onJump,
}: {
  stat: SpeakerStat;
  index: number;
  onJump: (segmentId: string) => void;
}) {
  const reduced = useReducedMotion();
  const silent = stat.speakingMs === 0;

  return (
    <motion.li
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.2,
        // 스무 명짜리 회의에서 끝줄이 0.7초 뒤에 들어오면 목록이 덜컹거린다.
        delay: Math.min(index * ROW_STAGGER_S, 0.25),
      }}
      data-testid="speaker-panel-row"
      data-unassigned={stat.unassigned || undefined}
      className="border-b border-[var(--el-hairline)] px-4 py-3 last:border-b-0"
    >
      <div className="flex items-center gap-2">
        <PersonAvatar
          name={avatarNameOf(stat)}
          image={stat.image}
          size={24}
          className={cn(silent && "opacity-45")}
        />
        <span className="truncate text-[13px] font-medium text-[var(--el-ink)]">
          {stat.name}
        </span>
        <span className="ml-auto shrink-0 tabular-nums text-[11px] text-[var(--el-muted)]">
          {silent ? "말한 기록 없음" : `${Math.round(stat.share * 100)}%`}
        </span>
      </div>

      {silent ? null : (
        <div className="mt-2 pl-8 text-[var(--el-ink)]">
          <Sparkline timeline={stat.timeline} dim={stat.unassigned} />
          <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--el-muted-soft)]">
            {/* **세그먼트 개수를 「발화 N개」로 내보내지 않는다.** 그것은 전사가 문장을
                어디서 끊었느냐는 내부 사정이라, 한 번 말한 것이 세 번으로 보인다. */}
            <span className="tabular-nums">
              {formatSpeakingTime(stat.speakingMs)}
            </span>
            {stat.firstSegmentId ? (
              <Button
                variant="ghost"
                size="xs"
                className="ml-auto -mr-1 text-[var(--el-muted)]"
                onClick={() => onJump(stat.firstSegmentId!)}
              >
                <CornerDownRight data-icon="inline-start" />
                {stat.unassigned ? "지정하러 가기" : "첫 발화로"}
              </Button>
            ) : null}
          </div>
        </div>
      )}
      {/* 띠는 `aria-hidden` 이라 「언제」를 여기서만 말한다. **칸에서 되짚지 않는다** —
          칸은 회의 63분을 48로 나눈 79초짜리라 첫 발화가 그만큼 앞당겨진다. */}
      {stat.firstStartedAtMs === null ? null : (
        <span className="sr-only">
          {`첫 발화 ${formatOffset(stat.firstStartedAtMs)}`}
        </span>
      )}
    </motion.li>
  );
}

export function SpeakerPanel({
  open,
  onOpenChange,
  stats,
  durationMs,
  onJump,
  onReset,
  resetting,
  resettable,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: SpeakerStat[];
  /** 회의 길이. 타임라인 축의 끝 눈금이다. */
  durationMs: number;
  /** 그 발화로 전사를 스크롤한다. 패널은 닫는다 — 안 닫으면 도착한 자리를 자기가 가린다. */
  onJump: (segmentId: string) => void;
  onReset: () => void;
  resetting: boolean;
  /** 되돌릴 지정이 하나라도 있나. 없으면 초기화는 아무 일도 안 하는 버튼이다. */
  resettable: boolean;
}) {
  // **미지정이 위다.** 이 패널을 여는 이유가 대개 그것이고, 말한 양으로만 세우면 조용한
  // 미지정 화자가 맨 아래에 묻힌다.
  const unassigned = stats.filter((stat) => stat.unassigned);
  const assigned = stats.filter((stat) => !stat.unassigned);

  const jump = (segmentId: string) => {
    onOpenChange(false);
    onJump(segmentId);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* 오른쪽 모서리만 둥글다 — 제품 면의 「캔버스 위에 뜬 둥근 패널」과 같은 말이고,
          화면 가장자리에 닿는 왼쪽은 각진 채로 둬야 붙어 있는 것으로 읽힌다. */}
      <SheetContent
        side="left"
        className="w-[min(21rem,88vw)] gap-0 rounded-r-panel sm:max-w-none"
      >
        <SheetHeader className="border-b border-[var(--el-hairline)]">
          {/* **세리프를 안 쓴다.** `SheetTitle` 기본값이 `font-heading`(EB Garamond →
              한글은 Noto Serif KR)인데, 제품 면에서 세리프 300 은 정보 탭의 제목 블록
              같은 자리의 정체성이고 컴포넌트 제목은 Inter 다(`DESIGN.md` Hierarchy). */}
          <SheetTitle className="font-sans text-[13px] font-semibold">
            화자
          </SheetTitle>
          {/* 둘을 더한 수를 쓰지 않는다 — 미지정 화자와 참여자는 겹칠 수 있어서, 더하면
              넷뿐인 회의가 아홉 명이 된다. 같은 말을 상단바 버튼도 쓴다(「미지정 N」). */}
          {/* **회의 길이를 늘 적는다.** 띠의 가로축이 그 길이인데 안 적으면 왼쪽 끝과
              오른쪽 끝이 무엇인지 읽을 방법이 없다. */}
          <SheetDescription>
            {[
              `참여자 ${assigned.length}명`,
              unassigned.length ? `미지정 화자 ${unassigned.length}명` : null,
              `회의 ${formatSpeakingTime(durationMs)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          {stats.length ? (
            <ul>
              {[...unassigned, ...assigned].map((stat, index) => (
                <SpeakerRow
                  key={stat.key}
                  stat={stat}
                  index={index}
                  onJump={jump}
                />
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-sm text-[var(--el-muted)]">
              아직 나뉜 화자가 없습니다.
            </p>
          )}
        </ScrollArea>

        <div className="border-t border-[var(--el-hairline)] p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-[var(--el-muted)]"
            disabled={!resettable}
            loading={resetting}
            onClick={onReset}
          >
            <RotateCcw data-icon="inline-start" />
            지정한 화자 전체 초기화
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * 전사 상단바의 화자 도구. **복사와 나란히 선다.**
 *
 * 예전에는 스크롤 영역 위에 떠 있었는데, 흰 본문 위의 흰 원이라 잘 안 보였고 아래쪽은
 * 「맨 아래로」와 데스크톱 레코더 독이 이미 쓰는 자리였다. 상단바는 전사를 읽는 동안 늘
 * 붙어 있고(`sticky`), 같은 바의 복사와 같은 생김새라 「이 전사에 대해 할 수 있는 일」로
 * 한 묶음이 된다.
 */
export function SpeakerTools({
  onOpen,
  onNextUnassigned,
  unassignedCount,
}: {
  onOpen: () => void;
  /** 다음 미지정 화자의 발화로 넘긴다. 미지정이 없으면 이 버튼이 안 선다. */
  onNextUnassigned: () => void;
  unassignedCount: number;
}) {
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button type="button" variant="ghost" size="sm" onClick={onOpen} />
          }
        >
          <Users data-icon="inline-start" />
          화자
        </TooltipTrigger>
        <TooltipContent side="bottom">
          누가 얼마나 말했는지 보기
        </TooltipContent>
      </Tooltip>

      {/* **미지정이 있을 때만 선다.** 다 붙인 회의에서 「다음 미지정」은 누를 곳이 없는
          버튼이고, 상단바의 자리는 한 칸이라도 아깝다. */}
      {unassignedCount ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onNextUnassigned}
              />
            }
          >
            <SkipForward data-icon="inline-start" />
            미지정 {unassignedCount}
          </TooltipTrigger>
          <TooltipContent side="bottom">
            아직 누구인지 모르는 화자로 넘어갑니다
          </TooltipContent>
        </Tooltip>
      ) : null}
    </>
  );
}
