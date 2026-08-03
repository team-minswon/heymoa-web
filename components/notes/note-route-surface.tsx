"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type NoteViewMode = "side" | "full";

export function NoteRouteSurface({
  view,
  isOpen,
  onClose,
  children,
}: {
  view: NoteViewMode;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (view === "side") {
    // 시트 기하는 design.pen `u3yYCX`가 정본이다 — 뷰포트 1440×900에서 `w-860 · left-572 ·
    // top-8 · h-884`, 즉 오른쪽·위·아래 8px. 테두리는 셸과 같은 hairline을 쓴다(예전에는
    // `black/5`라 캔버스 위 다른 패널들과 선 색이 갈렸다).
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          aria-label="노트"
          data-surface="sheet"
          showCloseButton={false}
          className="inset-0 h-dvh w-full max-w-none gap-0 overflow-hidden rounded-none border-0 bg-white p-0 shadow-e3 sm:max-w-none md:inset-y-2 md:left-auto md:right-2 md:h-[calc(100dvh-1rem)] md:w-[min(860px,calc(100vw-15rem))] md:max-w-[860px] md:rounded-panel md:border md:border-[var(--el-hairline)]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>노트</SheetTitle>
            <SheetDescription>선택한 회의 노트 상세</SheetDescription>
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    // 전체 화면은 셸 패널을 통째로 덮는다 — 자기 상단바(← · 축소 · 제목)가 워크스페이스
    // 상단바를 대신하므로 `top-16`으로 아래에 눕히지 않는다. 셸 껍데기는 이 면이 있으면
    // 자기 테두리·radius를 내려놓고(`has-[[data-surface=full]]`), 여기서 패널 둘을 그린다.
    //
    // 셸 컨테이너가 뷰포트 높이에 못박혀 있어(APP-252) `inset-0`이 곧 화면 몫이다.
    // 전체 화면은 **뷰포트를 통째로** 쓴다 — 사이드바도 워크스페이스 상단바도 덮는다
    // (design.pen `XtEMZ`: 1420 = 1440 − 좌우 10, 사이드바 없음). 노트가 자기 상단바를
    // 갖기 때문에 워크스페이스 크롬이 남아 있을 이유가 없다.
    //
    // 그래서 `absolute`(셸 패널 기준)가 아니라 `fixed`(뷰포트 기준)다. z는 사이드바(10)와
    // 워크스페이스 상단바(20) 위, 다이얼로그·시트(50) 아래다 — 노트 안에서 여는 삭제
    // 확인창이 이 면에 가리면 안 된다.
    //
    // 여기서 `flex`를 주지 않는다 — 두 컬럼의 배치는 `note-panel`의 루트가 갖고 있고,
    // 이 면까지 flex 컨테이너가 되면 그 루트가 **flex 아이템이 되어 내용 폭으로 줄어든다**
    // (본문이 450px로 쪼그라들었다).
    // 들어올 때만 오른쪽에서 자란다(`origin-right` + `starting:`). side 시트가 화면 오른쪽에
    // 있으니 그쪽에서 펼쳐지는 것으로 읽힌다 — 두 면이 실제로 같은 요소는 아니라서 morph는
    // 하지 않는다. 시트와 전체 면은 컴포넌트도 마운트 시점도 달라서, 잇는 값을 하나로 만들려면
    // 노트 본문까지 한 트리에 묶어야 하고 그건 스트림을 끊는 재마운트를 부른다.
    //
    // **나갈 때(full → side)는 애니메이션이 없다.** 이 면은 즉시 언마운트되고 시트가 오른쪽에서
    // 밀려 들어와 그 자리를 덮는다.
    <div
      data-surface="full"
      className="fixed inset-0 z-30 min-h-0 origin-right overflow-hidden bg-[var(--el-canvas)] p-2.5 transition-[opacity,scale] duration-200 ease-out starting:scale-[0.98] starting:opacity-0 motion-reduce:transition-none"
    >
      {children}
    </div>
  );
}
