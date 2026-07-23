# API 표면 (2026-07-23)

`openapi3.yml` **34경로 / 44 operation**이 만드는 화면과 상태. 행 단위는 operation이다 —
훅이 operation 단위로 생성되기 때문이다.

**이 문서를 읽는 사람**

- v4 디자인 에이전트(APP-145): 자기 행에 해당하는 부분만 본다. `v4 프레임`이 `없음`인 것이 작업 목록이다
- 화면 구현(APP-111~117): 어떤 훅으로 무엇을 그리는지, 어떤 실패를 처리해야 하는지

**`v4 프레임`은 지금 전부 `없음`이다.** APP-145가 그리면서 채운다. 기존 25프레임을 미리
매핑하면 재구성 때 다시 써야 해서 비워 뒀다.

**생성 훅을 쓸 수 없는 셋**은 표에 ⚠로 표시했다. 이유는 각 행에 적었다.

---

## 인증

| operation | 훅 | 쓰는 화면 | 응답이 만드는 상태 | v4 프레임 |
|---|---|---|---|---|
| `POST /v1/auth/refresh` | `useRefreshTokens` | 없음 (`lib/api/fetcher.ts`가 401에서 자동 호출) | 실패 시 로그아웃 전이 | 없음 |
| `POST /v1/auth/logout` | `useLogout` | 툴바 계정 메뉴 | 성공 시 `/`로 replace + 캐시 비움 | 없음 |
| `GET /v1/users/me` | `useGetCurrentUser` | 앱 셸 전체 | 로딩 / 미인증(401) | 없음 |

## 워크스페이스 · 프로젝트 · 노트 (기존 화면)

| operation | 훅 | 쓰는 화면 | 응답이 만드는 상태 | v4 프레임 |
|---|---|---|---|---|
| `GET /v1/workspaces` | `useGetWorkspaces` | 사이드바 워크스페이스 전환 | 로딩 / 빈 목록 | 없음 |
| `POST /v1/workspaces` | `useCreateWorkspace` | 워크스페이스 생성 | pending / 400 이름 오류 | 없음 |
| `GET /v1/workspaces/{workspaceId}` | `useGetWorkspace` | 워크스페이스 셸 | 로딩 / 404 | 없음 |
| `PUT /v1/workspaces/{workspaceId}` | `useUpdateWorkspace` | 설정 · 일반 | pending / 403 비ADMIN | 없음 |
| `PUT /v1/users/me/default-workspace` | `useChangeDefaultWorkspace` | 워크스페이스 전환 | pending | 없음 |
| `GET /v1/workspaces/{workspaceId}/projects` | `useGetProjects` | 사이드바 프로젝트 목록 | 로딩 / 빈 목록 | 없음 |
| `POST /v1/workspaces/{workspaceId}/projects` | `useCreateProject` | 프로젝트 생성 | pending / 400 | 없음 |
| `GET /v1/workspaces/{workspaceId}/projects/{projectId}` | `useGetProject` | 프로젝트 상세 | 로딩 / 404 | 없음 |
| `PUT /v1/workspaces/{workspaceId}/projects/{projectId}` | `useUpdateProject` | 프로젝트 이름 수정 | pending | 없음 |
| `DELETE /v1/workspaces/{workspaceId}/projects/{projectId}` | `useDeleteProject` | 프로젝트 삭제 | 확인 → pending | 없음 |
| `GET /v1/projects/{projectId}/notes` | `useGetNotes` | 노트 목록 | 로딩 / 빈 목록 | 없음 |
| `POST /v1/projects/{projectId}/notes` | `useCreateNote` | 노트 생성 | pending | 없음 |
| `GET /v1/notes/{noteId}` | `useGetNote` | 노트 상세(side·full) | 로딩 / 404. **`meetingStatus`·`meetingStartedBy`가 회의 UI 전부의 근거** | 없음 |
| `PATCH /v1/notes/{noteId}` | `useUpdateNote` | 노트 제목 수정 | pending | 없음 |

## 전사

