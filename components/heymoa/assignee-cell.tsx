"use client";

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

export function choiceName(choice: AssigneeChoice) {
  return choice.type === "SPEAKER_LABEL" ? `화자 ${choice.label}` : choice.name;
}

/** 담당 한 사람. 이름 없는 화자는 점 하나로 「아직 누구인지 모른다」를 붙인다. */
export function AssigneeFace({
  value,
  placeholder,
  image,
}: {
  value: AssigneeValue | null;
  placeholder?: string;
  /**
   * 값이 못 들고 온 계정 사진. **서버는 담당을 풀 때 사진을 안 싣는다** — 사람 목록에는
   * 있으므로 부르는 쪽이 같은 열쇠로 찾아 넘긴다 (APP-678).
   */
  image?: string | null;
}) {
  const view = describeAssignee(value);
  if (!view) {
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
          aria-label="이름 없는 화자"
          className="size-[5px] shrink-0 rounded-full bg-[var(--el-muted-soft)]"
        />
      ) : null}
    </span>
  );
}

/**
 * 담당 칸. 검토 화면과 할 일 목록이 같은 칸을 쓴다. 고를 수 있는 사람은 부르는 쪽이 넘긴다 —
 * 검토 화면은 이 회의의 화자까지, 할 일 목록은 워크스페이스 사람만.
 */
export function AssigneeCell({
  value,
  choices,
  editable = false,
  placeholder = "담당 정하기",
  label = "담당",
  onChange,
  className,
}: {
  value: AssigneeValue | null;
  choices: AssigneeChoice[];
  editable?: boolean;
  placeholder?: string;
  label?: string;
  onChange?: (next: AssigneeChoice | null) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedImage = assigneeImageOf(choices, value);

  if (!editable) {
    return (
      <span className={cn("inline-flex h-7 min-w-0 items-center", className)}>
        <AssigneeFace value={value} image={selectedImage} />
      </span>
    );
  }

  const current = assigneeKey(value);
  const view = describeAssignee(value);

  return (
    <Combobox
      items={choices}
      open={open}
      onOpenChange={setOpen}
      itemToStringLabel={choiceName}
      onValueChange={(choice: AssigneeChoice | null) => {
        if (choice) onChange?.(choice);
        setOpen(false);
      }}
    >
      <ComboboxTrigger
        render={
          <button
            type="button"
            aria-label={view ? `${label} ${view.name} 바꾸기` : placeholder}
            className={cn(
              // 좁은 화면은 손가락으로 누르므로 칸을 키운다. 넓은 화면은 표의 줄 높이에 맞춘다.
              "-mx-1.5 inline-flex h-9 min-w-0 items-center rounded-control px-1.5 hover:bg-[var(--el-surface-strong)] focus-visible:outline-2 focus-visible:outline-[var(--el-ink)] sm:h-7 [&>svg]:hidden",
              className
            )}
          >
            <AssigneeFace value={value} placeholder={placeholder} image={selectedImage} />
          </button>
        }
      />
      <ComboboxContent align="start" className="w-60">
        <ComboboxInput aria-label="이름으로 찾기" placeholder="이름으로 찾기" showTrigger={false} />
        <ComboboxEmpty>맞는 사람이 없습니다.</ComboboxEmpty>
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
              담당 비우기
            </button>
          </div>
        ) : null}
      </ComboboxContent>
    </Combobox>
  );
}
