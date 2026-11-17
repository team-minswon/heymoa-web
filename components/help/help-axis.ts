import { useSyncExternalStore } from "react";

import { helpGroups } from "@/app/[lang]/help/_content/groups";
import type { HelpAxis } from "@/app/[lang]/help/_content/types";

function axisOfPath(pathname: string): HelpAxis {
  const slug = pathname.split("/")[2];
  return helpGroups.find((group) => group.slug === slug)?.axis ?? "feature";
}

let pick: { path: string; axis: HelpAxis } | null = null;
const listeners = new Set<() => void>();

export function pickHelpAxis(path: string, axis: HelpAxis) {
  pick = { path, axis };
  listeners.forEach((fn) => fn());
}

export function useHelpAxis(pathname: string): HelpAxis {
  const picked = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => pick,
    () => null
  );
  return picked?.path === pathname ? picked.axis : axisOfPath(pathname);
}
