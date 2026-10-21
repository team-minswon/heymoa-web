"use client";

import { useState } from "react";
import {
  Captions,
  AlertTriangle,
  Check,
  Loader2,
  MessageCircle,
  MicOff,
  MousePointerClick,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuthUserId } from "@/components/auth/auth-provider";
import { isWaitingStatus } from "@/components/notes/review/flow-notice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ChoiceCards,
  composeFeedback,
  FEEDBACK_MAX,
} from "@/components/workspace/feedback-dialog";
import { track } from "@/lib/analytics/track";
import { useGetAnalysisFlow } from "@/lib/api/generated/analysis/analysis";
import {
  getGetMyFeedbacksQueryKey,
  useCreateFeedback,
} from "@/lib/api/generated/feedbacks/feedbacks";
import { okData } from "@/lib/api/ok-data";
import { readUserFlag, writeUserFlag } from "@/lib/storage/user-flags";
import { toast } from "@/lib/ui/toast";

const DAY_MS = 24 * 60 * 60 * 1000;
/** 한 번 물으면 이만큼 쉰다. 같은 사람에게 매 회의 묻지 않는다(MS 회의 설문 연구·Sprig 의 최소 간격). */
const ASK_GAP_MS = 7 * DAY_MS;
/** 닫기를 누르면 더 길게 쉰다. 「묻지 않기」만 영구다. */
const CLOSED_GAP_MS = 14 * DAY_MS;
/** 이보다 짧게 기록한 회의는 묻지 않는다 — 물을 경험이 없다. ponytail: 고정값, 실제 응답을 보고 조정. */
const MIN_RECORDED_MS = 3 * 60 * 1000;
/** 종료 확인창의 「회의 종료」를 누르고 이만큼 뒤에 뜬다. */
export const END_FEEDBACK_DELAY_MS = 1000;

/** 문의 목록에서 회의 종료 직후에 받은 글을 가르는 머리. 분류는 서버 enum 을 늘리지 않고 `OTHER` 를 쓴다. */
const PREFIX = "[회의 종료 후]";
/** 머리와 항목 이름이 앞에 붙으니 문의 한도에서 그만큼 덜어 둔다. */
const MESSAGE_MAX = FEEDBACK_MAX - 100;
/** 문의 창의 분류 카드와 같은 모양으로 하나를 고른다. 이름이 저장 글의 머리에 그대로 실린다. */
const REASONS = [
  {
    value: "recording",
    label: "녹음·소리",
    hint: "녹음이 끊기거나 소리가 안 잡혔어요",
    icon: MicOff,
    placeholder: "언제쯤 끊겼는지, 어떤 장치로 녹음했는지 적어 주세요.",
  },
  {
    value: "caption",
    label: "실시간 자막",
    hint: "자막이나 말한 사람이 틀렸어요",
    icon: Captions,
    placeholder: "어떤 말이 어떻게 틀리게 나왔는지 적어 주세요.",
  },
  {
    value: "flow",
    label: "속도·사용법",
    hint: "느리거나 쓰는 법이 헷갈렸어요",
    icon: MousePointerClick,
    placeholder: "어느 화면에서 무엇이 느리거나 헷갈렸는지 적어 주세요.",
  },
  {
    value: "other",
    label: "기타",
    hint: "그 밖의 이야기예요",
    icon: MessageCircle,
    placeholder: "하고 싶은 말을 편하게 적어 주세요.",
  },
] as const;
type Reason = (typeof REASONS)[number]["value"];

/**
 * 방금 끝난 회의에 물을 차례인가. 물을 차례면 **이 자리에서 다음 차례를 7일 뒤로 미룬다** — 묻는 순간이 곧
 * 쉬기 시작하는 순간이다. 사용자를 모르거나 「묻지 않기」를 눌렀거나 짧은 회의면 묻지 않는다.
 * **저장소를 못 읽거나 못 쓰면 묻지 않는다** — 간격과 「묻지 않기」를 지킬 수 없어 매 회의 뜨게 된다.
 */
export function claimEndFeedback(
  userId: string | undefined,
  recordedMs: number,
  now = Date.now()
): boolean {
  if (!userId || recordedMs < MIN_RECORDED_MS) return false;
  const off = readUserFlag(userId, "endFeedbackOff");
  const next = readUserFlag(userId, "endFeedbackNextAt");
  if (off === undefined || next === undefined || off === "1") return false;
  if (Number(next ?? 0) > now) return false;
  if (!writeUserFlag(userId, "endFeedbackNextAt", String(now + ASK_GAP_MS)))
    return false;
  track("feedback_opened", { from: "meeting_end" });
  return true;
}

/**
 * 회의를 종료한 뒤 요약 탭 **위에 뜨는** 의견 창. 배경은 조금만 어둡게 깔고 블러는 빼서, 뒤에서 진행 표시와
 * 요약이 나타나는 것이 보이게 둔다. 창 머리의 상태 줄도 분석 흐름을 따라 「정리하고 있어요」에서
 * 「요약이 준비됐어요」로 바뀐다 — 열린 채 끝나도 끝난 줄 안다.
 *
 * 요약은 아직 없으니 **방금 회의의 기록 경험**만 묻는다. 항목을 고르거나 글을 쓰면 보낼 수 있다.
 * 보내면 문의(`POST /v1/feedbacks`)로 저장돼 Slack 알림과 「내 문의」 답변이 따라온다.
 * X · Esc · 바깥 클릭은 「닫기」(14일 쉼)이고, 글을 쓰는 중에는 바깥 클릭으로 닫히지 않는다.
 */
