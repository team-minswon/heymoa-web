"use client";

import { useRouter } from "next/navigation";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import {
  useAcceptWorkspaceInvitation,
  useDeclineWorkspaceInvitation,
} from "@/lib/api/generated/workspace-invitations/workspace-invitations";
import { useState } from "react";

type Outcome =
  | { kind: "pending" }
  | { kind: "accepted" }
  | { kind: "declined" }
  | { kind: "gone"; message: string };

/**
 * ⚠ 계약 갭 — 초대 **단건 조회 API 가 없다.** 목록은 `/v1/workspaces/{workspaceId}/invitations`
 * 뿐인데 초대받은 사람은 그 workspaceId 를 모른다. 그래서 이 화면은 수락 전에
 * 「어느 워크스페이스인지」를 말할 수 없다.
 *
 * 모르면서 아는 척하지 않는다 — 워크스페이스 이름을 지어내는 대신 없다고 밝히고,
 * 이름까지 보고 정하고 싶으면 받은 알림으로 보낸다(거기엔 초대 정보가 실려 온다).
 */
export function InvitePage({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome>({ kind: "pending" });

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

  return (
    <main className="flex min-h-svh items-center justify-center bg-[var(--el-canvas)] px-6 py-16">
      <div className="w-[440px] max-w-full rounded-panel border border-[var(--el-hairline)] bg-card px-10 py-12">
        {outcome.kind === "pending" ? (
          <>
            <h1 className="text-[26px] font-serif font-light leading-tight">
              워크스페이스 초대를
              <br />
              받았습니다
            </h1>
            <p className="mt-3 text-[13px] leading-6 text-[var(--el-muted)]">
              수락하면 그 워크스페이스의 회의를 함께 보게 됩니다.
            </p>
            <p className="mt-5 flex gap-2.5 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-4 py-3 text-[12px] leading-6 text-[var(--el-body)]">
              <Info className="mt-0.5 size-4 shrink-0 text-[var(--el-muted)]" />
              어느 워크스페이스인지는 아직 보여드릴 수 없습니다. 이름까지 보고
              정하시려면 로그인 후 받은 알림에서 수락하세요.
            </p>
            <div className="mt-7 flex gap-2">
              <Button
                size="lg"
                loading={accept.isPending}
                disabled={isResolving}
                onClick={() => accept.mutate({ invitationId })}
              >
                수락하고 들어가기
              </Button>
              <Button
                variant="outline"
                size="lg"
                loading={decline.isPending}
                disabled={isResolving}
                onClick={() => decline.mutate({ invitationId })}
              >
                거절
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-[26px] font-serif font-light leading-tight">
              {outcome.kind === "accepted"
                ? "수락했습니다"
                : outcome.kind === "declined"
                  ? "거절했습니다"
                  : "열 수 없는 초대입니다"}
            </h1>
            <p className="mt-3 text-[13px] leading-6 text-[var(--el-muted)]">
              {outcome.kind === "gone"
                ? outcome.message
                : "받은 알림에서 언제든 다시 확인할 수 있습니다."}
            </p>
            <Button
              className="mt-7"
              size="lg"
              variant="outline"
              onClick={() => router.replace("/")}
            >
              홈으로
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
