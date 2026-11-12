import { useTranslations } from "next-intl";

import {
  type getRecordingUsage,
  useGetRecordingUsageSuspense,
} from "@/lib/api/generated/billing/billing";
import { okData } from "@/lib/api/ok-data";

/** 집행 대상 공간의 사용량을 다시 읽는 주기. */
export const RECORDING_USAGE_POLL_MS = 5 * 60_000;

/**
 * 사용량 조회 설정. 요금제 탭·사이드바·녹음 독이 같은 키(`getGetRecordingUsageQueryKey`)에 이것을 그대로 붙인다.
 * 같은 공간의 다른 멤버가 녹음을 끝내거나 다른 관리자가 Pro 로 올리거나 달이 바뀌는 것은 이 화면이 모르므로,
 * 창으로 돌아올 때와 창이 보이는 동안 5분마다 다시 읽는다. 집행 대상이 아니면(`enforced=false`) 바뀔 표시가 없어 주기 읽기를 끈다.
 */
export const RECORDING_USAGE_QUERY = {
  staleTime: 0,
  refetchOnWindowFocus: true,
  refetchIntervalInBackground: false,
  refetchInterval: (query: {
    state: { data: Awaited<ReturnType<typeof getRecordingUsage>> | undefined };
  }) => (okData(query.state.data)?.enforced ? RECORDING_USAGE_POLL_MS : false),
};

/**
 * 그 공간의 녹음 사용량(suspense). 값은 전부 서버가 준 분 필드이고 샘플 값으로 다시 계산하지 않는다. 키가 공간 id 를 품는다.
 * 새로 읽는 동안에도 이미 그린 값을 그대로 둔다 — suspense 는 첫 조회에서만 멈춘다.
 */
export function useRecordingUsage(workspaceId: string) {
  const t = useTranslations("billing");
  const data = okData(
    useGetRecordingUsageSuspense(workspaceId, { query: RECORDING_USAGE_QUERY })
      .data
  );
  if (!data) throw new Error(t("loadFailed"));
  return data;
}

/** 유료 결제 기간인지. 유료 기간은 달력월이 아니라 결제일 기준이라 문구가 다르다. 서버의 기간 종류가 없으면 무제한으로 가른다. */
export function isPaidPeriod(usage: {
  periodKind: string | null;
  unlimited: boolean | null;
}) {
  return usage.periodKind != null
    ? usage.periodKind === "PAID"
    : usage.unlimited === true;
}

/**
 * Free 사용량의 표시 단계(APP-1596). 요금제 탭과 사이드바가 이것 하나로 글과 색을 정한다.
 * - `ok` 80% 미만 — 「쓴 양 / 한도」
 * - `near` 80% 이상 다 쓰기 전 — 「N 남음」, 주의색
 * - `exhausted` 다 썼다 — 「이번 달 한도를 다 썼습니다」, 위험색(빨강은 여기만)
 * 다 썼는지는 서버의 남은 샘플(없으면 분)로 가른다 — 분은 내림이라 몇십 초 남은 공간이 0분으로 보여도 아직 시작할 수 있다.
 * `percent` 는 막대 폭이고 언제나 쓴 만큼 차오른다. 다 쓰기 전에는 99 를 넘지 않는다.
 * `underMinute` 는 1분 미만(샘플은 남고 분은 0)이 남았다는 뜻이다 — 「0분 남음」 대신 「1분 미만 남음」으로 그린다.
 */
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
