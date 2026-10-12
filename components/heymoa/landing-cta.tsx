"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";

import { AuthModal } from "@/components/auth/auth-modal";
import { useAuth } from "@/components/auth/auth-provider";
import { Button, LinkButton } from "@/components/ui/button";
import { CreateWorkspaceDialog } from "@/components/workspace/create-workspace-dialog";
import { useGetWorkspaces } from "@/lib/api/generated/workspaces/workspaces";
import { cn } from "@/lib/utils";
import { pickWorkspaceId } from "@/lib/workspaces/last-workspace";

/** 인증 콜백이 워크스페이스 없는 사람을 보낼 때 붙인다. 이 쿼리가 있으면 생성 폼을 바로 연다. */
export const WELCOME_PARAM = "welcome";

/** 랜딩의 마케팅 pill — h48 · px24 · 15px. 제품 면의 `size="xl"`(h40)과 다르다. */
export const MARKETING_PILL = "h-12 rounded-full px-6 text-[15px]";

/**
 * 랜딩의 주 CTA. 비로그인이면 로그인 모달을, 로그인 상태면 대시보드 링크를 낸다.
 *
 * 아트보드는 비로그인 화면만 그린다 — 로그인한 사람에게 「Google 계정으로 시작」을
 * 보이면 이미 가진 것을 다시 권하는 셈이라 라벨과 행선지를 상태로 가른다. 워크스페이스 조회는
 * Navbar와 같은 쿼리 키라 캐시를 그대로 쓴다(추가 요청이 없다).
 */
export function LandingCta({
  label,
  className,
  openOnWelcome = false,
}: {
  label: string;
  className?: string;
  /** 첫 로그인 직후 생성 폼을 열 인스턴스. 랜딩에 CTA가 여럿이라 **하나만** 켠다(히어로). */
  openOnWelcome?: boolean;
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
  const workspaceId = pickWorkspaceId(workspaces);
  const hasNoWorkspace = workspacesQuery.isSuccess && !workspaceId;

  useEffect(() => {
    if (!openOnWelcome || !hasNoWorkspace) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has(WELCOME_PARAM)) return;
    // 새로고침·뒤로 가기마다 다시 열리지 않게 쿼리를 지운다. 같은 화면이라 이동이 아니다.
    url.searchParams.delete(WELCOME_PARAM);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    // URL 쿼리(외부 상태)를 한 번 읽어 폼을 여는 동기화라 effect가 맞다(workspace-app-shell 의 연동 복귀와 같다).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCreateOpen(true);
  }, [openOnWelcome, hasNoWorkspace]);

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
    return (
      <LinkButton
        href={`/w/${workspaceId}`}
        className={cn(MARKETING_PILL, className)}
      >
        대시보드로 이동
        <ArrowRight className="size-4" />
      </LinkButton>
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
