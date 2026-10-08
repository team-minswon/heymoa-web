# APP-941 워크스페이스 외부 에이전트 관리 화면과 막힘 표시 — 구현 순서

- 이슈: [APP-941](https://linear.app/minswon/issue/APP-941)
- spec: docs `origin/main:projects/PRO-54-외부-에이전트-연결/spec/APP-941/spec.md` @ `226b252`
- 프로젝트 브랜치: `pro-54/외부-에이전트-연결` ← `dev` (web 원격에 없음 — 메인 트리 `dev` 를 `origin/dev` `0a7f8a7` 로 당긴 뒤 새로 만든다. 지금 로컬 `dev` 는 5커밋 뒤다)
- APP 브랜치: `feat/app-941/admin-agent-controls` ← `pro-54/외부-에이전트-연결`
- 병합: APP → PRO 는 squash(로컬, `merge-worktree.sh`), PRO → `dev` 는 rebase, 그 뒤 `dev` → `main`(Vercel 운영). 커밋 제목은 `[APP-941] 제목`. push 는 사용자 확인 뒤
- 검증: `pnpm test:run && pnpm verify`

## spec 검토 결과

| 관점 | 물은 것 | 답 |
|---|---|---|
| 계약 | 우리가 발행한 약속과 어긋나나 | 어긋나지 않는다. web 은 계약을 바꾸지 않고 사본만 docs 미러(`226b252`, docs#190·#196 반영)에서 `scripts/sync-openapi.mjs` 로 다시 만든다. 미러의 `/internal/**`(APP-927 이 먼저 옮긴 것 포함)은 스크립트가 뺀다. 운영 server `d991e35a` 가 이 계약을 이미 준다 |
| 실측 | 근거로 댄 숫자가 실제로 잰 것인가 | 숫자는 없다. 확인창의 N 은 화면이 읽은 관리자 목록 길이다 |
| 경계 | 영향받는 호출자·마이그레이션·테스트 더블을 모두 확인했나 | 설정 대화상자에 「외부 에이전트」 이름의 버튼이 둘이 되어, 이름만으로 찾는 e2e(`e2e/agent-connections.spec.ts` 의 `getByRole("button", { name: "외부 에이전트" })`)가 모호해진다 — 그룹(`role="group"`, `aria-label` 계정·워크스페이스)으로 좁혀 고친다. 회수 사유 문구 표는 `Record<revokeReason, string>` 이라 새 값이 생성 타입에 들어오면 타입 검사가 두 칸을 요구한다. 목 DB 워크스페이스 시드는 셋 다 ADMIN 이라 MEMBER 화면은 컴포넌트 시험에서 멤버 목록 응답을 덮어 만든다 |
| 되돌리기 | 복구 비용은 얼마인가 | web 은 상태를 갖지 않는다. 운영에서 문제가 나면 `main` 을 이전 커밋으로 되돌리거나 Vercel 에서 이전 배포로 돌린다. 끄기·끊기로 회수된 연결은 server 쪽 데이터라 web 롤백으로 되살아나지 않는다(spec 「어떻게 실패하나」) |
| 사람에게 물은 것 | spec 의 열린 질문에 답이 났나 | 열린 질문은 없다. 결정 다섯은 2026-10-08 사용자가 추천대로 확인했다(spec PR docs#197) |

## 무엇을 건드리나

| 파일 | 지금 무엇인가 | 무엇으로 바뀌나 |
|---|---|---|
| `openapi3.yml` · `lib/api/generated/` | 관리자 통제 이전 사본 | APP-939·940 이 바꾼 경로·스키마만 미러에서 옮긴 사본과 `pnpm orval` 산출물(허용 변경·관리자 목록·회수 훅, `agentAccessAllowed`, 새 회수 사유) |
| `lib/mocks/db.ts` · `lib/mocks/rest-handlers.ts` | 워크스페이스·위임 목 | 워크스페이스 `agentAccessAllowed`, 허용 변경(끄면 그 워크스페이스 위임을 `AGENT_ACCESS_DISABLED` 로 회수), 관리자 목록·회수(`ADMIN`), 꺼진 워크스페이스로의 발급·허락 403 |
| `components/settings/settings-dialog.tsx` | 워크스페이스: 일반·멤버·연동 | 워크스페이스 그룹에 「외부 에이전트」 항목(`workspaceAgents`) |
| `components/settings/workspace-agent-access-settings.tsx` | (신규) | 역할 판정(멤버 목록), ADMIN: 허용 토글과 끄기 확인창(N개), 관리자 목록·끊기 확인창 / MEMBER: 켜짐·꺼짐과 안내. 끝나면 워크스페이스·관리자 목록·본인 연결 목록을 다시 읽는다 |
| `components/settings/agent-connections-settings.tsx` | 사유 문구 셋, 워크스페이스 선택 | 사유 문구 둘 추가, 막힌 워크스페이스를 「(외부 에이전트 꺼짐)」으로 잠그고 안내, 403 이면 워크스페이스를 다시 읽어 안내로 바꿈. 머리말은 spec 대로 그대로 둔다 |
| `components/agent-connections/agent-oauth-consent.tsx` | 워크스페이스 선택·자동 선택 | 막힌 워크스페이스 잠금과 안내(거절은 그대로), 403 이면 다시 읽어 안내로 바꿈 |
| `components/agent-connections/agent-access-blocked.tsx` | (신규) | 두 화면이 같이 쓰는 막힘 안내와 오류 코드 상수 |
| 시험 | — | `workspace-agent-access-settings.test.tsx`(신규), `agent-connections-settings.test.tsx`·`agent-oauth-consent.test.tsx`·`settings-dialog.test.tsx` 보강, e2e `workspace-agent-access.spec.ts`(신규)와 `agent-connections.spec.ts` 선택자 고침 |

**배치를 여기서 정한다.** 개인 토큰 폼과 동의 화면이 같이 쓰는 것(막힘 안내 문구, 오류 코드 `AGENT_ACCESS_DISABLED` 상수)은 이미 두 화면이 공유하는 `components/agent-connections/agent-access-notice.tsx` 옆에 `agent-access-blocked.tsx` 하나로 둔다. 막힘 판정은 `agentAccessAllowed === false` 한 줄이라 함수로 감싸지 않는다.

## 순서

### 1. 계약 사본과 목

- 바꾸는 것: `node scripts/sync-openapi.mjs <docs 미러>` → `openapi3.yml`, `pnpm orval`, 목 DB·핸들러
- 미러(`226b252`)에는 web 이 아직 받지 않은 다른 작업의 변경(PRO-48 관계 온톨로지: `/v1/notes/{noteId}/relations`, 분석 흐름 `regions`, 검토 항목 `suggestedAssignment`, 요약 `outline`·`signals` 삭제)이 먼저 들어와 있다. 통째로 받으면 그 작업의 web 몫을 섞게 되므로, 스크립트로 다시 만든 뒤 그 경로 다섯·스키마 넷을 옛 사본 값으로 되돌려 APP-939·940 변경만 남긴다(APP-1007 도 자기 경로만 고쳤다)
- 검증: `pnpm typecheck` — 회수 사유 문구 표가 새 두 값을 요구해 여기서 실패하는 것이 정상이다(2단계에서 채운다). 그래서 이 단계는 2단계와 한 커밋으로 묶는다
- 되돌리기: 2단계와 함께 revert

### 2. 팀원 화면 — 사유 문구와 막힌 워크스페이스

- 바꾸는 것: 사유 문구 둘, `agent-access-blocked.tsx`, 개인 토큰 폼·동의 화면의 잠금·안내·403 처리
- 시험: 지난 연결에 두 문구가 보인다. 막힌 워크스페이스는 고를 수 없고 안내가 보인다. 기본값이 막혀 있으면 만들기·허락이 잠기고 거절은 된다. 403 이면 안내로 바뀌고 동의 화면이 닫히지 않는다
- 검증: `pnpm test:run -- agent-connections agent-oauth-consent && pnpm typecheck`
- 되돌리기: 1단계와 한 커밋이라 함께 revert

### 3. 관리 화면

- 바꾸는 것: 설정 대화상자 항목, `workspace-agent-access-settings.tsx`
- 시험: MEMBER 에게는 관리 UI 가 없고 상태·안내만 보인다. 역할을 모르는 동안 관리 UI 를 그리지 않는다. 끄기는 N개가 적힌 확인창을 거쳐 요청이 가고 취소하면 요청이 없다. 켜기는 바로 간다. 목록 행의 칸과 끊기 확인창, 끊은 뒤 목록 다시 읽기
- 검증: `pnpm test:run -- workspace-agent-access settings-dialog && pnpm typecheck`
- 되돌리기: 이 커밋만 revert

### 4. e2e

- 바꾸는 것: `e2e/agent-connections.spec.ts` 의 「외부 에이전트」 버튼을 계정 그룹으로 좁힌다. 새 `e2e/workspace-agent-access.spec.ts`: ADMIN 이 끄면 확인창을 거쳐 목록이 비고, 계정 › 외부 에이전트의 지난 연결에 차단 사유가 보인다(목 사용자가 ADMIN 이자 맡긴 사람이다)
- 검증: `pnpm test:e2e -- agent-connections workspace-agent-access` (dev 서버·프리뷰가 떠 있으면 먼저 끈다)
- 되돌리기: 이 커밋만 revert

### 5. 로컬 끝-끝 (커밋 없음)

- 최신 server `dev`(`d991e35a` 이상)를 일회용 compose(일회용 DB)로 띄우고 web dev 서버를 그 server 에 붙인다. 사용자 DB·운영 토큰은 쓰지 않는다
- ADMIN 으로 끄기·켜기·목록·끊기가 동작하고, 꺼진 워크스페이스로 개인 토큰 만들기와 OAuth 허락이 막히는 것을 본다. 결과는 APP 완료 댓글에 적는다

## 마지막 관문

4단계까지 커밋한 뒤 `pnpm test:run && pnpm verify` 와 `pnpm test:e2e` 를 한 번 통째로 돌린다. web 은 PR·CI 가 없어 **이것이 유일한 관문**이다. 그다음 skill `merging` 의 codex 리뷰 게이트를 지나 APP → PRO squash, PRO → `dev` rebase, `dev` → `main` 순서로 넣고, push 는 단계마다 사용자 확인 뒤에 한다.

## 안 하는 것

- 사용 내역, 알림 — spec 「범위 밖」
- OAuth 안내 켜기 — APP-933
- 역할을 워크스페이스 응답의 `role` 로 가르기 — spec 「무엇을 포기했나」
