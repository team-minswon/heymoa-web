import { HEYMOA_MARK } from "@/components/agent-connections/agent-oauth-cards";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { CenteredCard } from "@/components/layout/centered-card";

/**
 * 로그인 안 한 채 워크스페이스·노트 주소를 열었을 때(APP-1312 — 메일·알림의 노트 링크). 예전에는 워크스페이스 조회가
 * 401 로 끝나 「워크스페이스를 불러오지 못했습니다 · 다시 시도」만 서서 나갈 길이 없었다.
 *
 * 돌아올 자리는 로그인 버튼이 누르는 순간의 주소(`getCurrentReturnTo`)라 탭·메일 쿼리까지 그대로다 — 서버는
 * 레이아웃이라 쿼리를 모른다.
 */
export function WorkspaceLoginCard() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--el-canvas)] p-4 text-[var(--el-ink)]">
      <CenteredCard icon={HEYMOA_MARK}>
        <h1 className="text-2xl font-light tracking-[-0.01em] text-balance">
          로그인하면 이 화면으로 돌아옵니다
        </h1>
        <p className="mt-2 text-base text-[var(--el-muted)]">
          회의를 보려면 워크스페이스 멤버 계정으로 로그인해 주세요.
        </p>
        <GoogleLoginButton className="mt-6 flex justify-center" />
      </CenteredCard>
    </div>
  );
}
