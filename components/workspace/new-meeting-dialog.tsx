"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * 「새 회의」의 생성 단계.
 *
 * **만들기와 시작은 별개다.** 예전에는 제목도 안 묻고 `"실시간 기록 노트"`로 만들어 곧장
 * 전사 화면으로 보냈고, 그래서 만들자마자 기록해야 하는 화면처럼 읽혔다. 여기서 이름을 짓고,
 * 기록은 노트 안에서 「회의 시작」을 눌러야 시작된다.
 *
 * 입력을 controlled로 둔 이유가 둘이다. 함수형 form action은 완료되면 비제어 입력을 비우는데,
 * **실패했을 때 사용자가 쓴 이름이 사라지면 안 된다.** 그리고 React 19는 거절된 action을 오류
 * 경계로 올리므로 실패를 action 안에서 삼켜야 하는데, 삼키면 action이 성공으로 끝나 또 비워진다.
 * 값을 우리가 들고 있으면 둘 다 걸리지 않는다.
 */
export function NewMeetingDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 실제로 만들어졌으면 true. 그때만 입력을 비운다. */
  onSubmit: (title: string) => Promise<boolean>;
  isPending: boolean;
}) {
  const [title, setTitle] = useState("");
  const trimmed = title.trim();

  const close = () => {
    setTitle("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && !next && close()}>
      {open && (
        <DialogContent
          aria-label="새 회의 만들기"
          // 처리 중에는 X를 안 그린다 — onOpenChange가 닫기를 무시하므로, 두면 눌러도
          // 아무 일이 없어 고장으로 읽힌다.
          showCloseButton={!isPending}
        >
          <form
            action={async () => {
              if (!trimmed) return;
              // 성공했을 때만 비운다. 부모는 닫기만 하므로 여기서 안 비우면 다음에 열었을 때
              // 지난 회의 이름이 그대로 남는다.
              //
              // 실패는 전역 `MutationCache`가 토스트로 알린다. 여기서 안 삼키면 React가
              // 거절을 오류 경계로 올려 워크스페이스 전체가 오류 화면이 된다.
              const created = await onSubmit(trimmed).catch(() => false);
              if (created) setTitle("");
            }}
          >
            <DialogHeader>
              <DialogTitle>새 회의 만들기</DialogTitle>
              <DialogDescription>
                이름을 지어 두면 나중에 찾기 쉽습니다. 기록은 만든 뒤에
                시작합니다.
              </DialogDescription>
            </DialogHeader>
            <div className="py-5">
              <Label htmlFor="meeting-title">회의 이름</Label>
              <Input
                id="meeting-title"
                name="title"
                className="mt-2"
                placeholder="주간 제품 회의"
                // 서버 계약이 1~200자다.
                maxLength={200}
                required
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={close}
              >
                취소
              </Button>
              <Button type="submit" loading={isPending} disabled={!trimmed}>
                만들기
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
