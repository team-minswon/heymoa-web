import type { Metadata } from "next";
import { RefreshCw, RadioTower } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/realillust/app-shell";
import { PageSection, Panel } from "@/components/realillust/primitives";
import { webhookLogs } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Webhook 로그",
  robots: {
    index: false,
    follow: false,
  },
};

export default function WebhooksPage() {
  return (
    <AppShell>
      <PageSection>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-4xl font-semibold tracking-[-0.01em]">
              Webhook 로그
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-black/58">
              고객 endpoint 전송 결과, retry 횟수, timeout 상태를 운영자가
              추적합니다.
            </p>
          </div>
          <Button
            variant="outline"
            className="h-11 rounded-full border-[var(--cg-green)] px-5 text-sm font-semibold text-[var(--cg-green)]"
          >
            <RefreshCw data-icon="inline-start" />
            새로고침
          </Button>
        </div>

        <Panel className="mt-8 overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_100px_100px] gap-4 border-b border-black/10 bg-[var(--cg-ceramic)] px-5 py-3 text-sm font-semibold text-black/58 max-lg:hidden">
            <span>Tenant</span>
            <span>Endpoint</span>
            <span>Attempts</span>
            <span>Status</span>
          </div>
          <div className="divide-y divide-black/10">
            {webhookLogs.map((log) => (
              <div
                key={log.id}
                className="grid gap-3 p-5 lg:grid-cols-[1fr_1fr_100px_100px]"
              >
                <div>
                  <p className="font-semibold">{log.tenant}</p>
                  <p className="text-sm text-black/55">{log.id}</p>
                </div>
                <p className="break-all text-sm text-black/65">
                  {log.endpoint}
                </p>
                <p className="text-sm font-semibold">{log.attempts}</p>
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--cg-mint)] px-3 py-1 text-xs font-semibold text-[var(--cg-green)]">
                  <RadioTower className="size-3" />
                  {log.status}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </PageSection>
    </AppShell>
  );
}
