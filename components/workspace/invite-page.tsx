"use client";

import { useRouter } from "next/navigation";
import { Info } from "lucide-react";

import { AuthCard, AuthPrimaryButton } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import {
  useAcceptWorkspaceInvitation,
  useDeclineWorkspaceInvitation,
  useGetInvitation,
} from "@/lib/api/generated/workspace-invitations/workspace-invitations";
import { useState } from "react";

type Outcome =
  | { kind: "pending" }
  | { kind: "accepted" }
  | { kind: "declined" }
  | { kind: "gone"; message: string };

/**
 * 초대 링크가 도착하는 자리(design.pen `ThXJo`). `GET /v1/invitations/{invitationId}` 가
 * 수락 **전** 미리보기를 주므로 「누가 · 어디로」를 말할 수 있다.
 *
 * 미리보기는 최소치만 온다 — 워크스페이스 이름과 초대자 이름뿐이고 멤버·회의는 안 온다.
 * 링크만 있으면 읽을 수 있는 자리라서다.
 */
export function InvitePage({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome>({ kind: "pending" });
  // 미리보기 실패는 화면을 막지 않는다 — 이름을 못 읽어도 수락·거절은 할 수 있어야 한다.
  const preview = useGetInvitation(invitationId, {
    query: { meta: { suppressErrorToast: true }, retry: false },
  });
  const invitation =
    preview.data?.status === 200 && preview.data.data.success
      ? preview.data.data.data
      : undefined;

  const onError = (error: unknown) => {
    if (errorCodeOf(error) === "INVITATION_NOT_PENDING") {
      setOutcome({
        kind: "gone",
        message: "이미 처리됐거나 만료된 초대입니다.",
      });
      return;
    }
    setOutcome({
      kind: "gone",
      message: errorMessageOf(error, "초대를 처리하지 못했습니다."),
    });
  };

  const accept = useAcceptWorkspaceInvitation({
    mutation: {
      meta: { suppressErrorToast: true },
      onError,
      onSuccess: (response) => {
        if (response.status === 200 && response.data.success) {
          router.replace(`/w/${response.data.data.workspaceId}/meetings`);
          return;
        }
        setOutcome({ kind: "accepted" });
      },
    },
  });
  const decline = useDeclineWorkspaceInvitation({
    mutation: {
      meta: { suppressErrorToast: true },
      onError,
      onSuccess: () => setOutcome({ kind: "declined" }),
    },
  });
  const isResolving = accept.isPending || decline.isPending;

  if (outcome.kind !== "pending") {
    return (
      <AuthCard
        title={
          outcome.kind === "accepted"
            ? "수락했습니다"
            : outcome.kind === "declined"
              ? "거절했습니다"
              : "열 수 없는 초대입니다"
        }
        description={
          outcome.kind === "gone"
            ? outcome.message
            : "받은 알림에서 언제든 다시 확인할 수 있습니다."
        }
      >
        <Button
          className="w-full"
          variant="outline"
          onClick={() => router.replace("/")}
        >
          홈으로
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      above={
        invitation ? (
          <span className="flex size-10 items-center justify-center rounded-full bg-[var(--el-surface-strong)] text-[15px] font-semibold text-[var(--el-ink)]">
            {invitation.inviterName.trim().slice(0, 1)}
          </span>
        ) : null
      }
      title={
        invitation
          ? `${invitation.inviterName}님이 초대했습니다`
          : "워크스페이스 초대를 받았습니다"
      }
      description={
        invitation ? (
          <>
            「{invitation.workspaceName}」에 멤버로 참여합니다.
            <br />
            수락하면 이 워크스페이스의 회의를 볼 수 있습니다.
          </>
        ) : (
          "수락하면 그 워크스페이스의 회의를 함께 보게 됩니다."
        )
      }
    >
      {preview.isError ? (
        <p className="flex w-full gap-2.5 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-4 py-3 text-[12px] leading-5 text-[var(--el-body)]">
          <Info className="mt-0.5 size-4 shrink-0 text-[var(--el-muted)]" />
          어느 워크스페이스인지 확인하지 못했습니다. 수락·거절은 그대로 할 수
          있고, 이름까지 보고 정하시려면 로그인 후 받은 알림에서 처리하세요.
        </p>
      ) : null}
      <div className="flex w-full flex-col gap-2">
        <AuthPrimaryButton
          disabled={isResolving}
          onClick={() => accept.mutate({ invitationId })}
        >
          {accept.isPending ? "수락하는 중" : "수락하고 들어가기"}
        </AuthPrimaryButton>
        <Button
          className="w-full"
          variant="outline"
          loading={decline.isPending}
          disabled={isResolving}
          onClick={() => decline.mutate({ invitationId })}
        >
          거절
        </Button>
      </div>
    </AuthCard>
  );
}
