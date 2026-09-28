import { cn } from "@/lib/utils";

/**
 * 문장에 붙는 범위 하나. 마커 파서·컴포저·말풍선이 다 쓰는 값이라 순수 층에 둔다.
 */
export type ScopeChip = {
  kind: "note" | "project";
  id: string;
  title: string;
};

/**
 * 범위 칩의 생김새. 입력(`mention-input`)은 React 밖 DOM 이고 말풍선(`chat-thread`)은 JSX 라
 * 컴포넌트로 못 묶어서 class 한 벌을 같이 쓴다. 바탕까지 같아야 「내가 붙인 그것」이 이어진다.
 */
export function scopeChipClass(
  kind: ScopeChip["kind"],
  options?: { extra?: string }
) {
  return cn(
    "mx-[3px] inline-flex max-w-full items-center gap-1.5 rounded-chip px-2 py-[3px]",
    "align-middle text-[13.5px] leading-[1.35] font-medium",
    kind === "project"
      ? "bg-[var(--el-scope-project-soft)] text-[var(--el-scope-project)]"
      : "bg-[var(--el-scope-note-soft)] text-[var(--el-scope-note)]",
    options?.extra
  );
}

/** 허용 집합의 키. `kind` 가 달라도 id 가 같을 수 있어 둘을 함께 쥔다. */
export function scopeKey(chip: Pick<ScopeChip, "kind" | "id">) {
  return `${chip.kind}:${chip.id}`;
}
