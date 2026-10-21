"use client";

import { CopyBlock } from "@/components/agent-connections/copy-block";

/** 다운로드 페이지의 Homebrew 명령. 글은 페이지가 그 언어로 넘긴다(언어 파일 `download.homebrew`). */
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
