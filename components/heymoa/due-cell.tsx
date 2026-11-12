"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { enUS, ko } from "react-day-picker/locale";

import { useLocale, useTranslations } from "next-intl";

import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { formatDueDate } from "@/lib/format/date";
import { useDisplayLocale } from "@/lib/i18n/use-display-locale";
import { cn } from "@/lib/utils";

/**
 * 기한 칸. 누르면 달력이 뜨고 날짜를 고르면 바로 정해진다. 기한이 있으면 달력 아래 「기한 없음」으로 지운다.
 * 브라우저의 날짜 고르기는 브라우저 · 운영체제마다 모양이 달라 쓰지 않는다(APP-1591).
 * 검토 화면의 할 일 · 이슈와 할 일 목록이 같은 칸을 쓴다.
 */
export function DueCell({
  value,
  placeholder,
  editable = false,
  overdue = false,
  chip = false,
  quiet = false,
  onChange,
  className,
}: {
  value: string | null;
  placeholder?: string;
  editable?: boolean;
  overdue?: boolean;
  /**
   * 달력 아이콘이 붙은 칩 모양(검토 화면 · APP-865). 기한이 없으면 점선 테두리의 「기한 정하기」라
   * 정해야 할 것이 남았다는 것이 눈에 띈다.
   */
  chip?: boolean;
  /** 표 안의 칸이면 빈 값을 달력 아이콘으로만 두고 글은 줄(`group`)을 가리키거나 포커스가 들 때 세운다. 좁은 화면은 늘 보인다 */
  quiet?: boolean;
  onChange?: (next: string | null) => void;
  className?: string;
}) {
  const t = useTranslations("common.dueCell");
  const locale = useDisplayLocale();
  const calendarLocale = useLocale() === "en" ? enUS : ko;
  const [open, setOpen] = useState(false);
  const selected = value ? dateOf(value) : undefined;
  const empty = placeholder ?? t("placeholder");
  const text = value ? formatDueDate(value, locale) : empty;
  const tone = value
    ? overdue
      ? "text-[var(--el-error-strong)]"
      : "text-[var(--el-ink)]"
    : "text-[var(--el-muted-soft)]";
  const chipClass = value
    ? "bg-[var(--el-canvas-soft)] text-[var(--el-body)]"
    : "border border-dashed border-[#efc2a8] text-[#b4501f]";
  const content = chip ? (
    <>
      <CalendarDays aria-hidden className="size-[13px] shrink-0" />
      {text}
    </>
  ) : quiet && !value ? (
    <span className="inline-flex items-center">
      <CalendarDays
        aria-hidden
        className="size-[14px] shrink-0 text-[var(--el-muted)]"
      />
      {/* 기한 칸은 오른쪽 끝에 붙는다. 투명하게만 두면 보이지 않는 글 폭만큼 아이콘이 왼쪽에 떠서, 폭째 접었다 편다. */}
      <span className="ml-1.5 overflow-hidden whitespace-nowrap text-[var(--el-muted)] transition-[max-width,opacity,margin] duration-150 ease-out motion-reduce:transition-none sm:ml-0 sm:max-w-0 sm:opacity-0 sm:group-hover:ml-1.5 sm:group-hover:max-w-24 sm:group-hover:opacity-100 sm:group-focus-within:ml-1.5 sm:group-focus-within:max-w-24 sm:group-focus-within:opacity-100">
        {text}
      </span>
    </span>
  ) : (
    text
  );

  if (!editable) {
    if (chip) {
      return value ? (
        <span
          className={cn(
            "inline-flex h-[26px] items-center gap-1.5 rounded-[7px] px-[9px] text-[13px] whitespace-nowrap tabular-nums",
            chipClass,
            className
          )}
        >
          {content}
        </span>
      ) : null;
    }
    return (
      <span
        className={cn(
          "inline-flex h-7 items-center whitespace-nowrap text-[13px] tabular-nums",
          tone,
          className
        )}
      >
        {value ? text : ""}
      </span>
    );
  }

  const choose = (next: string | null) => {
    setOpen(false);
    if (next !== value) onChange?.(next);
  };

  return (
    <span className={cn("relative inline-flex", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={value ? t("change", { date: text }) : empty}
              className={cn(
                chip
                  ? cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-[7px] px-[9px] text-[13px] whitespace-nowrap tabular-nums hover:brightness-[0.97] focus-visible:outline-2 focus-visible:outline-[var(--el-ink)] sm:h-[26px]",
                      chipClass
                    )
                  : cn(
                      "-mx-1.5 inline-flex h-9 items-center rounded-control px-1.5 text-[13px] whitespace-nowrap tabular-nums hover:bg-[var(--el-surface-strong)] focus-visible:outline-2 focus-visible:outline-[var(--el-ink)] sm:h-7",
                      tone
                    )
              )}
            />
          }
        >
          {content}
        </PopoverTrigger>
        {/* 메뉴(dropdown-menu)와 같은 면이다 — 흰 바탕 · 패널 모서리 · 같은 그림자. */}
        <PopoverContent
          align="start"
          className="w-auto gap-0 rounded-panel bg-[var(--el-surface-card)] p-0 shadow-e3"
        >
          <Calendar
            mode="single"
            // 고른 날을 다시 눌러도 지워지지 않는다. 지우기는 아래 버튼이 맡는다.
            required
            locale={calendarLocale}
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => choose(isoOf(date))}
            className="bg-transparent p-3 [--cell-radius:var(--radius-control)] [--cell-size:--spacing(8)]"
            classNames={{
              caption_label: "text-[13.5px] font-medium text-[var(--el-ink)]",
              weekday:
                "flex-1 text-[11.5px] font-normal text-[var(--el-muted)] select-none",
              week: "mt-1 flex w-full",
              today:
                "rounded-(--cell-radius) text-[var(--el-ink)] [&>button]:font-semibold [&>button]:ring-1 [&>button]:ring-[var(--el-hairline-strong)] [&>button]:ring-inset",
              outside: "[&>button]:text-[var(--el-muted-soft)]",
            }}
          />
          {value ? (
            <div className="border-t border-[var(--el-hairline)] p-1.5">
              <button
                type="button"
                onClick={() => choose(null)}
                className="h-8 w-full rounded-control px-2 text-left text-[13px] text-[var(--el-body)] hover:bg-[var(--el-canvas-soft)] hover:text-[var(--el-ink)] focus-visible:outline-2 focus-visible:outline-[var(--el-ink)]"
              >
                {t("clear")}
              </button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </span>
  );
}

/** `YYYY-MM-DD` 를 그 날의 로컬 자정으로. `new Date("YYYY-MM-DD")` 는 UTC 자정이라 시간대에 따라 하루 밀린다. */
function dateOf(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isoOf(date: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