| operation | 훅 | 쓰는 화면 | 응답이 만드는 상태 | v4 프레임 |
|---|---|---|---|---|
| `POST /v1/notes/{noteId}/transcription-sessions` | `useStartTranscriptionSession` | 녹음 시작 | pending / 409 이미 진행 중 / 403. **첫 성공이 회의 시작자를 정한다** | 없음 |
| `GET /v1/transcription-sessions/{sessionId}` | `useGetTranscriptionSession` | 녹음 독 | 세션 상태 표시 | 없음 |
| `GET /v1/notes/{noteId}/transcript` | `useGetNoteTranscript` | 전사 탭 | 로딩 / 빈 전사 | 없음 |

실시간 전사는 STOMP다 — `asyncapi.yml` 참조. REST는 세션 시작과 확정 전사 조회만 한다.

## 회의 상태

| operation | 훅 | 쓰는 화면 | 응답이 만드는 상태 | v4 프레임 |
|---|---|---|---|---|
| `POST /v1/notes/{noteId}/meeting-pause` | `usePauseMeeting` | 회의 컨트롤 (시작자만) | pending / **403 시작자 아님** / 409 녹음 중·상태 위반 | 없음 |
| `POST /v1/notes/{noteId}/meeting-resume` | `useResumeMeeting` | 회의 컨트롤 (시작자만) | pending / 403 / 409 PAUSED 아님 | 없음 |
| `POST /v1/notes/{noteId}/meeting-end` | `useEndMeeting` | 회의 종료 확인 (시작자만) | 202 접수 → 분석 대기 / 403 / **409 녹음 중 → stop 후 재시도** | 없음 |

**시작자가 아니면 이 셋이 화면에 없어야 한다.** 뷰어에게는 상태만 보인다. 시작자 판정은
`GET /v1/notes/{noteId}`의 `meetingStartedBy.userId`다.

## 분석

| operation | 훅 | 쓰는 화면 | 응답이 만드는 상태 | v4 프레임 |
|---|---|---|---|---|
| `GET /v1/notes/{noteId}/analyses/latest` | `useGetLatestAnalysis` | 요약 탭 | **404 = 아직 분석 없음**(오류 아님) / PENDING·RUNNING 진행 중 / SUCCEEDED 요약 3종 / FAILED 사유 | 없음 |
| `POST /v1/notes/{noteId}/analyses` | `useRequestAnalysis` | 재분석 버튼 | 202 접수 / 409 회의 미종료·이미 진행 중 | 없음 |

`overview`·`actionItems`·`insights`는 **markdown 문자열이고 미완료 시 null**이다.
서버는 이 값을 구조화하지 않고 그대로 넘기므로 **web이 markdown으로 렌더한다** — 원문을
그대로 출력하면 `#`·`-` 같은 문법이 사용자에게 노출된다.

## 개인 챗봇

| operation | 훅 | 쓰는 화면 | 응답이 만드는 상태 | v4 프레임 |
|---|---|---|---|---|
| `POST /v1/agent-chats` | `useCreateAgentChat` | "새로운 대화 시작" | pending. 같은 대상의 기존 세션이 비활성으로 내려간다 | 없음 |
| `GET /v1/agent-chats/active` | `useGetActiveAgentChat` | 패널 열 때 (새로고침 복원) | **`null` = 활성 세션 없음**(오류 아님) | 없음 |
| `GET /v1/agent-chats/{chatId}/messages` | `useGetAgentChatMessages` | 패널 히스토리 | 로딩 / 빈 대화 / 404 | 없음 |
| `POST /v1/agent-chats/{chatId}/messages` | ⚠ 생성 훅 사용 불가 | 메시지 전송 | SSE 스트림 — 아래 참조 | 없음 |
| `POST /v1/agent-chats/{chatId}/approvals/{approvalId}` | `useResolveToolApproval` | 승인 카드 | 204 접수(확정 아님) / **403 입력자 아님**(`NOT_APPROVAL_OWNER`) / **404 만료·없음**(`APPROVAL_NOT_FOUND`) / **409 회의가 끝남**(`MEETING_NOT_ACTIVE`) / 400 잘못된 decision | 없음 |

⚠ `sendAgentChatMessage`는 응답이 `text/event-stream`이라 생성 훅이 스트림을 읽지 못한다.
`lib/api/sse.ts`의 `postEventStream()`을 쓴다.

