# APP-116 알림 벨 구현 계획

**Goal:** 툴바 알림 벨 — 배지·드롭다운·PENDING 수락/거절·해결 라벨·409 Alert·읽음.

**Tech Stack:** Next.js 16, TanStack Query v5, orval, MSW, vitest, shadcn(DropdownMenu·Badge·Button·Skeleton).

## Global Constraints

- 알림 type은 WORKSPACE_INVITATION만. 렌더 분기는 `invitation.status`.
- 수락/거절 = `useAccept/DeclineWorkspaceInvitation.mutate({invitationId})`. 무효화: notifications(+수락 시 workspaces).
- 409 `INVITATION_NOT_PENDING` → 인라인 Alert. 벌크 읽음 없음(행 클릭 시 read).
- 검증: `pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e`.

---

### Task 1: 알림 벨 (`components/notification/notification-bell.tsx`)

**Files:** Create `components/notification/notification-bell.tsx`, `.test.tsx`.

**Consumes:** `useGetNotifications`, `useMarkNotificationRead`, `useAcceptWorkspaceInvitation`, `useDeclineWorkspaceInvitation`, query keys(notifications·workspaces).

- Bell + unreadCount Badge(0 숨김) + DropdownMenu.
- 항목: PENDING → 텍스트+역할+수락/거절+dot(readAt null), 그 외 → 상태 라벨.
- 수락/거절 onError 409 INVITATION_NOT_PENDING → 상단 Alert 상태. onSuccess → 무효화.
- 행 클릭 → markRead(미읽음일 때).
- 로딩 Skeleton, 실패 재시도, 빈 상태 문구.

- [ ] 테스트: 배지, PENDING 버튼+수락 mutate, 해결 라벨, 409 Alert, 행 클릭 read, 빈 상태.
- [ ] 구현.
- [ ] `pnpm test:run components/notification/notification-bell` 통과.
- [ ] Commit: `feat(app-116): 알림 벨 — 배지·초대 수락/거절·읽음`.

### Task 2: 툴바에 벨 (`workspace-toolbar.tsx`)

**Files:** Modify `components/workspace/workspace-toolbar.tsx` (+ test if exists).

- 툴바 우측(flex row 끝)에 `<NotificationBell />`.

- [ ] 테스트/렌더: 툴바에 벨 노출.
- [ ] 구현.
- [ ] Commit: `feat(app-116): 툴바에 알림 벨`.

### Task 3: 검증 + 브라우저

- [ ] 브라우저 실측: 벨·배지·PENDING 수락/거절·해결 라벨.
- [ ] 전체 검증 통과. Commit: `test(app-116): 알림 벨 확인`.

## Self-Review

- 스펙 커버: 벨·초대 분기·409·읽음(T1)·툴바(T2)·검증(T3).
