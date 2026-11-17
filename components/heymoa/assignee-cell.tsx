"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { PersonAvatar } from "@/components/heymoa/person-avatar";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import {
  assigneeImageOf,
  assigneeKey,
  describeAssignee,
  type AssigneeChoice,
  type AssigneeValue,
} from "@/lib/assignees/describe";
import { cn } from "@/lib/utils";

export const QUIET_EMPTY =
  "transition-opacity duration-150 ease-out motion-reduce:transition-none sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100";

function useAssigneeNames() {
  const t = useTranslations("common.assigneeCell");
  const speakerName = (label: string) => t("speaker", { label });
  return {
    describe: (value: AssigneeValue | null | undefined) => describeAssignee(value, speakerName),
    choiceName: (choice: AssigneeChoice) =>
      choice.type === "SPEAKER_LABEL" ? speakerName(choice.label) : choice.name,
  };
}

export function AssigneeFace({
  value,
  placeholder,
  image,
  quiet = false,
}: {
  value: AssigneeValue | null;
  placeholder?: string;
  quiet?: boolean;
  image?: string | null;
}) {
  const t = useTranslations("common.assigneeCell");
  const view = useAssigneeNames().describe(value);
  if (!view) {
    if (quiet && placeholder) {
      return (
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] text-[var(--el-muted)]">
          <span
            aria-hidden
            className="size-[18px] shrink-0 rounded-full border border-dashed border-[var(--el-muted)]"
          />
          <span className={cn("truncate", QUIET_EMPTY)}>{placeholder}</span>
        </span>
      );
    }
    return (
      <span className="text-[13px] text-[var(--el-muted-soft)]">{placeholder}</span>
    );
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] text-[var(--el-ink)]">
      <PersonAvatar name={view.avatarKey} image={image ?? view.image} size={18} />
      <span className={cn("truncate", view.unnamed && "text-[var(--el-muted)]")}>
        {view.name}
      </span>
      {view.unnamed ? (
        <span
          aria-label={t("unnamedSpeaker")}
          className="size-[5px] shrink-0 rounded-full bg-[var(--el-muted-soft)]"
        />
      ) : null}
    </span>
  );
}

export function AssigneeCell({
  value,
  choices,
  editable = false,
  placeholder,
  quiet = false,
  onChange,
  className,
}: {
  value: AssigneeValue | null;
  choices: AssigneeChoice[];
  editable?: boolean;
  placeholder?: string;
  quiet?: boolean;
  onChange?: (next: AssigneeChoice | null) => void;
  className?: string;
}) {
  const t = useTranslations("common.assigneeCell");
  const names = useAssigneeNames();
  const [open, setOpen] = useState(false);
  const empty = placeholder ?? t("placeholder");
  const selectedImage = assigneeImageOf(choices, value);

  if (!editable) {
    return (
      <span className={cn("inline-flex h-7 min-w-0 items-center", className)}>
        <AssigneeFace value={value} image={selectedImage} quiet={quiet} />
      </span>
    );
  }

  const current = assigneeKey(value);
  const view = names.describe(value);

  return (
    <Combobox
      items={choices}
      open={open}
      onOpenChange={setOpen}
      itemToStringLabel={names.choiceName}
      onValueChange={(choice: AssigneeChoice | null) => {
        if (choice) onChange?.(choice);
        setOpen(false);
      }}
    >
      <ComboboxTrigger
        render={
          <button
            type="button"
            aria-label={view ? t("change", { name: view.name }) : empty}
            className={cn(
              "-mx-1.5 inline-flex h-9 min-w-0 items-center rounded-control px-1.5 hover:bg-[var(--el-surface-strong)] focus-visible:outline-2 focus-visible:outline-[var(--el-ink)] sm:h-7 [&>svg]:hidden",
              className
            )}
          >
            <AssigneeFace value={value} placeholder={empty} image={selectedImage} quiet={quiet} />
          </button>
        }
      />
      <ComboboxContent align="start" className="w-60">
        <ComboboxInput aria-label={t("search")} placeholder={t("search")} showTrigger={false} />
        <ComboboxEmpty>{t("noMatch")}</ComboboxEmpty>
        <ComboboxList>
          {(choice: AssigneeChoice) => (
            <ComboboxItem
              key={assigneeKey(choice)}
              value={choice}
              className={cn("gap-2", assigneeKey(choice) === current && "font-medium")}
            >
              <AssigneeFace value={choice} />
            </ComboboxItem>
          )}
        </ComboboxList>
        {value ? (
          <div className="border-t border-[var(--el-hairline)] p-1">
            <button
              type="button"
              className="w-full rounded-control px-2 py-1.5 text-left text-[13px] text-[var(--el-muted)] hover:bg-[var(--el-canvas-soft)]"
              onClick={() => {
                onChange?.(null);
                setOpen(false);
              }}
            >
              {t("clear")}
            </button>
          </div>
        ) : null}
      </ComboboxContent>
    </Combobox>
  );
}
