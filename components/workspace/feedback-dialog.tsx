"use client";

import { useState } from "react";
import { Copy, Mail } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { siteConfig } from "@/lib/site";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/utils";

/**
 * 문의·피드백. **1차는 메일로 보낸다** — `mailto:` 로 미리 채워 열고, 안 열리면 복사한다.
 *
 * 데스크톱 앱은 `http(s)` 밖의 주소를 외부로 열지 않아(`apps/desktop/src/policy.ts`) 앱에서는
 * `mailto:` 가 동작하지 않는다. 그래서 복사가 같은 무게의 길이다. server 가 직접 받아 보내는 방식은
 * 별도 이슈(APP-1174)고, 그때 이 창의 전송 수단만 바꾼다.
 *
 * **회의 내용은 자동으로 싣지 않는다.** 현재 화면 경로(쿼리 제외)와 환경 요약만 붙는다.
 */
export const FEEDBACK_MAX = 1500;

const KINDS = ["장애·오류", "사용 문의", "기능 제안", "기타"] as const;

/** 분류마다 무엇을 적으면 좋은지 한 줄. 받는 쪽이 되물을 일을 줄인다. */
const PLACEHOLDER: Record<(typeof KINDS)[number], string> = {
  "장애·오류":
    "언제, 어떤 화면에서 무엇이 안 됐는지 적어 주세요. 오류 문구가 있으면 같이요.",
  "사용 문의":
    "궁금한 점을 적어 주세요. 어떤 기능인지 알려 주시면 더 정확히 답해요.",
  "기능 제안": "어떤 상황에서 무엇이 있으면 좋을지 적어 주세요.",
  기타: "하고 싶은 말을 편하게 적어 주세요.",
};
type Kind = (typeof KINDS)[number];

/** 보내는 글 전체. 본문 뒤에 어디서 썼는지만 덧붙인다 — 경로에 쿼리는 안 싣는다. */
export function composeFeedback(kind: Kind, message: string): string {
  const where = typeof window === "undefined" ? "" : window.location.pathname;
  const env = typeof navigator === "undefined" ? "" : navigator.userAgent;
  return `${message.trim()}\n\n---\n분류: ${kind}\n화면: ${where}\n환경: ${env}`;
}

export function mailtoFor(kind: Kind, message: string): string {
  const subject = encodeURIComponent(
    `[HeyMoa ${kind}] 서비스 ${kind === "장애·오류" ? "장애 제보" : kind}`
  );
  const body = encodeURIComponent(composeFeedback(kind, message));
  return `mailto:${siteConfig.contactEmail}?subject=${subject}&body=${body}`;
}

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error("복사하지 못했어요. 직접 선택해서 복사해 주세요.");
  }
}

export function FeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [kind, setKind] = useState<Kind>("사용 문의");
  const [message, setMessage] = useState("");
  const empty = message.trim().length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>문의·피드백 보내기</DialogTitle>
          <DialogDescription>
            불편했던 점, 궁금한 점, 바라는 점을 알려 주세요. 회의 내용은 함께
            보내지 않아요.
          </DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="분류" className="flex gap-1.5">
          {KINDS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={kind === value}
              onClick={() => setKind(value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                kind === value
                  ? "border-[var(--el-ink)] bg-[var(--el-ink)] text-[var(--el-on-primary)]"
                  : "border-[var(--el-hairline-strong)] text-[var(--el-muted)] hover:text-[var(--el-ink)]"
              )}
            >
              {value}
            </button>
          ))}
        </div>

        <div>
          <Textarea
            aria-label="내용"
            value={message}
            maxLength={FEEDBACK_MAX}
            rows={6}
            placeholder={PLACEHOLDER[kind]}
            onChange={(event) => setMessage(event.target.value)}
          />
          <p className="mt-1 text-right text-[11px] tabular-nums text-[var(--el-muted-soft)]">
            {message.length} / {FEEDBACK_MAX}
          </p>
        </div>

        <p className="text-xs leading-relaxed text-[var(--el-muted)]">
          현재 화면 경로와 사용 환경이 함께 담겨요. 앱에서는 메일 앱이 열리지
          않을 수 있어요. 그땐 「내용 복사」로 {siteConfig.contactEmail} 에 보내
          주세요.
        </p>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              void copy(siteConfig.contactEmail, "주소를 복사했어요")
            }
          >
            <Copy data-icon="inline-start" />
            주소 복사
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={empty}
              onClick={() =>
                void copy(composeFeedback(kind, message), "내용을 복사했어요")
              }
            >
              내용 복사
            </Button>
            <a
              href={empty ? undefined : mailtoFor(kind, message)}
              aria-disabled={empty || undefined}
              className={cn(
                buttonVariants(),
                empty && "pointer-events-none opacity-50"
              )}
              onClick={() => {
                if (!empty) onOpenChange(false);
              }}
            >
              <Mail data-icon="inline-start" />
              메일 앱으로 보내기
            </a>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