**승인 API의 204는 "중계했다"는 뜻이지 확정이 아니다.** 확정의 단일 출처는 스트림의
`tool_approval_resolved` 이벤트다.

## 공유 챗봇

| operation | 훅 | 쓰는 화면 | 응답이 만드는 상태 | v4 프레임 |
|---|---|---|---|---|
| `GET /v1/notes/{noteId}/chat/messages` | `useGetNoteSharedChatMessages` | 노트 full 우측 패널 | 로딩 / 빈 대화. **`lock.locked`·`lock.lockedBy`·`lock.pendingApproval`이 관전자 화면의 전부** | 없음 |
| `POST /v1/notes/{noteId}/chat/messages` | ⚠ 생성 훅 사용 불가 | 메시지 전송 | SSE 스트림 / **409 잠금·비ACTIVE** / 400 빈 메시지 | 없음 |

**관전자는 스트림을 받지 않는다.** 다른 멤버가 입력 중인 것도, 승인 대기 중인 것도
`GET`의 `lock`을 폴링해서만 안다. 이 필드가 관전자 UI의 유일한 근거다.

## 초대 · 멤버 · 알림

| operation | 훅 | 쓰는 화면 | 응답이 만드는 상태 | v4 프레임 |
|---|---|---|---|---|
| `GET /v1/workspaces/{workspaceId}/members` | `useGetWorkspaceMembers` | 설정 · 멤버 탭 | 로딩. **내 role 판별의 근거** (ADMIN이면 초대 폼 노출) | 없음 |
| `GET /v1/workspaces/{workspaceId}/invitations` | `useGetWorkspaceInvitations` | 설정 · 멤버 탭 (ADMIN) | 빈 목록 / 대기 초대 목록 | 없음 |
| `POST /v1/workspaces/{workspaceId}/invitations` | `useCreateWorkspaceInvitation` | 초대 폼 | pending / **409 이미 멤버·중복 초대** / **404 미가입자** / 403 비ADMIN | 없음 |
| `DELETE /v1/workspaces/{workspaceId}/invitations/{invitationId}` | `useCancelWorkspaceInvitation` | 대기 초대 취소 | pending / 409 이미 확정 | 없음 |
| `POST /v1/invitations/{invitationId}/accept` | `useAcceptWorkspaceInvitation` | 알림 벨 인라인 | pending → **워크스페이스 목록에 합류** / 403 본인 아님 / 409 이미 확정 | 없음 |
| `POST /v1/invitations/{invitationId}/decline` | `useDeclineWorkspaceInvitation` | 알림 벨 인라인 | pending / 403 / 409 | 없음 |
| `GET /v1/notifications` | `useGetNotifications` | 알림 벨 | 빈 목록 / `unreadCount` 배지 | 없음 |
| `PUT /v1/notifications/{notificationId}/read` | `useMarkNotificationRead` | 알림 클릭 | 배지 감소. **응답은 `notificationId`만** | 없음 |

**알림은 초대의 현재 상태를 담는다.** 초대가 취소돼도 알림은 목록에 남고 `invitation.status`만
바뀐다. 그래서 PENDING이 아닌 알림은 버튼 대신 상태 라벨을 보여야 한다.

**초대 실패의 404는 "미가입자"다.** 서버가 이메일 정규화를 하지 않아 대문자가 섞인 주소는
가입한 유저인데도 404가 될 수 있다 — 문구를 "가입하지 않은 사용자"로 단정하지 않는 편이 안전하다.

## 워크스페이스 연동

| operation | 훅 | 쓰는 화면 | 응답이 만드는 상태 | v4 프레임 |
|---|---|---|---|---|
| `GET /v1/workspaces/{workspaceId}/integrations` | `useGetWorkspaceIntegrations` | 설정 · 연동 탭 | **미연동 provider도 목록에 온다**(`connected: false`) — "연결하기" 버튼의 근거 | 없음 |
| `GET /v1/workspaces/{workspaceId}/integrations/{provider}/authorize` | ⚠ 생성 훅 사용 불가 | 연결 버튼 (ADMIN) | 302 리다이렉트 | 없음 |
| `GET /v1/integrations/{provider}/callback` | `useCompleteWorkspaceIntegration` | 없음 (제공자가 브라우저를 보냄) | 302 리다이렉트 | 없음 |
| `DELETE /v1/workspaces/{workspaceId}/integrations/{provider}` | `useDisconnectWorkspaceIntegration` | 해제 버튼 (ADMIN) | 204 / 403 비ADMIN | 없음 |

