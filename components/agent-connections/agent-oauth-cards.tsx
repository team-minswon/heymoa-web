import { AlertTriangle, Bot, LogIn } from "lucide-react";

import { CenteredCard } from "@/components/layout/centered-card";
import { buildGoogleOAuthUrl } from "@/lib/auth/paths";

/**
 * 외부 에이전트가 연 브라우저에서 로그인이 안 돼 있을 때(APP-888). 로그인하면 `returnTo` — 이 인가 요청이나
 * 동의 화면 — 로 쿼리째 돌아온다.
 */
export function AgentOAuthLoginCard({ returnTo }: { returnTo: string }) {
  return (
    <CenteredCard icon={<Bot className="size-5" aria-hidden />}>
      <h1 className="font-serif text-xl font-light tracking-[-0.01em]">
        에이전트를 HeyMoa 에 연결하려면 로그인하세요
      </h1>
      <p className="mt-2 text-sm text-[var(--el-muted)]">
        로그인하면 이 에이전트에게 워크스페이스를 맡길지 고르는 화면으로
        이어집니다.
      </p>
      <a
        href={buildGoogleOAuthUrl(returnTo)}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--el-ink)] px-6 py-3 text-sm font-medium text-white"
      >
        <LogIn className="size-4" aria-hidden />
        Google로 계속하기
      </a>
    </CenteredCard>
  );
}

/** 이어갈 요청이 없을 때. 문구는 server 가 준 것을 그대로 받는다 — 화면이 따로 만들지 않는다. */
export function AgentOAuthEndCard({ message }: { message: string }) {
  return (
    <CenteredCard icon={<AlertTriangle className="size-5" aria-hidden />}>
      <h1 className="font-serif text-xl font-light tracking-[-0.01em]">
        연결을 이어갈 수 없습니다
      </h1>
      <p className="mt-2 text-sm text-[var(--el-muted)]">{message}</p>
    </CenteredCard>
  );
}

/** server 의 `AGENT_OAUTH_REQUEST_NOT_FOUND` 문구와 같다. server 를 부르지 않고 끝나는 자리(쿼리 없음)에 쓴다. */
export const AGENT_OAUTH_RECONNECT_MESSAGE =
  "연결 요청을 찾을 수 없습니다. 에이전트에서 다시 연결해 주세요.";
