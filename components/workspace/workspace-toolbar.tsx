"use client";

import { useRouter } from "next/navigation";
import { CircleStop, ExternalLink, Mic, Pause, Play, Plus } from "lucide-react";

import { useRecording } from "@/components/transcription/recording-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useCreateNote } from "@/lib/api/generated/note/note";

function formatElapsed(elapsedMs: number) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function WorkspaceToolbar({
  workspaceId,
  currentLabel,
  language,
  onLanguageChange,
  activeNoteId,
}: {
  workspaceId: string;
  currentLabel: string;
  language: string;
  onLanguageChange: (language: string) => void;
  activeNoteId?: string;
}) {
  const router = useRouter();
  const createNote = useCreateNote();
  const { session, elapsedMs, error, start, pause, resume, stop } =
    useRecording();
  const isActive =
    session &&
    ["CONNECTING", "STREAMING", "PAUSED", "FINALIZING"].includes(
      session.status
    );
  const paused = session?.status === "PAUSED";

  const openNote = (noteId: string) =>
    router.push(`/w/${workspaceId}/notes/${noteId}?view=side&tab=transcript`);

  const handleStart = async () => {
    let noteId = activeNoteId;
    if (!noteId) {
      const response = await createNote.mutateAsync({ workspaceId, data: {} });
      if (
        response.status !== 200 ||
        !response.data.success ||
        !response.data.data
      )
        return;
      noteId = response.data.data.noteId;
    }
    openNote(noteId);
    await start(noteId, language === "auto" ? null : language);
  };

  return (
    <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <SidebarTrigger className="md:hidden" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">Workspace</p>
          <h1 className="truncate text-base font-semibold">{currentLabel}</h1>
        </div>

        {isActive ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => openNote(session.noteId)}
              className="hidden sm:inline-flex"
            >
              <ExternalLink /> 현재 녹음
            </Button>
            <Badge variant={paused ? "secondary" : "default"}>
              {paused ? "Paused" : "Recording"}
            </Badge>
            <span className="font-mono text-sm tabular-nums">
              {formatElapsed(elapsedMs)}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={paused ? "녹음 재개" : "녹음 일시 정지"}
              onClick={() => void (paused ? resume() : pause())}
            >
              {paused ? <Play /> : <Pause />}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="icon-sm"
              aria-label="녹음 종료"
              onClick={() => void stop()}
            >
              <CircleStop />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Select
              value={language}
              onValueChange={(value) => value && onLanguageChange(value)}
            >
              <SelectTrigger aria-label="기록 언어" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ko">한국어</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="auto">자동 감지</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              onClick={() => void handleStart()}
              loading={createNote.isPending}
              aria-label="실시간 기록 시작"
            >
              <Mic />
              <span className="hidden sm:inline">실시간 기록 시작</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="새 노트"
              onClick={async () => {
                const response = await createNote.mutateAsync({
                  workspaceId,
                  data: {},
                });
                if (
                  response.status === 200 &&
                  response.data.success &&
                  response.data.data
                ) {
                  openNote(response.data.data.noteId);
                }
              }}
            >
              <Plus />
            </Button>
          </div>
        )}
      </div>
      {error ? (
        <Alert variant="destructive" className="mx-4 mb-3 sm:mx-6 lg:mx-8">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
