import Image from "next/image";
import { AlertTriangle, LogIn } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { CenteredCard } from "@/components/layout/centered-card";
import { buildGoogleOAuthUrl } from "@/lib/auth/paths";
import { InAppLoginGate } from "@/components/auth/in-app-login-gate";

/**
 * 동의 흐름 카드의 머리 표시. 무엇에 연결하는지가 HeyMoa 라 HeyMoa 로고를 둔다 — 요청한 앱(Claude · Codex …)의
 * 이름은 바로 아래 제목이 말한다. 앱 아이콘은 받지 않으므로 로봇 같은 일반 그림을 두면 어느 쪽 표시인지 흐려졌다.
 */
export const HEYMOA_MARK = (
  <Image
    src="/apple-touch-icon.png"
    alt="HeyMoa"
    width={44}
    height={44}
    className="rounded-full object-contain"
  />
);

/**
 * 외부 에이전트가 연 브라우저에서 로그인이 안 돼 있을 때(APP-888). 로그인하면 `returnTo` — 이 인가 요청이나
 * 동의 화면 — 로 쿼리째 돌아온다.
 */
export function AgentOAuthLoginCard({ returnTo }: { returnTo: string }) {
  const t = useTranslations("agents.login");
  const locale = useLocale();
  return (
    <CenteredCard icon={HEYMOA_MARK}>
      <h1 className="text-2xl font-light tracking-[-0.01em]">
        {t("title")}
      </h1>
      <p className="mt-2 text-base text-[var(--el-muted)]">
        {t("description")}
      </p>
      <InAppLoginGate returnTo={returnTo}>
        <a
          href={buildGoogleOAuthUrl(returnTo, locale)}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--el-ink)] px-7 py-3.5 text-base font-medium text-white"
        >
          <LogIn className="size-4" aria-hidden />
          {t("google")}
        </a>
      </InAppLoginGate>
    </CenteredCard>
  );
}

/**
 * 이어갈 요청이 없을 때. server 가 문구를 줬으면 그대로 받는다. 안 넘기면 server 를 부르지 않고 끝나는 자리(쿼리 없음)이고,
 * server 의 `AGENT_OAUTH_REQUEST_NOT_FOUND` 문구와 같은 말을 그린다.
 */
export function AgentOAuthEndCard({ message }: { message?: string }) {
  const t = useTranslations("agents.end");
  return (
    <CenteredCard icon={<AlertTriangle className="size-5" aria-hidden />}>
      <h1 className="text-2xl font-light tracking-[-0.01em]">
        {t("title")}
      </h1>
      <p className="mt-2 text-base text-[var(--el-muted)]">
        {message ?? t("reconnect")}
      </p>
    </CenteredCard>
  );
}
