"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ChatThread } from "@/components/chat/chat-thread";
import { ScrollToBottomButton } from "@/components/heymoa/scroll-to-bottom-button";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetNoteSharedChatMessages } from "@/lib/api/generated/note-shared-chat/note-shared-chat";
import {
  getGetNoteTranscriptQueryKey,
  useAssignNoteSpeaker,
  useGetNoteTranscript,
} from "@/lib/api/generated/transcription/transcription";
import { initialStreamState } from "@/lib/chat/stream-protocol";
import { TranscriptGapRow } from "@/components/notes/transcript-gap-row";
import {
  SpeakerAssignMenu,
  type SpeakerCandidate,
} from "@/components/notes/speaker-assign-menu";
import { toGapRows } from "@/lib/transcription/gaps";
import { createSpeakerIdentityResolver } from "@/lib/transcription/speaker-identity";
import {
  formatOffset,
  groupTranscriptSegments,
  interleaveTranscript,
} from "@/lib/transcription/presentation";
import {
  FOCUSED_TEXT_CLASS,
  useTranscriptFocus,
  type TranscriptFocus,
} from "@/components/notes/use-transcript-focus";
import { cn } from "@/lib/utils";

/** 바닥에서 이만큼 안쪽이면 "바닥"으로 본다. 스크롤 위치는 소수점으로 떨어진다. */
const BOTTOM_THRESHOLD_PX = 48;

/** 발화 길이는 고르지 않다 — 전부 같은 폭이면 표처럼 보여서 대화로 안 읽힌다. */
const TRANSCRIPT_SKELETON_WIDTHS = ["62%", "84%", "45%"];

/**
 * 바닥에서 멀어졌는지만 본다. **따라가지 않는다.**
 *
 * 챗봇의 `useStickToBottom`은 내용이 자라면 바닥으로 붙이는데, 아카이브는 새 내용이 쌓이는
 * 면이 아니라 다 끝난 기록을 위에서부터 읽는 면이다. 그걸 그대로 쓰면 열자마자 맨 끝으로
 * 튄다. 전사 뷰의 엔진도 라이브 판정·프로그램 스크롤 가드가 붙어 있어 여기엔 과하다.
 */
function useAwayFromBottom() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [away, setAway] = useState(false);

  const sync = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setAway(
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight >
        BOTTOM_THRESHOLD_PX
    );
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // scroll 이벤트는 버블링하지 않아 부모에 onScroll을 걸 수 없다.
    viewport.addEventListener("scroll", sync, { passive: true });
    sync();

    // **높이 변화는 scroll 이벤트를 내지 않는다.** 두 쿼리(`refetchOnMount: "always"`)가
    // 늦게 도착하면 스크롤 없이도 바닥이 멀어지는데, 그때 다시 재지 않으면 버튼이 안 뜬다.
    // 블록·메시지 개수를 키로 쓰는 방법도 있지만 개수가 같고 문장만 길어지는 갱신을 놓친다.
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(sync);
    observer?.observe(viewport);
    if (viewport.firstElementChild) {
      observer?.observe(viewport.firstElementChild);
    }

    return () => {
      viewport.removeEventListener("scroll", sync);
      observer?.disconnect();
    };
  }, [sync]);

  const scrollToBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // 즉시 이동이다. smooth는 애니메이션 중 scroll 이벤트가 "아직 바닥이 아니다"로 읽혀
    // 버튼이 깜빡인다(APP-227에서 밟았다).
    viewport.scrollTop = viewport.scrollHeight;
    sync();
  }, [sync]);

  return { viewportRef, away, scrollToBottom };
}

/**
 * 종료된 회의의 아카이브. 전사 타임라인과 "회의 중 챗봇 대화"(공유 Q&A)를 **세그먼트로 갈라**
 * 한 번에 하나만 보여준다.
 *
 * 예전에는 전사 아래에 Q&A를 이어 붙였다. 하나로 섞지 못한 이유는 지금도 같다 —
 * 전사 세그먼트는 세션 상대 ms만 갖고 Q&A는 절대 `createdAt`이라 **공통 시간축이 계약에 없다.**
 * 다만 이어 붙이면 전사가 긴 회의에서 Q&A가 접힌 화면 밖으로 밀려 있는 줄도 모르고 지나갔다.
 * 섞을 수 없으면 나란히 두지 말고 가른다.
 *
 * `ponytail:` 전사 응답에 세션 벽시계 시작이 생기면 `sessionStart + startedAtMs`로 하나의
 * 타임라인에 인터리브해 올린다 — 그때는 이 세그먼트가 필요 없어진다.
 */
