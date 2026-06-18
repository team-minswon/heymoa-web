import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/realillust/app-shell";
import { PageSection } from "@/components/realillust/primitives";
import { ScanReviewWorkspace } from "@/components/realillust/scan-review-workspace";
import { scans } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "검사 결과",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ScanResultPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const { scanId } = await params;
  const scan = scans.find((item) => item.id === scanId) ?? scans[0];

  return (
    <AppShell>
      <PageSection>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-black/60"
        >
          <ArrowLeft className="size-4" />
          검사 화면으로
        </Link>
        <div className="mt-6">
          <ScanReviewWorkspace scan={scan} />
        </div>
      </PageSection>
    </AppShell>
  );
}
