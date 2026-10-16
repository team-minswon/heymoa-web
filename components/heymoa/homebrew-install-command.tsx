"use client";

import { CopyBlock } from "@/components/agent-connections/copy-block";

export function HomebrewInstallCommand() {
  return (
    <div className="mt-2 [&_pre]:text-sm">
      <CopyBlock
        inline
        label="Homebrew 설치 명령어"
        value="brew install --cask team-minswon/tap/heymoa"
      />
    </div>
  );
}
