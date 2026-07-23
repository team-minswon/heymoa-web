"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * 목 환경에서 외부 OAuth 제공자와 callback 이동을 함께 대신한다.
 *
 * callback을 `<a href>`로 걸면 최상위 내비게이션이 되는데, **MSW의 서비스 워커는 그것을
 * 가로채지 못한다** — 브라우저가 콜백 URL에 그대로 멈춘다. 그래서 fetch로 부르고
 * 이동은 라우터가 한다.
 */
export function MockOAuthConsent({
  workspaceId,
  provider,
}: {
  workspaceId: string;
  provider: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function allow() {
    setPending(true);
    await fetch(`/v1/integrations/${provider}/callback?state=${workspaceId}`, {
      credentials: "include",
    });
    router.replace(`/w/${workspaceId}`);
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-6 px-6">
      <div className="space-y-2">
        <p className="text-sm text-[var(--el-muted)]">목 환경 전용 화면</p>
        <h1 className="font-serif text-3xl font-light tracking-tight">
          {provider || "도구"} 연결을 허용할까요?
        </h1>
        <p className="text-sm text-[var(--el-muted)]">
          실제 환경에서는 {provider || "제공자"}의 로그인 화면이 열립니다. 목에서는 이
          화면이 그 자리를 대신합니다.
        </p>
      </div>

      <Button className="rounded-full" loading={pending} onClick={allow}>
        허용하고 돌아가기
      </Button>
    </main>
  );
}
