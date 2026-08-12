# APP-115 워크스페이스 연동 설정 UI 구현 계획

**Goal:** 설정 다이얼로그에 연동 섹션 — Linear/GitHub 연결·해제(ADMIN), MEMBER 열람.

**Tech Stack:** Next.js 16, TanStack Query v5, orval, MSW, vitest, shadcn(Card·Button·Badge·Alert).

## Global Constraints

- 역할 = members에서 `useAuth().user.userId`의 role. 로딩 중엔 버튼 없음.
- provider는 LINEAR·GITHUB만. 미연동도 목록에 온다.
- 연결 = `window.location.href = buildUrl(authorizePath)`. 해제 = `useDisconnectWorkspaceIntegration`.
- 검증: `pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e`.

---

### Task 1: 연동 설정 섹션 (`components/settings/workspace-integrations-settings.tsx`)

**Files:** Create `components/settings/workspace-integrations-settings.tsx`, `.test.tsx`.

**Consumes:** `useGetWorkspaceIntegrations`, `useDisconnectWorkspaceIntegration`, `useGetWorkspaceMembers`, `useAuth`, `buildUrl`.

- 두 provider 카드: connected → connectedBy·connectedAt + (ADMIN)해제, 아니면 "연결되지 않음" + (ADMIN)연결.
- ADMIN 판정: members에서 내 userId role === "ADMIN". 로딩 중/불명이면 버튼 없음.
- MEMBER면 하단 Alert "새 연동이 필요하면 ADMIN에게 요청하세요".

- [ ] 테스트: ADMIN 연결/해제 버튼 + disconnect 호출, MEMBER 버튼 없음 + Alert, connected 상태 렌더, 로딩 중 버튼 없음.
- [ ] 구현. connect는 window.location(테스트에서 목킹/무시).
- [ ] `pnpm test:run components/settings/workspace-integrations-settings` 통과.
- [ ] Commit: `feat(app-115): 연동 설정 섹션 — ADMIN 연결·해제, MEMBER 열람`.

### Task 2: 설정 다이얼로그에 연동 섹션 (`settings-dialog.tsx`)

**Files:** Modify `components/settings/settings-dialog.tsx`, `settings-dialog.test.tsx`.

- `SettingsSection` += "integrations". 나브 버튼(Plug 아이콘) + 섹션 렌더.

- [ ] 테스트: 연동 나브 클릭 → 연동 섹션 렌더.
- [ ] 구현.
- [ ] `pnpm test:run components/settings/settings-dialog` 통과.
- [ ] Commit: `feat(app-115): 설정 다이얼로그 연동 섹션`.

### Task 3: 검증 + 브라우저

- [ ] 브라우저 실측: ADMIN 연결 버튼 → authorize → mock-oauth → callback → 연결됨. 해제.
- [ ] 전체 검증 통과.
- [ ] Commit: `test(app-115): 연동 왕복 확인`.

## Self-Review

- 스펙 커버: 카드·분기·연결·해제(T1)·다이얼로그(T2)·검증(T3).
- 타입 일관: `SettingsSection` 확장(T2).
