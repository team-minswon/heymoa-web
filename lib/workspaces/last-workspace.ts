const STORAGE_KEY = "heymoa:last-workspace";

export function readLastWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Safari 프라이빗 모드처럼 localStorage 접근 자체가 던지는 환경이 있습니다.
    return null;
  }
}

export function rememberWorkspaceId(workspaceId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, workspaceId);
  } catch {}
}

export function pickWorkspaceId(
  items: readonly { workspaceId: string }[]
): string | undefined {
  const remembered = readLastWorkspaceId();
  const match = remembered
    ? items.find((item) => item.workspaceId === remembered)
    : undefined;
  return (match ?? items[0])?.workspaceId;
}

export function sortByLastVisited<T extends { workspaceId: string }>(
  items: readonly T[]
): T[] {
  const remembered = readLastWorkspaceId();
  const index = remembered
    ? items.findIndex((item) => item.workspaceId === remembered)
    : -1;
  if (index <= 0) return [...items];
  return [items[index], ...items.slice(0, index), ...items.slice(index + 1)];
}
