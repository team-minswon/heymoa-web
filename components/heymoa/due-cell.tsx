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
  chip?: boolean;
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
        <PopoverContent
          align="start"
          className="w-auto gap-0 rounded-panel bg-[var(--el-surface-card)] p-0 shadow-e3"
        >
          <Calendar
            mode="single"
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

function dateOf(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isoOf(date: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
