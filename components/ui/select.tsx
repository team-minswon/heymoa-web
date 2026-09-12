"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * 고르는 값이 **몇 개 안 되고 검색이 필요 없을 때**의 컨트롤.
 *
 * `Combobox` 와 가른다 — 저쪽은 후보가 많아 검색창이 필요한 자리(참석자 고르기)이고,
 * 여기는 역할처럼 둘·셋 중 하나인 자리다. `DropdownMenu` 와도 가른다: 저쪽은 *행동*을
 * 고르는 메뉴이고 이것은 *값*을 고르는 폼 컨트롤이라, 고른 값이 트리거에 남는다.
 */

function Select<Value>({ ...props }: SelectPrimitive.Root.Props<Value>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectTrigger({
  className,
  children,
  ...props
}: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        // 초대 폼의 입력·버튼과 같은 규격이다. 한 화면에서 컨트롤 높이가 갈리면 그 줄만
        // 눌려 보인다.
        // **글자 길이에 맞춘다.** 폭을 고정하면 「멤버」가 「관리자」 자리만큼 넓어져
        // 빈 공간이 남는다. 열을 맞춰야 하는 자리는 감싸는 쪽이 폭을 잡는다.
        "flex h-8 w-fit items-center justify-between gap-2 rounded-control border border-input bg-transparent px-2.5 text-sm outline-none select-none",
        "hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="shrink-0 text-[var(--el-muted)]">
        <ChevronsUpDownIcon className="size-3.5" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectValue({ ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className="truncate"
      {...props}
    />
  );
}

function SelectContent({
  className,
  sideOffset = 4,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<SelectPrimitive.Positioner.Props, "sideOffset">) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        className="isolate z-50 outline-none"
        sideOffset={sideOffset}
        alignItemWithTrigger={false}
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            // 팝오버는 e3 오버레이다 (ELEVATION SPEC). 시트·다이얼로그와 같은 티어다.
            "max-h-[min(20rem,var(--available-height))] min-w-[var(--anchor-width)] overflow-y-auto rounded-control border border-[var(--el-hairline)] bg-popover p-1 text-popover-foreground shadow-e3",
            "origin-[var(--transform-origin)] transition-[transform,opacity] data-ending-style:opacity-0 data-starting-style:opacity-0",
            className
          )}
          {...props}
        />
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "flex cursor-default items-center justify-between gap-2 rounded-[calc(var(--radius-control)-2px)] px-2 py-1.5 text-sm outline-none select-none",
        "data-highlighted:bg-muted data-highlighted:text-foreground",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="truncate">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="shrink-0">
        <CheckIcon className="size-3.5" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
