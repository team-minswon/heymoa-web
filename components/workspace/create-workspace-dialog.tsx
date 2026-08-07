"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getGetWorkspacesQueryKey,
  useCreateWorkspace,
} from "@/lib/api/generated/workspaces/workspaces";

/**
 * 새 워크스페이스 만들기. **여는 자리가 둘이라 컴포넌트로 산다.**
 *
 * 원래 이 폼은 `workspace-sidebar.tsx`의 드롭다운 안에 인라인으로 있었고, 그 사이드바는
 * `/w/[workspaceId]` 아래에서만 그려진다. 워크스페이스가 하나도 없는 사람은 그 라우트에
 * 들어갈 수 없어서 **만드는 입구 자체가 없었다**(APP-402). 이제 랜딩(`landing-cta.tsx`)도
 * 같은 폼을 연다.
 *
 * **제어형 하나만 낸다.** 트리거를 children으로 받는 편이 랜딩에는 편하지만, 사이드바는
 * 드롭다운 항목이 열어야 해서 트리거를 이 안에 둘 수 없다. 두 API를 다 지원하면 여는 방법이
 * 둘로 갈리고, 그러면 「어느 쪽이 정본인가」가 매번 질문이 된다.
 */
export function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  // **무효화와 이동을 mutation 안에 둔다.** action 쪽에 두면 POST가 끝나는 순간
  // `isPending`이 false로 떨어지고, 남은 목록 재조회 동안 만들기·취소·X가 다시 열린다 —
  // 한 번 더 누르면 워크스페이스가 둘 생긴다. TanStack은 `onSuccess`가 돌려준 프라미스를
  // 기다린 뒤에야 mutation을 끝내므로 `isPending`이 그 구간까지 덮는다.
  //
  // **자체 `createWorkspace.isPending` state로는 못 막는다.** React 19는 form action을 트랜지션으로 감싸고,
  // 그 안의 `useState` 갱신은 action이 끝나야 반영된다 — 잠그려는 바로 그 구간에 안 걸린다.
  const createWorkspace = useCreateWorkspace({
    mutation: {
      onSuccess: async (response) => {
        if (response.status !== 201 || !response.data.success) return;
        await queryClient.invalidateQueries({
          queryKey: getGetWorkspacesQueryKey(),
        });
        onOpenChange(false);
        router.push(`/w/${response.data.data.workspaceId}`);
      },
    },
  });
  // **이름을 state로 든다.** React 19는 action이 끝나면 uncontrolled 폼을 리셋하므로,
  // formData로만 읽으면 실패했을 때 방금 친 이름이 사라져 다시 타이핑하게 된다.
  const [name, setName] = useState("");

  /**
   * **초기화를 `open` 하나에 묶는다.** `name`을 state로 든 뒤로는 언마운트가 비워 주지 않아
   * 취소한 이름이 다음에 열 때 그대로 뜬다. 닫는 경로가 다섯이라(Escape · 바깥 클릭 · X ·
   * 「취소」 · **부모가 직접 `open`을 false로**) 콜백마다 비우면 마지막 하나를 빠뜨린다 —
   * 사이드바는 노트 전체 화면이 열리면 자기 다이얼로그를 그렇게 닫는다.
   *
   * effect가 아니라 렌더 중에 맞춘다. `useEffect`로 쓰면 lint가 막고(cascading renders),
   * 한 프레임 늦게 비워져 닫히는 순간이 화면에 비친다.
   */
  const [lastOpen, setLastOpen] = useState(open);
  if (lastOpen !== open) {
    setLastOpen(open);
    if (!open) setName("");
  }

  /**
   * 요청 중에는 닫지 않는다. 창만 사라지면 취소한 줄 알지만 요청은 계속 가고, 뒤늦게
   * 성공하면 갑자기 새 워크스페이스로 튕긴다.
   */
  const setOpen = (next: boolean) => {
    if (createWorkspace.isPending) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* 요청 중에는 X도 감춘다 — 눌러도 위 가드가 무시하므로, 보이는 채로 두면 반응 없는
          컨트롤이 된다. */}
      <DialogContent
        aria-label="새 워크스페이스 만들기"
        showCloseButton={!createWorkspace.isPending}
      >
        <form
          action={async () => {
            const trimmed = name.trim();
            if (!trimmed) return;
            // **거절을 여기서 삼킨다.** React 19는 거절된 form action을 가장 가까운 오류
            // 경계로 올리는데, 워크스페이스 0개인 사람에게는 이것이 유일한 생성 흐름이라
            // 이름 400 하나에 랜딩이 통째로 오류 화면이 된다. 실패 알림은 전역
            // MutationCache.onError가 이미 맡는다.
            await createWorkspace
              .mutateAsync({ data: { name: trimmed, description: null } })
              .catch(() => null);
          }}
        >
          <DialogHeader>
            <DialogTitle>새 워크스페이스</DialogTitle>
            <DialogDescription>
              회의 기록을 모을 공간의 이름을 정해 주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="py-5">
            <Label htmlFor="new-workspace-name">워크스페이스 이름</Label>
            <Input
              id="new-workspace-name"
              name="name"
              className="mt-2"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={80}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={createWorkspace.isPending}
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button type="submit" loading={createWorkspace.isPending} disabled={createWorkspace.isPending}>
              만들기
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
