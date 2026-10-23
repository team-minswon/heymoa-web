"use client";

import { useEffect } from "react";

import { REAUTH_CHANNEL, type ReauthMessage } from "@/lib/auth/reauth";

/**
 * 재로그인 결과를 원래 창에 알리고 닫는다. 창이 안 닫히면(스크립트가 연 창이 아니라고 브라우저가 판단) 닫으라고만 적는다.
 * 증명은 주소에 남기지 않는다 — 알린 뒤 주소에서 지운다.
 */
export function ReauthLanding({
  purpose,
  proof,
  failed,
}: {
  purpose: string;
  proof?: string;
  failed: boolean;
}) {
  useEffect(() => {
    const message: ReauthMessage = { purpose, ok: !failed, proof };
    const channel = new BroadcastChannel(REAUTH_CHANNEL);
    channel.postMessage(message);
    channel.close();
    window.history.replaceState(null, "", window.location.pathname);
    window.close();
  }, [purpose, proof, failed]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--el-canvas)] p-4 text-center">
      <p className="text-sm text-[var(--el-muted)]">
        {failed
          ? "다시 로그인하지 못했습니다. 이 창을 닫고 원래 화면에서 다시 시도해 주세요."
          : "확인했습니다. 이 창을 닫고 원래 화면으로 돌아가 주세요."}
      </p>
    </main>
  );
}
