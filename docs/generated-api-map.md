# orval 생성물 지도 (2026-07-23)

`pnpm orval`이 `openapi3.yml`(34경로)에서 만든 태그별 파일. **import 경로와 훅 이름은 여기서 확인한다.**

서버 계약의 태그 중 `Workspace Invitations`·`Workspace Members`에는 공백이 있는데,
orval이 kebab-case 디렉터리로 떨어뜨렸다.

## 이번에 새로 생긴 태그 8개

| 서버 태그 | 디렉터리 | 훅 | MSW 핸들러 |
|---|---|---|---|
| AgentChat | `lib/api/generated/agent-chat/` | `useCreateAgentChat` `useGetActiveAgentChat` `useGetAgentChatMessages` `useSendAgentChatMessage` `useResolveToolApproval` | `getCreateAgentChatMockHandler` `getGetActiveAgentChatMockHandler` `getGetAgentChatMessagesMockHandler` `getSendAgentChatMessageMockHandler` `getResolveToolApprovalMockHandler` |
| NoteSharedChat | `lib/api/generated/note-shared-chat/` | `useGetNoteSharedChatMessages` `useSendNoteSharedChatMessage` | `getGetNoteSharedChatMessagesMockHandler` `getSendNoteSharedChatMessageMockHandler` |
| Notifications | `lib/api/generated/notifications/` | `useGetNotifications` `useMarkNotificationRead` | `getGetNotificationsMockHandler` `getMarkNotificationReadMockHandler` |
| Workspace Invitations | `lib/api/generated/workspace-invitations/` | `useGetWorkspaceInvitations` `useCreateWorkspaceInvitation` `useCancelWorkspaceInvitation` `useAcceptWorkspaceInvitation` `useDeclineWorkspaceInvitation` | `getGetWorkspaceInvitationsMockHandler` `getCreateWorkspaceInvitationMockHandler` `getCancelWorkspaceInvitationMockHandler` `getAcceptWorkspaceInvitationMockHandler` `getDeclineWorkspaceInvitationMockHandler` |
| Workspace Members | `lib/api/generated/workspace-members/` | `useGetWorkspaceMembers` | `getGetWorkspaceMembersMockHandler` |
| WorkspaceIntegration | `lib/api/generated/workspace-integration/` | `useGetWorkspaceIntegrations` `useStartWorkspaceIntegration` `useCompleteWorkspaceIntegration` `useDisconnectWorkspaceIntegration` | `getGetWorkspaceIntegrationsMockHandler` `getStartWorkspaceIntegrationMockHandler` `getCompleteWorkspaceIntegrationMockHandler` `getDisconnectWorkspaceIntegrationMockHandler` |
| Analysis | `lib/api/generated/analysis/` | `useEndMeeting` `useRequestAnalysis` `useGetLatestAnalysis` | `getEndMeetingMockHandler` `getRequestAnalysisMockHandler` `getGetLatestAnalysisMockHandler` |
| Meeting | `lib/api/generated/meeting/` | `usePauseMeeting` `useResumeMeeting` | `getPauseMeetingMockHandler` `getResumeMeetingMockHandler` |

기존 태그(`auth` `users` `workspaces` `projects` `notes` `transcription`)는 그대로다.

## SSE 두 경로는 생성 훅을 쓰지 않는다

`useSendAgentChatMessage`와 `useSendNoteSharedChatMessage`는 **생성됐지만 쓸 수 없다.**
응답이 `text/event-stream`이라 생성 훅이 스트림을 읽지 못하고 한 덩어리로 다룬다.

이 둘은 `lib/api/sse.ts`의 `postEventStream()` 위에 손으로 만든다. `endMeeting`이
`Analysis` 태그에 붙어 있는 것도 계약 그대로다 — 회의 종료가 분석 잡을 만들기 때문이다.

## `startWorkspaceIntegration`도 생성 훅을 쓰지 않는다

계약이 **302 리다이렉트**라 훅으로 부르면 응답 본문이 HTML이고 `apiFetch`의 JSON 파싱이
깨진다. 실제 서버도 Linear·GitHub로 이동시키므로 같다. **`window.location`으로 이동해야 한다.**

목 환경에서는 `/mock-oauth`가 외부 제공자와 callback 이동을 함께 대신한다 —
**MSW는 최상위 내비게이션을 가로채지 못하므로** 그 왕복을 브라우저 이동으로 재현할 수 없다.

## `/internal` 경로는 생성되지 않는다

`openapi3.yml`에서 제외했으므로 생성물에도 없다. `lib/api/openapi-contract.test.ts`의
`"never generates a client for internal paths"`가 이 사실을 고정한다.
