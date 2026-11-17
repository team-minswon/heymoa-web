import { cn } from "@/lib/utils";

export type ScopeChip = {
  kind: "note" | "project";
  id: string;
  title: string;
};

export function scopeChipClass(
  kind: ScopeChip["kind"],
  options?: { extra?: string }
) {
  return cn(
    "mx-[3px] inline-flex max-w-full items-center gap-1.5 rounded-chip px-2 py-[3px]",
    "align-middle text-[13.5px] leading-[1.35] font-medium whitespace-normal text-left [overflow-wrap:anywhere]",
    kind === "project"
      ? "bg-[var(--el-scope-project-soft)] text-[var(--el-scope-project)]"
      : "bg-[var(--el-scope-note-soft)] text-[var(--el-scope-note)]",
    options?.extra
  );
}

export function scopeKey(chip: Pick<ScopeChip, "kind" | "id">) {
  return `${chip.kind}:${chip.id}`;
}
