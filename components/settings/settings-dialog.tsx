"use client";

import { useState } from "react";
import { Building2, Plug, UserRound, UsersRound } from "lucide-react";
import { AccountSettingsForm } from "@/components/settings/account-settings-form";
import { MembersSettings } from "@/components/settings/members-settings";
import { WorkspaceIntegrationsSettings } from "@/components/settings/workspace-integrations-settings";
import { WorkspaceSettingsForm } from "@/components/settings/workspace-settings-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export type SettingsSection =
  | "account"
  | "workspace"
  | "members"
  | "integrations";

function SettingsSections({
  initialSection,
  workspaceId,
}: {
  initialSection: SettingsSection;
  workspaceId: string;
}) {
  const [section, setSection] = useState(initialSection);
  return (
    <div className="grid h-full min-h-0 bg-[var(--el-canvas-soft)] md:grid-cols-[220px_1fr]">
      <nav
        aria-label="설정"
        className="border-b border-[var(--el-hairline)] bg-[var(--el-canvas)] p-4 md:border-r md:border-b-0 md:p-6"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--el-muted)]">
          Preferences
        </p>
        <p className="mb-7 mt-2 font-serif text-3xl font-light tracking-[-0.03em]">
          설정
        </p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
          <Button
            type="button"
            variant={section === "account" ? "secondary" : "ghost"}
            onClick={() => setSection("account")}
            className="h-10 justify-start rounded-xl px-3"
          >
            <UserRound />내 계정
          </Button>
          <Button
            type="button"
            variant={section === "workspace" ? "secondary" : "ghost"}
            onClick={() => setSection("workspace")}
            className="h-10 justify-start rounded-xl px-3"
          >
            <Building2 />
            워크스페이스 일반
          </Button>
          <Button
            type="button"
            variant={section === "members" ? "secondary" : "ghost"}
            onClick={() => setSection("members")}
            className="h-10 justify-start rounded-xl px-3"
          >
            <UsersRound />
            멤버
          </Button>
          <Button
            type="button"
            variant={section === "integrations" ? "secondary" : "ghost"}
            onClick={() => setSection("integrations")}
            className="h-10 justify-start rounded-xl px-3"
          >
            <Plug />
            연동
          </Button>
        </div>
      </nav>
      <div className="min-h-0 overflow-y-auto bg-white/60 p-6 pt-14 sm:p-10 md:p-14">
        {section === "account" ? (
          <AccountSettingsForm />
        ) : section === "members" ? (
          <MembersSettings workspaceId={workspaceId} />
        ) : section === "integrations" ? (
          <WorkspaceIntegrationsSettings workspaceId={workspaceId} />
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
      <DialogContent className="h-dvh max-h-none w-screen max-w-none gap-0 overflow-hidden rounded-none border border-black/5 bg-[var(--el-canvas)] p-0 shadow-[0_28px_80px_rgba(12,10,9,0.18)] sm:h-[min(760px,calc(100dvh-3rem))] sm:max-w-5xl sm:rounded-[28px]">
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