⚠ `startWorkspaceIntegration`은 **302라 fetch로 부르면 안 된다** — 응답 본문이 HTML이고
`apiFetch`의 JSON 파싱이 깨진다. `window.location`으로 이동한다.

**provider는 `LINEAR`·`GITHUB` 둘뿐이다.** SLACK은 MVP 범위 밖이라 계약 enum에도 없다.
MEMBER에게는 상태만 보이고 연결·해제 버튼은 없다 — `connectedBy`(이름)와 `connectedAt`을 쓴다.

---

## 계약이 만드는 실패 — 화면 관점

상태 코드를 그대로 옮기면 쓸모가 없다. **그 실패가 화면에서 무엇으로 보여야 하는가**를 적는다.

| 실패 | 어디서 | 화면에서 보여야 하는 것 |
|---|---|---|
| 409 입력 잠금 | 공유 챗 전송 | "OO님이 입력 중" + 입력창 비활성. `lock.lockedBy`가 이름의 출처 |
| 409 회의 비ACTIVE | 공유 챗 전송 | "중지 중에는 개인 챗봇을 이용하세요" |
| 403 입력자 아님 | 승인 API | 관전자에게는 승인 버튼이 아예 없어야 한다 — 403은 최후 방어선 |
| 404 만료된 승인 | 승인 API | 카드 무효화 + 사유. 스트림이 끝나면 그 승인은 죽는다 |
| **409 회의가 끝남** | 승인 API (공유 챗) | 카드 무효화. 승인을 누르는 사이 회의가 종료된 경우다 — 일반 오류로 뭉개면 카드가 계속 눌리는 상태로 남는다 |
| 403 시작자 아님 | 회의 종료·중지·재개 | 뷰어에게는 버튼이 없어야 한다 |
| 409 녹음 중 종료 | 회의 종료 | stop 후 재시도 안내 |
| 404 분석 없음 | 요약 탭 | 오류가 아니라 **"아직 분석 전"** 상태 |
| **종료 이벤트 없이 SSE 끊김** | 두 스트림 | **재시도 UX.** 처리하지 않으면 영원히 로딩이다 |
| SSE `error` 이벤트 | 두 스트림 | 사유 표시 + 재시도. 부분 응답은 저장되지 않았다 |
| `tool_call_result(status=error)` | 두 스트림 | 도구 실패 표시. **스트림은 계속된다** — 종료로 다루면 안 된다 |

**"종료 이벤트 없이 끊김"이 가장 놓치기 쉽다.** 계약(`asyncapi.yml`)이 명시한 세 번째 종료
경로이고, 동시 스트림 상한 초과·upstream 유휴 60초·입력 잠금 상실 때 일어난다.

## shadcn 프리미티브 매핑

여섯 에이전트가 각자 고르면 구현이 여섯 갈래로 갈라진다. 여기 적힌 것을 쓴다.

| UI 요소 | 프리미티브 |
|---|---|
| 승인 카드 | `Card` + `Button`(승인/거절) |
| 승인 대기(관전자) | `Alert` + `Badge` |
| 도구 실행 기록 | `Card`(축약) + `Badge`(상태) + 외부 링크 |
| 알림 벨 | `DropdownMenu` + `Badge`(unreadCount) |
| 알림 항목의 수락/거절 | `Button` 2개 (인라인) |
| 설정 탭(멤버·연동) | `Tabs` |
| 초대 폼 | `Form` + `Input`(이메일) + `Select`(역할) |
| 멤버 목록 | `Table` |
| 연동 카드 | `Card` + `Button` + `Badge`(연결됨) |
| 잠금·비ACTIVE 안내 | `Alert` |
| 회의 종료 확인 | `AlertDialog` |
| 분석 진행 | `Skeleton` |
| 요약 3종 | `Tabs` + markdown 렌더 |
| 채팅 패널 | `Sheet`(노트 side) / 고정 패널(full·워크스페이스) |
