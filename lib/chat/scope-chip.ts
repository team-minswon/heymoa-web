import { cn } from "@/lib/utils";

/**
 * 문장에 붙는 범위 하나. **순수 층이 소유한다** — 마커 파서와 컴포저와 말풍선이 다
 * 쓰는 값이라, 화면 파일에 두면 순수 모듈이 컴포넌트를 참조하게 된다.
 */
export type ScopeChip = {
  kind: "note" | "project";
  id: string;
  title: string;
};

/**
 * 범위 칩의 생김새. **한 벌에서 갈라진다.**
 *
 * 칩은 두 곳에 뜬다 — 쓰는 동안의 입력(`mention-input`)과 보낸 뒤의 말풍선
 * (`chat-thread`). 크기·여백·모양·아이콘·글자색은 같아야 「내가 붙인 그것」이 이어진다.
 * 입력 쪽은 React 밖에서 DOM 으로 만들고 말풍선은 JSX 라 컴포넌트로 묶을 수가 없다 —
 * 함께 가는 것은 class 뿐이다.
 *
 * **바탕까지 같다.** 말풍선에서만 배경을 빼면 같은 알약이 두 모양이 된다. 틴트는
 * 말풍선 색에서 출발해 색을 한 숨만 넣은 값이라 흰 입력창에서도 따뜻한 말풍선에서도
 * 같게 앉는다.
 */
export function scopeChipClass(
  kind: ScopeChip["kind"],
  options?: { extra?: string }
) {
  return cn(
    "mx-[3px] inline-flex max-w-full items-center gap-1.5 rounded-chip px-2 py-[3px]",
    "align-middle text-[13.5px] leading-[1.35] font-medium",
    // 색으로 가른다 — 프로젝트가 파랑, 회의록이 초록.
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
