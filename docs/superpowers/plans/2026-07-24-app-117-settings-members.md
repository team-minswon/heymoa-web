# APP-117 설정 멤버 탭 구현 계획

**Goal:** 설정에 멤버 섹션 — 목록·(ADMIN)초대 폼·대기 초대·취소, 초대 실패 인라인.

**Tech Stack:** Next.js 16, TanStack Query v5, orval, MSW, vitest, shadcn(Select·Input·Badge·Skeleton·Alert).

## Global Constraints

- 역할 판별: `useGetWorkspaceMembers`에서 `useAuth().user.userId`의 role. ADMIN만 폼·취소.
  역할 로딩·실패 중엔 폼·취소 없음.
- 대기 초대 = `GET .../invitations`(서버 PENDING-only, status 필드 없음) 그대로.
- 초대 생성 `useCreateWorkspaceInvitation.mutate({workspaceId, data:{email, role}})`,
  취소 `useCancelWorkspaceInvitation.mutate({workspaceId, invitationId})`.
- 초대 실패 인라인(`suppressErrorToast`) + `errorMessageOf`. 404 `INVITEE_NOT_FOUND`만
  `errorCodeOf` 분기로 "철자와 대소문자를 확인해 주세요." 덧붙임.
- 성공 → invitations 무효화(`getGetWorkspaceInvitationsQueryKey`) + 폼 리셋. members는 안 함.
- 검증: `pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e`.

---

### Task 1: mock 초대 봉투·404 정합성 (`rest-handlers.ts`, `db.ts`)

**Files:** Modify `lib/mocks/rest-handlers.ts`, `lib/mocks/db.ts`, test `lib/mocks/rest-handlers.test.ts`(있으면).

- `INVITATION_NOT_FOUND_CODES`에 `"INVITEE_NOT_FOUND"` 추가(404).
- 초대 에러 코드→openapi3.yml 문구 맵을 `invitationResult`에 적용:
  - `ALREADY_WORKSPACE_MEMBER` → "이미 워크스페이스 멤버입니다."
  - `DUPLICATE_PENDING_INVITATION` → "이미 대기 중인 초대가 있습니다."
  - `INVITEE_NOT_FOUND` → "초대할 사용자를 찾을 수 없습니다."
  - 맵에 없으면 code를 message로(기존 동작).
- `db.ts` `createInvitation`: 멤버 중복 검사 전에 **대문자 섞인 이메일이면
  `fail("INVITEE_NOT_FOUND")`** (`ponytail:` 대문자 휴리스틱 — 서버 비정규화 quirk 재현).

- [ ] 구현.
- [ ] `pnpm test:run lib/mocks` 통과(있으면), 없으면 typecheck.
- [ ] Commit: `fix(app-117): mock 초대 에러 봉투 한국어 메시지 + 대문자 404`.

### Task 2: 멤버 설정 컴포넌트 (`members-settings.tsx`)

**Files:** Create `components/settings/members-settings.tsx`, `.test.tsx`.

**Consumes:** `useGetWorkspaceMembers`, `useGetWorkspaceInvitations`,
`useCreateWorkspaceInvitation`, `useCancelWorkspaceInvitation`, `getGetWorkspaceInvitationsQueryKey`,
`useAuth`, `errorMessageOf`/`errorCodeOf`.

- 헤더(멤버) + 멤버 목록(이름·이메일·RoleChip·joinedAt, 내 항목 "나").
- ADMIN이면 초대 폼: Input(email, type=email) + Select(MEMBER/ADMIN, 기본 MEMBER) + 초대 버튼.
  - submit → create.mutate({workspaceId, data:{email, role}}), onSuccess: invitations 무효화 +
    폼 리셋 + 에러 클리어. onError: `setInviteError(error)` (인라인).
  - 인라인: `inviteError` 있으면 Input 테두리 destructive + Alert(errorMessageOf(+404 힌트)).
  - create 훅에 `meta.suppressErrorToast: true`.
- ADMIN이면 대기 초대 목록: inviteeName+inviteeEmail, RoleChip, `inviterName · createdAt`, 취소 버튼.
  - 취소 → cancel.mutate({workspaceId, invitationId}), 훅 onSuccess invitations 무효화.
  - 취소 중 모든 취소 버튼 disabled(cancel.isPending).
  - 없으면 "대기 중인 초대가 없습니다".
- 로딩 Skeleton, members 실패 인라인 오류+재시도.
- 역할 로딩·실패 중엔 폼·대기 목록 안 그림.

- [ ] 테스트: 목록 렌더, ADMIN 폼 표시/MEMBER 숨김, 초대 mutate+무효화, 409 인라인,
  404 인라인+힌트, 취소 mutate.
- [ ] 구현.
- [ ] `pnpm test:run components/settings/members-settings` 통과.
- [ ] Commit: `feat(app-117): 멤버 설정 — 목록·초대·대기·취소`.

### Task 3: 다이얼로그에 멤버 섹션 (`settings-dialog.tsx`)

**Files:** Modify `components/settings/settings-dialog.tsx` (+ test).

- `SettingsSection`에 `"members"` 추가, 나브 버튼(Users 아이콘, "멤버"), 워크스페이스 일반 아래.
- 섹션 렌더 분기에 `<MembersSettings workspaceId={workspaceId} />`.

- [ ] 테스트/렌더: 멤버 나브·섹션 노출.
- [ ] 구현.
- [ ] Commit: `feat(app-117): 설정에 멤버 섹션`.

### Task 4: 검증 + 브라우저

- [ ] 브라우저 실측: 멤버 목록·초대 성공(대기 목록 추가)·409(이미 멤버)·404(대문자)·취소.
- [ ] 전체 검증 통과. Commit: `test(app-117): 멤버 설정 확인`.

## Self-Review

- 스펙 커버: mock 정합성(T1)·멤버/초대/대기/취소(T2)·다이얼로그(T3)·검증(T4).
- 타입: create `{workspaceId, data:{email, role}}`, cancel `{workspaceId, invitationId}` — 생성 훅과 일치.
