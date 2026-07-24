# APP-116 알림 벨 설계

**목표:** 워크스페이스 툴바에 알림 벨 — unreadCount 배지, 드롭다운, PENDING 초대 인라인 수락/거절, 해결된 초대는 상태 라벨.

**입력:** `docs/api-surface.md` 알림 절, `docs/design-decisions.md` 알림 행(y=30000: `O1xLI` 열림, `Si390` 빈 상태, `x1pwOb` 해결됨/409), 계약(`GET /v1/notifications`·`PUT .../read`·`POST /v1/invitations/{id}/accept|decline`), `NotificationListResponseData`.

**범위 밖:** 초대 발신(설정 멤버 탭 APP-117). 서버 초대 체인(APP-82~87)은 완료·병합됨.

## 자문자답으로 잡은 것

### 알림은 초대 하나뿐이다

계약 `type` enum은 **`WORKSPACE_INVITATION` 하나**다(요약·회의 종료 알림은 계약에 없어 v4 감사에서 삭제됨). 모든 알림 항목은 초대이고 `invitation`(inviterName·workspaceName·role·status)을 담는다. 그래서 렌더 분기는 `invitation.status`가 전부다.

| status | 화면 | 프레임 |
|---|---|---|
| PENDING | "{inviter}님이 {workspace}에 초대했습니다" + 역할 + **수락/거절 버튼** + 미읽음 dot(readAt null) | `O1xLI` |
| ACCEPTED / DECLINED / CANCELED | 버튼 대신 라벨(수락함/거절함/취소됨). 항목은 목록에 남는다 | `x1pwOb` |

### 취소·수락된 초대도 목록에 남는다

알림은 얇은 범용 구조라 초대가 취소·수락돼도 알림은 남고 `invitation.status`만 바뀐다. **그래서 PENDING이 아닌 알림은 버튼 대신 상태 라벨을 보인다** — 이미 처리된 초대에 수락 버튼을 두면 안 된다.

### 만료된 PENDING 수락은 409다 (`x1pwOb`)

렌더 시점엔 PENDING이었는데 그 사이 초대가 취소·처리되면 수락이 **409 `INVITATION_NOT_PENDING`**이다. 버튼이 예방하지 못하는 경합이므로 드롭다운 상단에 **인라인 destructive `Alert` "이미 처리된 초대입니다."** 를 띄우고, 수락/거절은 notifications를 무효화해 목록을 새 상태로 갱신한다(그러면 그 항목이 라벨로 바뀐다). AGENTS 경계표상 지속 상태이므로 토스트가 아니라 인라인이다.

### 클릭 시 읽음, 마크-올은 없다

**계약에 벌크 읽음 엔드포인트가 없다**(`PUT /v1/notifications/{id}/read` 하나뿐). `Si390`의 "모두 읽음으로"는 벌크 API가 없어 만들지 않는다 — 알림 **행을 클릭하면 읽음 처리**(`useMarkNotificationRead`, readAt 있으면 skip)하고, 수락/거절도 그 초대 알림을 읽는다. 미읽음 dot과 배지가 그때 줄어든다.

`ponytail:` 마크-올은 벌크 엔드포인트가 생기면 추가한다 — 지금 N번 PUT을 도는 건 과하다.

### 수락은 workspaces도 무효화한다

수락하면 워크스페이스에 합류하므로 **notifications + workspaces 둘 다 무효화**한다 — 사이드바 워크스페이스 목록에 새 워크스페이스가 나타나야 한다. 거절은 notifications만.

### 빈 상태는 배지를 끈다 (`Si390`)

`notifications: []`·`unreadCount: 0`이면 배지 노드를 끄고 "아직 알림이 없습니다 · 읽은 알림도 사라지지 않습니다"를 보인다.

## 구조

```
components/notification/notification-bell.tsx  (신규) 벨 + 배지 + 드롭다운 + 초대 행
components/workspace/workspace-toolbar.tsx      (수정) 툴바 우측에 벨
```

`notification-bell`은 `useGetNotifications`(폴링 없음) + `useMarkNotificationRead` + `useAccept/DeclineWorkspaceInvitation`으로 만든다.

## 오류 표시 — AGENTS.md 경계

| 무엇 | 어떻게 |
|---|---|
| 409 이미 처리된 초대 | 드롭다운 상단 인라인 destructive `Alert` (지속 상태) |
| 그 밖 수락/거절 실패 | 전역 토스트(MutationCache) |
| 목록 로딩 | 드롭다운 안 Skeleton |
| 목록 실패 | 드롭다운 안 오류 + 재시도 |

## 성공 기준

- unreadCount 배지(0이면 숨김), 드롭다운
- PENDING 초대: inviter/workspace/역할 + 수락/거절 버튼 + 미읽음 dot
- 해결된 초대: 상태 라벨(수락함/거절함/취소됨), 버튼 없음
- 수락/거절 mutation → notifications(+수락 시 workspaces) 무효화
- 409 INVITATION_NOT_PENDING → 인라인 Alert
- 행 클릭 시 읽음 처리(미읽음일 때만)
- 빈 상태 문구
- 툴바에 벨
- vitest: 배지, PENDING 버튼, 수락 mutation, 비PENDING 라벨, 409 Alert, 읽음
- 브라우저 실측 + 전체 검증

## 리뷰 게이트

로컬 `codex exec review --base dev` 한 번. 판단은 `docs/codex-review-app-116.md`에 남긴다.
