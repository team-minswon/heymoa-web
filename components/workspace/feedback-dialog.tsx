"use client";

import { useEffect, useState } from "react";
import {
  CircleHelp,
  Lightbulb,
  MessageCircle,
  MessageSquareText,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { InlineRetry } from "@/components/ui/inline-retry";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useFeedbackAnswers } from "@/components/workspace/use-feedback-answers";
import {
  getGetMyFeedbacksQueryKey,
  useCreateFeedback,
} from "@/lib/api/generated/feedbacks/feedbacks";
import type {
  CreateFeedbackRequestKind,
  FeedbackResponseData,
} from "@/lib/api/generated/models";
import { formatAppDate } from "@/lib/format/date";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/utils";

/**
 * 문의·피드백. 서버가 받아 저장하고(`POST /v1/feedbacks`) 운영자에게 Slack 으로 알린다.
 * 답변은 운영자가 DB 에 직접 넣고, 「내 문의」 탭이 그것을 보여 준다.
 *
 * **회의 내용은 자동으로 싣지 않는다.** 현재 화면 경로(쿼리 제외)와 환경 요약만 본문 뒤에 붙는다.
 */
// 본문 뒤에 붙는 화면·환경 꼬리(최대 FOOTER_MAX)까지 합쳐 서버 한도(1500)를 넘지 않게 사용자 몫을 줄여 둔다.
export const FEEDBACK_MAX = 1200;
const FOOTER_MAX = 250;

type Kind = CreateFeedbackRequestKind;

const KINDS: {
  value: Kind;
  label: string;
  hint: string;
  icon: LucideIcon;
  placeholder: string;
}[] = [
  {
    value: "INCIDENT",
    label: "장애·오류",
    hint: "안 되거나 이상해요",
    icon: TriangleAlert,
    placeholder:
      "언제, 어떤 화면에서 무엇이 안 됐는지 적어 주세요. 오류 문구가 있으면 같이요.",
  },
  {
    value: "QUESTION",
    label: "사용 문의",
    hint: "어떻게 쓰는지 궁금해요",
    icon: CircleHelp,
    placeholder:
      "궁금한 점을 적어 주세요. 어떤 기능인지 알려 주시면 더 정확히 답해요.",
  },
  {
    value: "SUGGESTION",
    label: "기능 제안",
    hint: "이런 게 있으면 좋겠어요",
    icon: Lightbulb,
    placeholder: "어떤 상황에서 무엇이 있으면 좋을지 적어 주세요.",
  },
  {
    value: "OTHER",
    label: "기타",
    hint: "그 밖의 이야기예요",
    icon: MessageCircle,
    placeholder: "하고 싶은 말을 편하게 적어 주세요.",
  },
];

const KIND_LABEL = Object.fromEntries(
  KINDS.map(({ value, label }) => [value, label])
) as Record<Kind, string>;

/** 보내는 글 전체. 본문 뒤에 어디서 썼는지만 덧붙인다 — 경로에 쿼리는 안 싣는다. */
export function composeFeedback(message: string): string {
  const where = typeof window === "undefined" ? "" : window.location.pathname;
  const env = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const footer = `\n\n---\n화면: ${where}\n환경: ${env}`.slice(0, FOOTER_MAX);
  return `${message.trim()}${footer}`;
}

/**
 * 새 답변 수. 읽어서 0 이 되면 마지막 숫자를 남긴 채 150ms 동안 흐려지며 사라진다 — 숫자가 「0」으로 바뀌거나 자리가
 * 툭 빠지지 않게. 한 번도 숫자가 없었으면 아무것도 그리지 않는다. 사이드바와 「내 문의」 탭이 같이 쓴다.
 */