export function NoteArchive({
  noteId,
  participants = [],
  canAssignSpeaker = false,
  focusSegmentId,
  onFocusHandled,
}: {
  noteId: string;
  participants?: SpeakerCandidate[];
  /** 참석자만 화자를 바꾼다. 아니면 읽기 전용 — 숨기지는 않는다. */
  canAssignSpeaker?: boolean;
} & TranscriptFocus) {
  // 종료 직후 마운트다 — 전역 staleTime(60초)을 그대로 두면 방금 전 라이브 캐시를 재사용해
  // 마지막 전사·Q&A가 빠질 수 있다. 마운트할 때 최종 상태를 다시 당긴다.
  const transcriptQuery = useGetNoteTranscript(noteId, {
    query: { refetchOnMount: "always" },
  });
  const chatQuery = useGetNoteSharedChatMessages(noteId, {
    query: { refetchOnMount: "always" },
  });

  const transcript =
    transcriptQuery.data?.status === 200 && transcriptQuery.data.data.success
      ? transcriptQuery.data.data.data
      : null;
  const segments = useMemo(
    () => transcript?.segments ?? [],
    [transcript]
  );
  const blocks = useMemo(
    () => groupTranscriptSegments([...segments]),
    [segments]
  );
  // 종료된 회의를 여는 자리가 여기다. 공백과 화자를 `TranscriptView`에만 넣으면
  // 정작 볼 사람이 못 본다.
  const rows = useMemo(
    () => interleaveTranscript(blocks, toGapRows(transcript?.gaps ?? [])),
    [blocks, transcript]
  );
  const speakerOf = useMemo(
    () =>
      createSpeakerIdentityResolver(
        transcript?.diarization?.status === "MAPPED"
          ? transcript.diarization.speakers
          : []
      ),
    [transcript]
  );
  const truncated = transcript?.recording?.seal === "TRUNCATED";

  const queryClient = useQueryClient();
  // 응답이 화자 목록 **전체**다 — 한 명을 연결하면 다른 화자에게서 그 사람이 떨어지므로
  // 부분 갱신으로는 화면이 안 맞는다. 그래서 캐시를 통째로 갈아 끼운다.
  const assign = useAssignNoteSpeaker({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: getGetNoteTranscriptQueryKey(noteId),
        }),
    },
  });

  const messages =
    chatQuery.data?.status === 200 && chatQuery.data.data.success
      ? (chatQuery.data.data.data.messages ?? [])
      : [];
  const chatFailed =
    chatQuery.isError ||
    (chatQuery.data !== undefined &&
      !(chatQuery.data.status === 200 && chatQuery.data.data.success));

  const { viewportRef, away, scrollToBottom } = useAwayFromBottom();
  const { blockRef, isHighlighted } = useTranscriptFocus(blocks, {
    focusSegmentId,
    onFocusHandled,
  });

  return (
    <ScrollArea
      className="h-full"
      viewportRef={viewportRef}
      overlay={
        away ? (
          <ScrollToBottomButton
            label="맨 아래로"
            onClick={scrollToBottom}
            // desktop에서는 레코더 독이 하단 중앙에 떠 있어 그 위로 올린다.
            className="lg:bottom-20"
          />
        ) : null
      }
    >
      <div
        data-testid="note-archive-content"
        className="mx-auto w-full max-w-[calc(820px+2*var(--note-gutter))] px-[var(--note-gutter)] pb-7 pt-5 sm:pb-9 lg:pb-28"
      >
        <Tabs defaultValue="transcript">
          <TabsList variant="line" className="gap-6">
            <TabsTrigger value="transcript">대화 기록</TabsTrigger>
            <TabsTrigger value="chat">회의 중 챗봇</TabsTrigger>
          </TabsList>

          <TabsContent value="transcript" aria-label="회의 전사 아카이브">
            {transcriptQuery.isPending ? (
              /* **실제 행과 같은 격자·같은 여백이다.** 예전에는 `mt-6`에 `h-24`/`h-28` 막대
                 둘이라 248이었고 실제는 288이었다 — 첫 줄이 12px 아래에서 시작했고 행
                 경계도 없어 도착하는 순간 모양이 통째로 바뀌었다. */
              <div className="mt-3" aria-label="대화 기록 불러오는 중">
                {[0, 1, 2].map((row) => (
                  <div
                    key={row}
                    className="grid grid-cols-[58px_1fr] gap-4 border-b border-[var(--el-hairline)] py-5 sm:grid-cols-[66px_1fr] sm:gap-6"
                  >
                    <Skeleton className="mt-1 h-3 w-10 rounded-chip" />
                    {/* 실제 발화는 15px·leading-7이라 한 줄이 28이다 — 막대는 그 줄 안에 놓는다.
                        막대 높이만 맞추면(16) 행이 12px 낮아진다. */}
                    <div className="flex h-7 items-center">
                      <Skeleton
                        className="h-4 rounded-chip"
                        style={{ width: TRANSCRIPT_SKELETON_WIDTHS[row] }}
                      />
                    </div>
                  </div>
                ))}
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
                {rows.map((row) =>
                  row.type === "gap" ? (
                    <TranscriptGapRow key={row.gap.gapId} row={row.gap} />
                  ) : (
                    <article
                      key={row.block.blockId}
                      ref={blockRef(row.block.blockId)}
                      data-testid="archive-transcript-block"
                      data-focused={
                        isHighlighted(row.block.blockId) || undefined
                      }
                      className="grid grid-cols-[58px_1fr] gap-4 border-b border-[var(--el-hairline)] py-5 sm:grid-cols-[66px_1fr] sm:gap-6"
                    >
                      <time className="pt-1 font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)]">
                        {formatOffset(row.block.startedAtMs)}
                      </time>
                      <div className="max-w-3xl">
                        {speakerOf(row.block.speakerLabel) ? (
                          <SpeakerAssignMenu
                            identity={speakerOf(row.block.speakerLabel)!}
                            candidates={participants}
                            disabled={!canAssignSpeaker}
                            onAssign={(userId) =>
                              assign.mutate({
                                noteId,
                                label: row.block.speakerLabel!,
                                data: { userId },
                              })
                            }
                          />
                        ) : null}
                        <p className="text-[15px] leading-7 text-[var(--el-ink)]">
                          <span
                            className={cn(
                              isHighlighted(row.block.blockId) &&
                                FOCUSED_TEXT_CLASS
                            )}
                          >
                            {row.block.text}
                          </span>
                        </p>
                      </div>
                    </article>
                  )
                )}
                {truncated ? (
                  <p
                    data-testid="recording-truncated"
                    className="py-4 text-sm text-[var(--el-muted)]"
                  >
                    기록이 끝까지 저장되지 못했습니다.
                  </p>
                ) : null}
                {!rows.length ? (
                  <p className="py-8 text-sm text-[var(--el-muted)]">
                    전사된 대화가 없습니다.
                  </p>
                ) : null}
              </div>
            )}
          </TabsContent>

          {/* 탭은 대화가 없어도 남긴다 — 나타났다 사라지면 같은 자리인지 알기 어렵다. */}
          <TabsContent value="chat" aria-label="회의 중 챗봇 대화">
            <div className="mt-6">
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
              ) : messages.length ? (
                // 읽기 전용 아카이브 — 스트림·승인 없이 히스토리만 그린다.
                <ChatThread
                  messages={messages}
                  stream={initialStreamState}
                  pendingUserMessage={null}
                  onRetry={() => {}}
                  onApprove={() => {}}
                />
              ) : (
                <p className="py-8 text-sm text-[var(--el-muted)]">
                  회의 중 챗봇에 물어본 내용이 없습니다.
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}
