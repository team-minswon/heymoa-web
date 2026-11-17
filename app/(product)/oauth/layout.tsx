import type { Metadata } from "next";

import { privateRouteMetadata } from "@/lib/site";

export const metadata: Metadata = privateRouteMetadata;

export default function AgentOAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center bg-[var(--el-canvas)] p-4 text-[var(--el-ink)]">
      {children}
    </main>
  );
}
