import { Copy, KeyRound, Plus } from "lucide-react";

import { AppShell } from "@/components/minswon/app-shell";
import { PageSection, Panel } from "@/components/minswon/primitives";
import { apiKeys } from "@/lib/mock-data";

export default function ApiKeysPage() {
  return (
    <AppShell>
      <PageSection>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-4xl font-semibold tracking-[-0.01em]">API key 관리</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-black/58">
              B2B 고객은 API key로 검사 요청을 만들고 webhook으로 비동기 결과를 받습니다.
            </p>
          </div>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--cg-green-accent)] px-5 text-sm font-semibold text-white">
            <Plus className="size-4" />새 key
          </button>
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
                    <p className="mt-1 font-mono text-sm text-black/58">{key.prefix}••••••••••••</p>
                    <p className="mt-3 text-sm text-black/55">
                      {key.tenant} · {key.limit} · 마지막 사용 {key.lastUsed}
                    </p>
                  </div>
                </div>
                <button className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--cg-green)] px-4 text-sm font-semibold text-[var(--cg-green)]">
                  <Copy className="size-4" />
                  prefix 복사
                </button>
              </div>
            </Panel>
          ))}
        </div>
      </PageSection>
    </AppShell>
  );
}
