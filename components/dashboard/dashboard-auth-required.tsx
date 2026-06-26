import { Card, CardContent } from "@/components/ui/card";
import { GoogleLoginButton } from "@/components/auth/google-login-button";

export function DashboardAuthRequired() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--clay-canvas)] p-6">
      <Card className="w-full max-w-sm border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] p-6 shadow-none ring-0">
        <CardContent className="p-0">
          <h1 className="text-xl font-semibold">로그인이 필요합니다</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--clay-muted)]">
            Dashboard를 보려면 Google 계정으로 로그인해 주세요.
          </p>
          <div className="mt-5">
            <GoogleLoginButton className="items-start" />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
