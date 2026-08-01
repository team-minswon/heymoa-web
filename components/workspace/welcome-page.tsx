"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
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
    <main className="flex min-h-svh items-center justify-center bg-[var(--el-canvas)] px-6 py-16">
      <div className="w-[440px] max-w-full rounded-panel border border-[var(--el-hairline)] bg-card px-10 py-12">
        <h1 className="text-[26px] font-serif font-light leading-tight">
          첫 워크스페이스를
          <br />
          만들어 주세요
        </h1>
        <p className="mt-3 text-[13px] leading-6 text-[var(--el-muted)]">
          회의는 워크스페이스 안에 쌓입니다. 팀 이름이나 제품 이름이면 충분하고,
          나중에 바꿀 수 있습니다.
        </p>

        <form
          className="mt-8 grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed) create.mutate({ data: { name: trimmed } });
          }}
        >
          <Label htmlFor="workspace-name">워크스페이스 이름</Label>
          <Input
            id="workspace-name"
            value={name}
            autoFocus
            maxLength={50}
            placeholder="제품 팀"
            onChange={(event) => setName(event.target.value)}
          />
          <Button
            type="submit"
            className="mt-4"
            size="lg"
            loading={create.isPending}
            disabled={!trimmed}
          >
            만들고 시작하기
          </Button>
        </form>

        <p className="mt-6 text-[12px] leading-5 text-[var(--el-muted)]">
          초대를 받으셨다면 받은 알림에서 수락하세요 — 그때는 만들지 않아도
          됩니다.
        </p>
      </div>
    </main>
  );
}
