"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Plus } from "lucide-react";

import { AuthCard, AuthPrimaryButton } from "@/components/auth/auth-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateWorkspace } from "@/lib/api/generated/workspaces/workspaces";

/**
 * 워크스페이스가 하나도 없는 사람이 도착하는 자리. 앱 셸은 워크스페이스를 전제하므로
 * 여기서는 셸을 쓰지 않는다 — 사이드바가 가리킬 것이 없다.
 */
export function WelcomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const create = useCreateWorkspace({
    mutation: {
      onSuccess: (response) => {
        if (response.status !== 201 || !response.data.success) return;
        router.replace(`/w/${response.data.data.workspaceId}/meetings`);
      },
    },
  });
  const trimmed = name.trim();

  return (
    <AuthCard
      title="첫 워크스페이스를 만들어 주세요"
      description="워크스페이스는 회의·프로젝트·멤버가 모이는 단위입니다. 나중에 이름을 바꾸거나 더 만들 수 있습니다."
      footer={
        <p className="max-w-[440px] text-center text-[12px] leading-5 text-[var(--el-muted)]">
          초대를 받으셨다면 받은 알림에서 수락하세요 — 그때는 만들지 않아도
          됩니다.
        </p>
      }
    >
      <form
        className="flex w-full flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmed) create.mutate({ data: { name: trimmed } });
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="workspace-name">워크스페이스 이름</Label>
          <Input
            id="workspace-name"
            value={name}
            autoFocus
            maxLength={50}
            placeholder="예: 프로덕트 팀"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <AuthPrimaryButton
          type="submit"
          disabled={!trimmed || create.isPending}
        >
          <Plus className="size-4" />
          {create.isPending ? "만드는 중" : "워크스페이스 만들기"}
        </AuthPrimaryButton>
      </form>
    </AuthCard>
  );
}
