"use client";

import { useState } from "react";
import { Building2, UserRound } from "lucide-react";
import { AccountSettingsForm } from "@/components/settings/account-settings-form";
import { WorkspaceSettingsForm } from "@/components/settings/workspace-settings-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export type SettingsSection = "account" | "workspace";

function SettingsSections({
  initialSection,
  workspaceId,
}: {
  initialSection: SettingsSection;
  workspaceId: string;
}) {
  const [section, setSection] = useState(initialSection);
  return (
    <div className="grid h-full min-h-0 md:grid-cols-[240px_1fr]">
      <nav
        aria-label="설정"
        className="border-b border-[var(--el-hairline)] bg-white p-4 md:border-r md:border-b-0 md:p-6"
      >
        <p className="mb-4 font-serif text-xl font-light">설정</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
          <Button
            type="button"
            variant={section === "account" ? "secondary" : "ghost"}
            onClick={() => setSection("account")}
            className="justify-start rounded-xl"
          >
            <UserRound />내 계정
          </Button>
          <Button
            type="button"
            variant={section === "workspace" ? "secondary" : "ghost"}
            onClick={() => setSection("workspace")}
            className="justify-start rounded-xl"
          >
            <Building2 />
            워크스페이스 일반
          </Button>
        </div>
      </nav>
      <div className="min-h-0 overflow-y-auto p-6 pt-14 sm:p-10 md:p-12">
        {section === "account" ? (
          <AccountSettingsForm />
        ) : (
          <WorkspaceSettingsForm workspaceId={workspaceId} />
        )}
      </div>
    </div>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
  initialSection = "account",
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection?: SettingsSection;
  workspaceId: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-dvh max-h-none w-screen max-w-none gap-0 overflow-hidden rounded-none bg-[var(--el-canvas)] p-0 sm:h-[min(760px,calc(100dvh-3rem))] sm:max-w-5xl sm:rounded-3xl">
        <DialogTitle className="sr-only">설정</DialogTitle>
        <DialogDescription className="sr-only">
          계정과 워크스페이스 설정을 관리합니다.
        </DialogDescription>
        <SettingsSections
          key={`${initialSection}-${open}`}
          initialSection={initialSection}
          workspaceId={workspaceId}
        />
      </DialogContent>
    </Dialog>
  );
}
