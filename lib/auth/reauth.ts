import { useCallback, useEffect, useRef, useState } from "react";

import { buildApiUrl } from "@/lib/auth/paths";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";

/**
 * 되돌릴 수 없는 삭제(탈퇴·워크스페이스 삭제) 직전의 Google 재로그인 (PRO-69 contract 「재로그인 시작·증명 발급」).
 *
 * **새 창으로 연다.** 지금 창을 Google 로 보내면 고른 처리·사유·입력이 사라진다. 새 창은 Google 을 다녀와
 * `/auth/reauth` 에 닿고, 그 페이지가 결과를 `BroadcastChannel` 로 알린다. `window.opener` 로 받지 않는 이유:
 * Google 로그인 페이지의 COOP 가 창 관계를 끊어 돌아와도 opener 가 null 이고, 같은 이유로 `popup.closed` 도 믿을 수 없다.
 *
 * server 방식(APP-1378 spec)이 정해지기 전의 가정: 시작 주소는 로그인과 같은 authorize 에 `reauth=<목적>` 을 붙인 것,
 * 증명은 server 가 쿠키로 심거나 돌아오는 주소의 `proof` 로 준다. 둘 다 받는다. 다르면 여기만 고친다.
 */
export type ReauthPurpose = "ACCOUNT_DELETE" | "WORKSPACE_DELETE";

export type ReauthResult = { ok: true; proof?: string } | { ok: false };

export const REAUTH_CHANNEL = "heymoa:reauth";
export const REAUTH_RETURN_PATH = "/auth/reauth";
/** Google 창에서 아무것도 하지 않고 떠난 경우. 지나면 확인 화면으로 돌아간다. */
const REAUTH_TIMEOUT_MS = 5 * 60_000;

export type ReauthMessage = { purpose: string; ok: boolean; proof?: string };

export function reauthUrl(purpose: ReauthPurpose) {
  const returnTo = `${REAUTH_RETURN_PATH}?purpose=${purpose}`;
  // 목 환경에는 Google 이 없다 — 돌아올 페이지로 바로 간다(`/mock-oauth` 와 같은 까닭).
  if (shouldEnableMocking()) return `${returnTo}&proof=mock-reauth-proof`;
  return buildApiUrl(
    `/v1/auth/oauth2/authorize/google?reauth=${purpose}&returnTo=${encodeURIComponent(returnTo)}`
  );
}

/**
 * 클릭 처리기 안에서 **기다리기 전에** 부른다 — 팝업 차단을 피하려면 사용자 활성화가 살아 있어야 한다.
 * 창을 못 열면 `null` 이다(호출부가 안내한다).
 */
export function startReauth(purpose: ReauthPurpose): {
  result: Promise<ReauthResult>;
  cancel: () => void;
} | null {
  const popup = window.open(
    reauthUrl(purpose),
    "heymoa-reauth",
    "popup,width=480,height=640"
  );
  if (!popup) return null;

  const channel = new BroadcastChannel(REAUTH_CHANNEL);
  let finish: (value: ReauthResult) => void = () => undefined;
  const result = new Promise<ReauthResult>((resolve) => {
    finish = resolve;
  });
  const timer = window.setTimeout(() => done({ ok: false }), REAUTH_TIMEOUT_MS);

  function done(value: ReauthResult) {
    window.clearTimeout(timer);
    channel.close();
    finish(value);
  }

  channel.onmessage = (event: MessageEvent<ReauthMessage>) => {
    if (event.data?.purpose !== purpose) return;
    done(event.data.ok ? { ok: true, proof: event.data.proof } : { ok: false });
  };

  return { result, cancel: () => done({ ok: false }) };
}

/**
 * 재로그인을 기다리는 동안의 상태. `run()` 은 클릭 처리기에서 바로 부른다.
 * `"blocked"` 는 새 창이 막힌 것, `{ ok: false }` 는 취소·시간 초과·실패다 — 어느 쪽이든 아무것도 바뀌지 않았다.
 */
export function useReauth(purpose: ReauthPurpose) {
  const [waiting, setWaiting] = useState(false);
  const pending = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => () => pending.current?.cancel(), []);

  const run = useCallback(async (): Promise<ReauthResult | "blocked"> => {
    const started = startReauth(purpose);
    if (!started) return "blocked";
    pending.current = started;
    setWaiting(true);
    try {
      return await started.result;
    } finally {
      pending.current = null;
      setWaiting(false);
    }
  }, [purpose]);

  const cancel = useCallback(() => pending.current?.cancel(), []);

  return { waiting, run, cancel };
}

export const REAUTH_BLOCKED_MESSAGE =
  "Google 로그인 창을 열지 못했습니다. 브라우저의 팝업 차단을 풀고 다시 시도해 주세요.";
export const REAUTH_FAILED_MESSAGE =
  "Google로 다시 로그인하지 않아 아무것도 바뀌지 않았습니다. 다시 시도해 주세요.";
