import { LoaderCircle } from "lucide-react";

import { StatusPanel } from "@/components/realillust/status-panel";

export default function OnboardingLoading() {
  return (
    <main className="flex min-h-screen items-center bg-[var(--cg-cream)] px-4 py-12 text-[var(--cg-ink)]">
      <StatusPanel
        icon={LoaderCircle}
        iconClassName="animate-spin text-[var(--clay-primary)]"
        label="Onboarding"
        title="온보딩 준비 중"
        description="온보딩 단계를 불러오고 있습니다."
      />
    </main>
  );
}