export function MeetingEndFeedback({
  noteId,
  open,
  onClose,
}: {
  noteId: string;
  open: boolean;
  onClose: () => void;
}) {
  const userId = useAuthUserId();
  const queryClient = useQueryClient();
  // 목록 갱신은 훅에 건다 — `mutate` 의 콜백은 보내는 중에 창이 내려가면(다른 노트로 이동) 돌지 않는다.
  const create = useCreateFeedback({
    mutation: {
      onSuccess: () =>
        void queryClient.invalidateQueries({
          queryKey: getGetMyFeedbacksQueryKey(),
        }),
    },
  });
  // 요약 탭이 이미 폴링하는 흐름을 캐시에서만 읽는다 — 이 창이 따로 묻지 않는다.
  const flowQuery = useGetAnalysisFlow(noteId, { query: { enabled: false } });
  const flow = okData(flowQuery.data);
  const [reason, setReason] = useState<Reason | null>(null);
  const [message, setMessage] = useState("");
  // 요약 탭과 같은 기준 — 대기 상태여도 요약 영역이 이미 섰으면 준비된 것이다. 실패는 기다려도 끝나지 않으니
  // 「계속돼요」라고 하지 않고 요약 탭의 다시 분석으로 보낸다.
  const summaryReady = Boolean(
    flow?.regions?.some(
      (row) => row.region === "SUMMARY" && row.status === "SUCCEEDED"
    )
  );
  const settled =
    flow == null
      ? "running"
      : !isWaitingStatus(flow.status) || summaryReady
        ? "ready"
        : flow.status === "ANALYSIS_FAILED"
          ? "failed"
          : "running";
  // 기다리는 중에 조회가 실패하면(첫 조회든 폴링이든) 진행 중이라고 하지 않는다 — 요약 탭도 같은 자리에서 재시도
  // 화면이다. 이전 데이터가 캐시에 남아 있어도 마찬가지다.
  const progress =
    settled === "running" && flowQuery.isError ? "unknown" : settled;
  const picked = REASONS.find((item) => item.value === reason);
  const drafting = picked != null || message.trim().length > 0;

  function submit() {
    if (!drafting || create.isPending) return;
    const text = message.trim();
    const body = [picked?.label, text].filter(Boolean).join("\n");
    create.mutate(
      {
        data: {
          kind: "OTHER",
          message: composeFeedback(`${PREFIX} ${body}`),
        },
      },
      {
        onSuccess: () => {
          toast.success(
            "고마워요. 보낸 의견은 「문의·피드백」에서 볼 수 있어요."
          );
          onClose();
        },
      }
    );
  }

  function dismiss(forever: boolean) {
    if (userId) {
      if (forever) writeUserFlag(userId, "endFeedbackOff", "1");
      else
        writeUserFlag(
          userId,
          "endFeedbackNextAt",
          String(Date.now() + CLOSED_GAP_MS)
        );
    }
    track("feedback_dismissed", { from: "meeting_end", forever });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !create.isPending) dismiss(false);
      }}
      disablePointerDismissal={drafting}
    >
      <DialogContent
        overlayClassName="bg-black/40 supports-backdrop-filter:backdrop-blur-none"
        // 낮은 가로 화면이나 긴 글에서 보내기 버튼이 화면 밖으로 밀리지 않게 창 안에서 스크롤한다.
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto bg-[var(--el-surface-card)] p-7 sm:max-w-[640px]"
      >
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-[var(--el-muted)]"
        >
          {progress === "ready" ? (
            <>
              <Check aria-hidden className="size-4 text-[var(--el-ink)]" />
              요약이 준비됐어요
            </>
          ) : progress === "failed" ? (
            <>
              <AlertTriangle
                aria-hidden
                className="size-4 text-[var(--el-error)]"
              />
              회의를 분석하지 못했어요 · 요약 탭에서 다시 분석할 수 있어요
            </>
          ) : progress === "unknown" ? (
            <>
              <AlertTriangle aria-hidden className="size-4" />
              요약 상태를 불러오지 못했어요 · 요약 탭에서 다시 시도할 수 있어요
            </>
          ) : (
            <>
              <Loader2 aria-hidden className="size-4 animate-spin" />
              회의를 정리하고 있어요 · 창을 닫아도 계속돼요
            </>
          )}
        </p>
        <DialogTitle className="mt-4 text-xl">
          방금 회의, 아쉬운 점이 있었나요?
        </DialogTitle>
        <DialogDescription className="mt-1.5 text-sm">
          남겨 주시면 운영팀이 읽고 답해요.
        </DialogDescription>

        <div className="mt-6 grid gap-4">
          <ChoiceCards
            label="아쉬웠던 점"
            items={REASONS}
            value={reason}
            onChange={setReason}
          />
          <div>
            <Textarea
              aria-label="내용"
              value={message}
              maxLength={MESSAGE_MAX}
              rows={5}
              className="max-h-60 min-h-32"
              placeholder={
                picked?.placeholder ?? "아쉬웠던 점을 편하게 적어 주세요."
              }
              onChange={(event) => setMessage(event.target.value)}
            />
            <p className="mt-1 text-right text-[11px] tabular-nums text-[var(--el-muted-soft)]">
              {message.length} / {MESSAGE_MAX}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => dismiss(true)}
            className="text-xs text-[var(--el-muted-soft)] underline underline-offset-2 hover:text-[var(--el-ink)]"
          >
            회의 후 의견 묻지 않기
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--el-muted-soft)]">
              회의 내용은 자동으로 붙지 않아요.
            </span>
            <Button
              type="button"
              size="lg"
              disabled={!drafting}
              loading={create.isPending}
              onClick={submit}
            >
              보내기
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