export function UnseenCount({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  const [shown, setShown] = useState(count);
  if (count > 0 && count !== shown) setShown(count);
  if (shown === 0) return null;
  const visible = count > 0;
  return (
    <span
      aria-hidden={!visible}
      aria-label={visible ? `새 답변 ${count}개` : undefined}
      className={cn(
        "tabular-nums transition-opacity duration-150 motion-reduce:transition-none",
        visible ? "opacity-100" : "opacity-0",
        className
      )}
    >
      {shown}
    </span>
  );
}

/** 아이콘 · 이름 · 한 줄 설명을 단 2열 카드 중 하나를 고른다. 회의 종료 뒤 의견 창도 같은 모양을 쓴다. */
export function ChoiceCards<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: readonly { value: T; label: string; hint: string; icon: LucideIcon }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid grid-cols-2 gap-2"
    >
      {items.map(({ value: item, label: name, hint, icon: Icon }) => (
        <button
          key={item}
          type="button"
          role="radio"
          aria-checked={value === item}
          onClick={() => onChange(item)}
          className={cn(
            "flex items-start gap-2.5 rounded-panel border p-3 text-left transition-colors",
            value === item
              ? "border-[var(--el-hairline-strong)] bg-[var(--el-surface-strong)]"
              : "border-[var(--el-hairline)] hover:border-[var(--el-hairline-strong)]"
          )}
        >
          <Icon
            className={cn(
              "mt-0.5 size-4 shrink-0",
              value === item ? "text-[var(--el-ink)]" : "text-[var(--el-muted)]"
            )}
            strokeWidth={1.5}
            aria-hidden
          />
          <span className="flex flex-col">
            <span className="text-sm font-medium text-[var(--el-ink)]">
              {name}
            </span>
            <span className="text-xs text-[var(--el-muted)]">{hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

const SENT_AT: Intl.DateTimeFormatOptions = {
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

export function FeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const create = useCreateFeedback();
  const {
    feedbacks,
    unseen,
    markSeen,
    resetMarkSeen,
    isLoading,
    isError,
    refetch,
  } = useFeedbackAnswers();
  const [tab, setTab] = useState<"send" | "mine">("send");
  const [kind, setKind] = useState<Kind>("QUESTION");
  const [message, setMessage] = useState("");
  const empty = message.trim().length === 0;
  const current = KINDS.find((item) => item.value === kind)!;

  // 내 문의를 펼쳐 본 순간 새 답변을 읽은 것으로 친다.
  useEffect(() => {
    if (open && tab === "mine") markSeen();
  }, [open, tab, markSeen]);
  // 실패한 읽음 처리는 창을 다시 열 때 한 번 더 시도한다.
  useEffect(() => {
    if (!open) resetMarkSeen();
  }, [open, resetMarkSeen]);

  function submit() {
    if (empty || create.isPending) return;
    create.mutate(
      { data: { kind, message: composeFeedback(message) } },
      {
        onSuccess: () => {
          toast.success(
            "보냈어요. 답변이 달리면 「내 문의」에서 볼 수 있어요."
          );
          setMessage("");
          setTab("mine");
          void queryClient.invalidateQueries({
            queryKey: getGetMyFeedbacksQueryKey(),
          });
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--el-surface-card)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>문의·피드백</DialogTitle>
          <DialogDescription>
            불편했던 점, 궁금한 점, 바라는 점을 알려 주세요.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as typeof tab)}
        >
          <TabsList
            variant="line"
            className="border-b border-[var(--el-hairline)]"
          >
            <TabsTrigger value="send">보내기</TabsTrigger>
            <TabsTrigger value="mine">
              내 문의
              <UnseenCount
                count={unseen}
                className="ml-1.5 text-[11px] text-[var(--el-ink)]"
              />
            </TabsTrigger>
          </TabsList>

          {/*
            두 패널을 한 칸에 겹쳐 둔다 — 창 높이는 더 큰 「보내기」 쪽을 따라서, 탭을 바꿔도 안 변하고 문구가
            길어져도 푸터가 패널 밖으로 넘치지 않는다(APP-1292. 예전엔 둘 다 380px 고정이라 푸터가 32px 넘쳤다).
            「보내기」는 숨겨도(inert) 높이를 재도록 `keepMounted` 에 `hidden={false}` 로 남기고 `invisible` 로만 가린다.
            「내 문의」는 목록을 칸 안에 절대 배치해 자기 높이를 칸에 보태지 않는다.
          */}
          <div className="mt-4 grid">
            <TabsContent
              value="send"
              keepMounted
              hidden={false}
              className="col-start-1 row-start-1 flex flex-col gap-4 [&[inert]]:invisible"
            >
              <ChoiceCards
                label="분류"
                items={KINDS}
                value={kind}
                onChange={setKind}
              />

              <div>
                <Textarea
                  aria-label="내용"
                  value={message}
                  maxLength={FEEDBACK_MAX}
                  rows={6}
                  className="max-h-60 min-h-32"
                  placeholder={current.placeholder}
                  onChange={(event) => setMessage(event.target.value)}
                />
                <p className="mt-1 text-right text-[11px] tabular-nums text-[var(--el-muted-soft)]">
                  {message.length} / {FEEDBACK_MAX}
                </p>
              </div>

              <p className="text-xs leading-relaxed text-[var(--el-muted)]">
                현재 화면 경로와 사용 환경이 함께 담겨요. 회의 내용은 보내지
                않아요.
              </p>

              <DialogFooter className="bg-transparent">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                >
                  취소
                </Button>
                <Button
                  type="button"
                  disabled={empty}
                  loading={create.isPending}
                  onClick={submit}
                >
                  보내기
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent
              value="mine"
              className="relative col-start-1 row-start-1"
            >
              <div className="absolute inset-0">
                {isLoading ? (
                  <div
                    aria-label="내 문의를 불러오는 중"
                    className="flex flex-col gap-3"
                  >
                    <Skeleton className="h-24 w-full rounded-panel" />
                    <Skeleton className="h-24 w-full rounded-panel" />
                  </div>
                ) : isError ? (
                  <InlineRetry
                    label="내 문의를 불러오지 못했어요"
                    onRetry={() => void refetch()}
                  />
                ) : (
                  <MyFeedbacks feedbacks={feedbacks} />
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function MyFeedbacks({ feedbacks }: { feedbacks: FeedbackResponseData[] }) {
  if (feedbacks.length === 0) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-[var(--el-muted)]">
        아직 보낸 문의가 없어요.
      </p>
    );
  }
  return (
    <ul className="flex h-full flex-col gap-3 overflow-y-auto pr-1">
      {feedbacks.map((item) => (
        <li
          key={item.feedbackId}
          className="rounded-panel border border-[var(--el-hairline)] p-4"
        >
          <div className="flex items-center justify-between gap-2 text-xs text-[var(--el-muted)]">
            <span>
              {KIND_LABEL[item.kind]} · {formatAppDate(item.createdAt, SENT_AT)}
            </span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5",
                item.answer
                  ? "border-[var(--el-ink)] text-[var(--el-ink)]"
                  : "border-[var(--el-hairline-strong)]"
              )}
            >
              {item.answer ? "답변 완료" : "접수됨"}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--el-ink)]">
            {userPart(item.message)}
          </p>
          {item.answer ? (
            <div className="mt-3 flex gap-2.5 rounded-control bg-[var(--el-surface-strong)] p-3">
              <MessageSquareText
                className="mt-0.5 size-4 shrink-0 text-[var(--el-muted)]"
                strokeWidth={1.5}
                aria-hidden
              />
              <div>
                <p className="whitespace-pre-wrap text-sm text-[var(--el-ink)]">
                  {item.answer}
                </p>
                {item.answeredAt ? (
                  <p className="mt-1 text-[11px] text-[var(--el-muted-soft)]">
                    HeyMoa 팀 · {formatAppDate(item.answeredAt, SENT_AT)}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** 보낼 때 뒤에 붙인 화면·환경 꼬리는 보낸 사람에게 다시 보이지 않는다. */
function userPart(message: string) {
  const at = message.indexOf("\n\n---\n화면: ");
  return at === -1 ? message : message.slice(0, at);
}
