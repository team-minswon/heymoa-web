"use client";

import { CopyBlock } from "@/components/agent-connections/copy-block";

export function HomebrewInstallCommand({
  label,
  copyLabel,
  copied,
  failed,
}: {
  label: string;
  copyLabel: string;
  copied: string;
  failed: string;
}) {
  return (
    <div className="mt-2 [&_pre]:text-sm">
      <CopyBlock
        inline
        label={label}
        value="brew install --cask team-minswon/tap/heymoa"
        text={{ copy: copyLabel, copied, failed }}
      />
    </div>
  );
}
