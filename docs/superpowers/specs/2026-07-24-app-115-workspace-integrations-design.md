# APP-115 워크스페이스 연동 설정 UI 설계

**목표:** 설정 다이얼로그에 연동 섹션을 더한다 — Linear/GitHub 연결·해제(ADMIN 단독), MEMBER는 상태 열람만. OAuth 왕복(authorize→mock-oauth→callback)은 이미 있으니 재사용한다.

**입력:** `docs/api-surface.md` 워크스페이스 연동 절, `docs/design-decisions.md` 연동 행(y=30000: `soPy6` admin, `t8oW0` member), `ToolConnectionsResponseDataIntegrationsItem`(provider·connected·connectedBy·connectedAt), 계약 provider enum(LINEAR·GITHUB).

**범위 밖:** 멤버 탭(APP-117), 알림 벨(APP-116). OAuth 왕복 인프라(mock-oauth·callback)는 완성됨(e2e "completes the mocked OAuth round trip" 통과 중).

## 자문자답으로 잡은 것

### 역할은 멤버 목록에서 내 userId로 가른다

`useGetWorkspaceMembers`의 members에서 `useAuth().user.userId`와 같은 멤버를 찾아 `role`을 읽는다. **ADMIN → 연결·해제 버튼, MEMBER → 상태만 + Alert("새 연동이 필요하면 ADMIN에게 요청하세요").** 403 `NOT_WORKSPACE_ADMIN`은 버튼을 숨겨 예방하는 최후 방어선일 뿐이다.

**역할을 모르는 동안(멤버 로딩 중)에는 버튼을 그리지 않는다.** 낙관적으로 ADMIN 버튼을 그리면 MEMBER에게 잠깐 눌리는 버튼이 보이고, 눌러 봤자 403이다. 로딩 중엔 상태만 보인다.

### 두 provider는 항상 렌더된다

`GET integrations`는 **미연동 provider도 목록에 담아 준다**(`connected: false`). LINEAR·GITHUB 두 카드가 늘 선다 — connected면 connectedBy·connectedAt + 해제, 아니면 "연결되지 않음" + 연결. SLACK은 계약 enum에도 없어 그리지 않는다.

### 연결은 fetch가 아니라 window.location 이동이다

authorize(`GET .../{provider}/authorize`)는 **302라 fetch로 부르면 안 된다** — 응답이 HTML이라 `apiFetch`의 JSON 파싱이 깨진다. `window.location.href = buildUrl(authorizePath)`로 최상위 이동한다. 실서버는 제공자로, 목은 `/mock-oauth`(app 라우트)로 302되고, 허용 후 callback이 상태를 심고 `/w/{workspaceId}`로 돌아온다. (생성 훅 `startWorkspaceIntegration`은 302라 쓸 수 없다.)

`buildUrl`(fetcher)이 apiBaseUrl 유무로 상대/절대 URL을 만들어 목·실서버를 한 코드로 처리한다.

### 해제는 mutation, 상태는 다시 읽는다

`useDisconnectWorkspaceIntegration.mutate({workspaceId, provider})` → 204 → `GET integrations` 무효화로 카드가 "연결되지 않음"으로 바뀐다. 실패 문구는 전역 MutationCache 토스트.

### 연결 후 돌아오는 곳이 설정이 아니다

목 callback은 `/w/{workspaceId}`로 돌려보낸다(설정 화면이 아님). 연동 설정 → 승인 → 워크스페이스로 튀는 흐름은 기존 인프라의 동작이라 이 이슈에서 바꾸지 않는다(재확인 필요 시 별도 이슈).

## 구조

```
components/settings/workspace-integrations-settings.tsx  (신규) 연동 섹션 — 카드 2개·ADMIN/MEMBER 분기
components/settings/settings-dialog.tsx                  (수정) SettingsSection += "integrations", 나브 버튼
```

`workspace-integrations-settings`는 `useGetWorkspaceIntegrations` + `useGetWorkspaceMembers`(role) 둘로 화면을 만든다. connect는 `window.location`, disconnect는 mutation.

## 오류 표시 — AGENTS.md 경계

| 무엇 | 어떻게 |
|---|---|
| MEMBER 열람 | 버튼 미노출 + 안내 Alert (지속 상태) |
| 해제 실패(403 등) | 전역 토스트 (버튼이 없으니 도달 자체가 예외) |
| 연동 목록 로딩 | Skeleton |
| 목록 실패 | 인라인 오류 + 재시도 |

## 성공 기준

- ADMIN이면 연결·해제 버튼, MEMBER이면 상태만 + 안내 Alert (역할 로딩 중엔 버튼 없음)
- 두 provider(LINEAR·GITHUB)가 항상 렌더, connected면 connectedBy·connectedAt 표시
- 연결 버튼이 authorize로 window.location 이동, 해제가 mutation 후 상태 반영
- 설정 다이얼로그에 연동 섹션 추가
- vitest: ADMIN/MEMBER 분기, 상태 렌더, 연결/해제 호출
- 브라우저 실측(OAuth 왕복) + 전체 검증

## 리뷰 게이트

로컬 `codex exec review --base dev` 한 번. 판단은 `docs/codex-review-app-115.md`에 남긴다.
