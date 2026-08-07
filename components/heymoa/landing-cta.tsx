"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";

import { AuthModal } from "@/components/auth/auth-modal";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { CreateWorkspaceDialog } from "@/components/workspace/create-workspace-dialog";
import { useGetWorkspaces } from "@/lib/api/generated/workspaces/workspaces";
import { cn } from "@/lib/utils";

/** design.pen 정본의 마케팅 pill — h48 · px24 · 15px. 제품 면의 `size="xl"`(h40)과 다르다. */
export const MARKETING_PILL = "h-12 rounded-full px-6 text-[15px]";

/**
 * 랜딩의 주 CTA. 비로그인이면 로그인 모달을, 로그인 상태면 대시보드 링크를 낸다.
 *
 * design.pen은 비로그인 화면(`UWqm8`)만 그린다 — 로그인한 사람에게 「Google 계정으로 시작」을
 * 보이면 이미 가진 것을 다시 권하는 셈이라 라벨과 행선지를 상태로 가른다. 워크스페이스 조회는
 * Navbar와 같은 쿼리 키라 캐시를 그대로 쓴다(추가 요청이 없다).
 */
export function LandingCta({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const { status } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const isAuthenticated = status === "authenticated";
  const workspacesQuery = useGetWorkspaces({
    query: { enabled: isAuthenticated, staleTime: 5 * 60 * 1000 },
  });
  const envelope =
    workspacesQuery.data?.status === 200 ? workspacesQuery.data.data : undefined;
  const workspaces = envelope?.success ? (envelope.data.workspaces ?? []) : [];
  const workspaceId =
    workspaces.find((workspace) => workspace.isDefault)?.workspaceId ??
    workspaces[0]?.workspaceId;

  if (isAuthenticated) {
    // 조회가 끝나기 전에 「Google 계정으로 시작」을 잠깐 보이면 이미 로그인한 사람에게
    // 라벨이 튄다 — 확정될 때까지 같은 자리에 대시보드 버튼을 로딩으로 둔다.
    //
    // **children이 아래 확정 버튼과 글자 하나까지 같아야 한다.** `Button`은 로딩 중 라벨을
    // `opacity-0`으로 남겨 폭을 보존하지만, 보존하는 것은 *자기가 받은* children의 폭이다.
    // 여기에만 `ArrowRight`가 없던 동안 146.1px로 떴다가 확정되며 168.1px로 22px 튀었다.
    if (workspacesQuery.isPending) {
      return (
        <Button
          type="button"
          loading
          disabled
          className={cn(MARKETING_PILL, className)}
        >
          대시보드로 이동
          <ArrowRight className="size-4" />
        </Button>
      );
    }
    // **조회 실패와 워크스페이스 0개는 다른 상태다.** 실패는 재시도로 풀리지만 0개는 아무리
    // 다시 받아도 0개다 — 예전에는 둘을 같은 「다시 시도」로 그려서, 마지막 워크스페이스에서
    // 추방된 사람이 누를수록 같은 자리로 돌아오는 버튼만 남았다(APP-402). 실패 문구는 Navbar가
    // 이미 토스트로 띄우므로(같은 쿼리) 여기서는 다시 띄우지 않는다.
    if (!workspaceId && workspacesQuery.isError) {
      return (
        <Button
          type="button"
          loading={workspacesQuery.isFetching}
          disabled={workspacesQuery.isFetching}
          aria-label="대시보드 다시 시도"
          onClick={() => void workspacesQuery.refetch()}
          className={cn(MARKETING_PILL, className)}
        >
          다시 시도
        </Button>
      );
    }
    // 워크스페이스가 하나도 없다. **만드는 입구가 여기밖에 없다** — 사이드바의 「새 워크스페이스」는
    // `/w/[workspaceId]` 아래에 있어서 0개인 사람은 닿을 수 없다.
    if (!workspaceId) {
      return (
        <>
          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            className={cn(MARKETING_PILL, className)}
          >
            워크스페이스 만들기
            <Plus className="size-4" />
          </Button>
          <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
        </>
      );
    }
    // `nativeButton={false}`를 주지 않는다 — base-ui가 dev 경고를 내지만, 그 prop을 주면
    // 앵커에 `role="button"`이 붙어 링크가 아니게 된다. 이동하는 것은 링크로 읽혀야 한다.
    // Navbar의 대시보드 버튼도 같은 자리에서 같은 선택을 한다.
    return (
      <Button
        render={<Link href={`/w/${workspaceId}`} />}
        className={cn(MARKETING_PILL, className)}
      >
        대시보드로 이동
        <ArrowRight className="size-4" />
      </Button>
    );
  }

  return (
    <AuthModal>
      <Button type="button" className={cn(MARKETING_PILL, className)}>
        {label}
        <ArrowRight className="size-4" />
      </Button>
    </AuthModal>
  );
}
