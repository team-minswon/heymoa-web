import { useTranslations } from "next-intl";

import {
  type getRecordingUsage,
  useGetRecordingUsageSuspense,
} from "@/lib/api/generated/billing/billing";
import { okData } from "@/lib/api/ok-data";

export const RECORDING_USAGE_POLL_MS = 5 * 60_000;

export const RECORDING_USAGE_QUERY = {
  staleTime: 0,
  refetchOnWindowFocus: true,
  refetchIntervalInBackground: false,
  refetchInterval: (query: {
    state: { data: Awaited<ReturnType<typeof getRecordingUsage>> | undefined };
  }) => (okData(query.state.data)?.enforced ? RECORDING_USAGE_POLL_MS : false),
};

export function useRecordingUsage(workspaceId: string) {
  const t = useTranslations("billing");
  const data = okData(
    useGetRecordingUsageSuspense(workspaceId, { query: RECORDING_USAGE_QUERY })
      .data
  );
  if (!data) throw new Error(t("loadFailed"));
  return data;
}

export function isPaidPeriod(usage: {
  periodKind: string | null;
  unlimited: boolean | null;
}) {
  return usage.periodKind != null
    ? usage.periodKind === "PAID"
    : usage.unlimited === true;
}

/** 다 썼는지는 서버의 남은 샘플(없으면 분)로 가릅니다 — 분은 내림이라 몇십 초 남아도 0분으로 보입니다. */
export function freeUsageLevel(usage: {
  usedMinutes: number | null;
  allowanceMinutes: number | null;
  remainingMinutes: number | null;
  remainingSamples: number | null;
}) {
  const used = usage.usedMinutes ?? 0;
  const allowance = usage.allowanceMinutes ?? 0;
  const ratio = (used / Math.max(1, allowance)) * 100;
  const exhausted =
    usage.remainingSamples != null
      ? usage.remainingSamples <= 0
      : used >= allowance;
  const level: "ok" | "near" | "exhausted" = exhausted
    ? "exhausted"
    : ratio >= 80
      ? "near"
      : "ok";
  const remainingMinutes = Math.max(
    0,
    usage.remainingMinutes ?? allowance - used
  );
  return {
    level,
    percent: exhausted ? 100 : Math.min(99, Math.floor(ratio)),
    remainingMinutes,
    underMinute: (usage.remainingSamples ?? 0) > 0 && remainingMinutes === 0,
  };
}
