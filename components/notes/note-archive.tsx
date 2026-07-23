"use client";

import { useMemo } from "react";

import { ChatThread } from "@/components/chat/chat-thread";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetNoteSharedChatMessages } from "@/lib/api/generated/note-shared-chat/note-shared-chat";
import { useGetNoteTranscript } from "@/lib/api/generated/transcription/transcription";
import { initialStreamState } from "@/lib/chat/stream-protocol";
import { groupTranscriptSegments } from "@/lib/transcription/presentation";

function formatOffset(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60
  ).padStart(2, "0")}`;
}

/**
 * 종료된 회의의 아카이브. 좌측에 전사 타임라인과 "회의 중 챗봇 대화"(공유 Q&A)를 함께 둔다.
 *
 * `ponytail:` 전사 세그먼트는 세션 상대 ms만 갖고 Q&A는 절대 createdAt이라 공통 시간축이
 * 계약에 없다 — 정밀 인터리브 대신 전사 아래에 Q&A 섹션을 붙인다. 전사 응답에 세션 벽시계
 * 시작이 생기면 sessionStart + startedAtMs로 인터리브로 올린다.
 */
export function NoteArchive({ noteId }: { noteId: string }) {
  // 종료 직후 마운트다 — 전역 staleTime(60초)을 그대로 두면 방금 전 라이브 캐시를 재사용해
  // 마지막 전사·Q&A가 빠질 수 있다. 마운트할 때 최종 상태를 다시 당긴다.
  const transcriptQuery = useGetNoteTranscript(noteId, {
    query: { refetchOnMount: "always" },
  });
  const chatQuery = useGetNoteSharedChatMessages(noteId, {
    query: { refetchOnMount: "always" },
  });

  const segments = useMemo(
    () =>
      transcriptQuery.data?.status === 200 && transcriptQuery.data.data.success
        ? (transcriptQuery.data.data.data.segments ?? [])
        : [],
    [transcriptQuery.data]
  );
  const blocks = useMemo(() => groupTranscriptSegments([...segments]), [segments]);

  const messages =
    chatQuery.data?.status === 200 && chatQuery.data.data.success
      ? (chatQuery.data.data.data.messages ?? [])
      : [];
  const chatFailed =
    chatQuery.isError ||
    (chatQuery.data !== undefined &&
      !(chatQuery.data.status === 200 && chatQuery.data.data.success));

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto w-full max-w-[820px] px-5 pb-28 pt-7 sm:px-9 sm:pt-9">
        <section aria-label="회의 전사 아카이브">
          <header className="border-b border-[var(--el-hairline-strong)] pb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--el-muted)]">
              Archive
            </p>
            <h2 className="mt-2 font-serif text-2xl font-light tracking-[-0.025em] text-[var(--el-ink)]">
              대화 기록
            </h2>
          </header>

          {transcriptQuery.isPending ? (
            <div className="mt-6 space-y-4" aria-label="대화 기록 불러오는 중">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>
          ) : transcriptQuery.isError ? (
            // 실패를 "없음"으로 위장하지 않는다 — 아카이브가 TranscriptView의 재시도 경로를
            // 대체하므로 그 실패 피드백을 여기서 되살린다.
            <div role="alert" className="mt-6 space-y-2">
              <p className="text-sm text-[var(--el-ink)]">
                전사를 불러오지 못했습니다.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-[30px]"
                onClick={() => void transcriptQuery.refetch()}
              >
                다시 시도
              </Button>
            </div>
          ) : (
            <div className="mt-3">
              {blocks.map((block) => (
                <article
                  key={block.blockId}
                  data-testid="archive-transcript-block"
                  className="grid grid-cols-[58px_1fr] gap-4 border-b border-[var(--el-hairline)] py-5 sm:grid-cols-[66px_1fr] sm:gap-6"
                >
                  <time className="pt-1 font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)]">
                    {formatOffset(block.timelineStartedAtMs)}
                  </time>
                  <p className="max-w-3xl text-[15px] leading-7 text-[var(--el-ink)]">
                    {block.text}
                  </p>
                </article>
              ))}
              {!blocks.length ? (
                <p className="py-8 text-sm text-[var(--el-muted)]">
                  전사된 대화가 없습니다.
                </p>
              ) : null}
            </div>
          )}
        </section>

        {messages.length || chatFailed ? (
          <section aria-label="회의 중 챗봇 대화" className="mt-10">
            <header className="border-b border-[var(--el-hairline-strong)] pb-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--el-muted)]">
                Q&amp;A
              </p>
              <h2 className="mt-1.5 font-serif text-xl font-light tracking-[-0.025em] text-[var(--el-ink)]">
                회의 중 챗봇 대화
              </h2>
            </header>
            <div className="mt-4">
              {chatFailed ? (
                // 실패를 빈 섹션으로 삼키지 않는다 — 전사와 같은 재시도 경로를 준다.
                <div role="alert" className="space-y-2">
                  <p className="text-sm text-[var(--el-muted)]">
                    챗봇 대화를 불러오지 못했습니다.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-[30px]"
                    onClick={() => void chatQuery.refetch()}
                  >
                    다시 시도
                  </Button>
                </div>
              ) : (
                // 읽기 전용 아카이브 — 스트림·승인 없이 히스토리만 그린다.
                <ChatThread
                  messages={messages}
                  stream={initialStreamState}
                  pendingUserMessage={null}
                  onRetry={() => {}}
                  onApprove={() => {}}
                />
              )}
            </div>
          </section>
        ) : null}
      </div>
    </ScrollArea>
  );
}
