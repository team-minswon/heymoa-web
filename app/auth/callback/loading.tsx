import { LoaderCircle } from "lucide-react";

import { StatusPanel } from "@/components/heymoa/status-panel";

export default function AuthCallbackLoading() {
  return (
    <main className="flex min-h-screen items-center bg-[var(--clay-canvas)] px-4 py-12 text-[var(--clay-primary)]">
      <StatusPanel
        icon={LoaderCircle}
        iconClassName="animate-spin"
        label="Auth"
        title="로그인 처리 중"
        description="Google 인증 결과를 확인하고 있습니다."
      />
    </main>
  );
}
