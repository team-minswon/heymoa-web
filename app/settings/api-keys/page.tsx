import type { Metadata } from "next";
import { Copy, KeyRound, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/realillust/app-shell";
import { PageSection, Panel } from "@/components/realillust/primitives";
import { apiKeys } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "API key 관리",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ApiKeysPage() {
  return (
    <AppShell>
      <PageSection>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-4xl font-semibold tracking-[-0.01em]">
              API key 관리
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-black/58">
              B2B 고객은 API key로 검사 요청을 만들고 webhook으로 비동기 결과를
              받습니다.
            </p>
          </div>
          <Button className="h-11 rounded-full bg-[var(--cg-green-accent)] px-5 text-sm font-semibold text-white hover:bg-[var(--cg-green)]">
            <Plus data-icon="inline-start" />새 key
          </Button>
        </div>

        <div className="mt-8 grid gap-5">
          {apiKeys.map((key) => (
            <Panel key={key.prefix} className="p-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="flex items-start gap-4">
                  <span className="grid size-12 place-items-center rounded-full bg-[var(--cg-mint)] text-[var(--cg-green)]">
                    <KeyRound className="size-6" />
                  </span>
                  <div>
                    <h2 className="text-xl font-semibold">{key.name}</h2>
                    <p className="mt-1 font-mono text-sm text-black/58">
                      {key.prefix}••••••••••••
                    </p>
                    <p className="mt-3 text-sm text-black/55">
                      {key.tenant} · {key.limit} · 마지막 사용 {key.lastUsed}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="h-10 rounded-full border-[var(--cg-green)] px-4 text-sm font-semibold text-[var(--cg-green)]"
                >
                  <Copy data-icon="inline-start" />
                  prefix 복사
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      </PageSection>
    </AppShell>
  );
}
