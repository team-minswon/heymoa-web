# 연동·알림·멤버 (y=30000)

`mvp.pen` v4 캔버스 y=30000 행. 프레임은 모두 1440×900, x 간격 1840.
실측 기준: 뷰포트 1440×900 · 사이드바 255(설정 화면은 SettingsNav 255) · 앱바 64 · 셸 `$el-canvas` · 카드 `$el-surface-card`.

## 프레임

| 프레임 ID | 화면 | 대응 operation | 응답이 만드는 상태 | shadcn | 실측 파생 근거 |
|---|---|---|---|---|---|
| `soPy6` (x=0) | settings-integrations-admin | `GET /v1/workspaces/{id}/integrations` · `GET .../integrations/{provider}/authorize` · `DELETE .../integrations/{provider}` | `LINEAR` connected=true → 연결됨 · connectedBy "김민수" · connectedAt 2026-06-02 + **연결 해제**. `GITHUB` connected=false → 연결되지 않음 · connectedBy/connectedAt null(`—`) + **연결**. 미연동 provider도 목록에 오므로 두 카드가 항상 렌더된다 | Card + Button + Badge(연결 상태 dot) | 콘텐츠 1185 = 1440−255, PageWrap padding 40 → 본문 1105 |
| `t8oW0` (x=1840) | settings-integrations-member | 같은 `GET .../integrations` | 같은 응답, role=MEMBER → **버튼 없음**. 상태·connectedBy·connectedAt만. 하단 Alert "새 연동이 필요하면 ADMIN에게 요청하세요." (`DELETE` 403 비ADMIN을 UI에서 미리 막는다) | Card + Alert | 동일 |
| `O1xLI` (x=3680) | notification-bell (드롭다운 열림) | `GET /v1/notifications` · `PUT /v1/notifications/{id}/read` · `POST /v1/invitations/{id}/accept`·`/decline` | unreadCount 2 → Badge "2". PENDING 2건 = 수락/거절 버튼 + 미읽음 dot. ACCEPTED 1건 = 버튼 대신 "수락함" 라벨, dot 없음(readAt 있음) | DropdownMenu + Badge + Button×2 | 드롭다운 404w, 앵커 x=725/y=56 (앱바 64 아래) |
| `iAG1e` (x=5520) | settings-members | `GET .../members` · `GET .../invitations` · `POST .../invitations` · `DELETE .../invitations/{id}` | members 7건(내 role=ADMIN → 초대 폼 노출, ADMIN/MEMBER RoleChip, joinedAt). 대기 초대 2건: inviteeName+inviteeEmail, role, `inviterName · createdAt`, 취소 | Form + Input + Select + Table | 행 높이 52, NameCol 300, RoleCell 130 |
| `Si390` (x=7360) | **notification-empty** | `GET /v1/notifications` (빈 목록) | notifications=[] · unreadCount=0 → Badge 자체가 사라지고 벨 하이라이트 없음, "모두 읽음으로"는 비활성 색. 빈 문구가 "읽은 알림도 남는다"를 명시 | DropdownMenu + 빈 상태 | 드롭다운 폭·앵커 동일, 아이콘 원 44 |
| `x1pwOb` (x=9200) | **notification-invitation-resolved** | 같은 `GET` + `POST .../accept` 409 | invitation.status ≠ PENDING이면 버튼 대신 라벨: **취소됨(CANCELED) · 거절함(DECLINED) · 수락함(ACCEPTED)**. 취소·수락돼도 항목은 목록에 남는다. 상단 Alert = 만료된 PENDING에 수락을 눌렀을 때의 `409 INVITATION_NOT_PENDING` "이미 처리된 초대입니다." | DropdownMenu + Alert(destructive) + Button×2 | 동일 |
| `UOUZl` (x=11040) | **members-invite 409 ALREADY_WORKSPACE_MEMBER** | `POST .../invitations` | 이미 멤버인 junho@heymoa.app → 입력 테두리 destructive + 인라인 Alert "이미 워크스페이스 멤버입니다." + 코드. 멤버 목록/대기 목록은 그대로 | Form + Input(error) + Alert | 폼 아래 Alert 37h, 본문 총 826 < 836 (클리핑 없음) |
| `KOM8F` (x=12880) | **members-invite 409 DUPLICATE_PENDING_INVITATION** | 같은 operation | 이미 대기 중인 dahee@heymoa.app → "이미 대기 중인 초대가 있습니다." 아래 대기 초대 목록에 같은 사람이 보인다 | 동일 | 동일 |
| `iHlP8` (x=14720) | **members-invite 404 INVITEE_NOT_FOUND** | 같은 operation | `Sora@Heymoa.app` → "초대할 사용자를 찾을 수 없습니다. 철자와 대소문자를 확인해 주세요." 서버가 이메일을 정규화하지 않아 **가입한 사용자도 404가 될 수 있어** 문구를 "가입하지 않은 사용자"로 단정하지 않는다 | 동일 | 동일 |
| `uUOq0` (x=16560) | **mock-oauth 승인 화면** | `GET .../integrations/{provider}/authorize` (302) | fetch가 아니라 `window.location` 이동이라 화면 전체가 바뀐다. 목에서는 MSW가 최상위 내비게이션을 못 가로채므로 이 화면이 외부 제공자 + callback을 대신한다. 허용 → callback → `/w/{workspaceId}` | Button(rounded-full) | `components/mocks/mock-oauth-consent.tsx` 실측: max-w-md=448, gap-6=24, space-y-2=8, text-3xl 헤딩, 버튼 full-width rounded-full |

## 추가한 것

- `Si390` **알림 빈 상태** — `notifications: []`, `unreadCount: 0`. 배지 노드를 끄고(`enabled:false`) 벨 배경 하이라이트를 제거해 "미읽음 0"을 시각적으로 일치시켰다. 문구로 "읽은 알림도 사라지지 않는다"를 명시.
- `x1pwOb` **비PENDING 알림 상태 라벨 + 409** — CANCELED/DECLINED/ACCEPTED 세 라벨과 PENDING 1건을 한 화면에 두어, 목록이 남는다는 계약과 "PENDING만 버튼"이라는 규칙을 대비시켰다. 상단 destructive Alert가 `409 INVITATION_NOT_PENDING`(응답 문구 그대로 "이미 처리된 초대입니다.")을 담는다.
- `UOUZl` · `KOM8F` · `iHlP8` **초대 실패 3종** — openapi3.yml의 응답 메시지를 그대로 썼다(`이미 워크스페이스 멤버입니다.` / `이미 대기 중인 초대가 있습니다.` / `초대할 사용자를 찾을 수 없습니다.`). 각 프레임의 입력값이 실패 원인과 맞물린다(기존 멤버 이메일 / 이미 대기 중인 이메일 / 대문자 섞인 이메일).
- `uUOq0` **`/mock-oauth` 목 전용 승인 화면** — 실제 컴포넌트를 실측해 재현. provider가 경로 파라미터(enum) 그대로 노출되므로 헤딩도 `LINEAR`로 표기했다.

## 고친 것

- `O1xLI` 알림 항목 중 `주간 제품 회의 요약 3종이 생성되었습니다`, `디자인 시스템 점검 회의가 종료되었습니다` **삭제**. 계약의 `type` enum은 `WORKSPACE_INVITATION` 하나뿐이라(openapi3.yml `NotificationListResponse`) 초대 외 알림은 존재할 수 없다. 삭제에 맞춰 배지 3 → **2**로 정정(미읽음 2건과 일치), 마지막 항목의 하단 hairline 제거.
- `iAG1e` 대기 초대 행이 `inviteeEmail`만 보여주고 있었다. 계약 필드(`inviteeName`·`inviteeEmail`·`inviteeImage`·`inviterName`·`role`·`createdAt`)에 맞춰 **이름+이메일 2단 셀**로 바꾸고, 보낸 시각 셀을 `inviterName · createdAt`("김민수 · 3일 전 보냄")으로 정정했다. `inviteeImage`가 null인 경우의 폴백은 기존 mail 아이콘 원 그대로.

## 보고만 하는 것

- **공용 `reusable` 노드는 건드리지 않았다.** 이 행은 공용 컴포넌트 인스턴스를 쓰지 않고 v4 토큰으로 직접 조립돼 있어 수정할 일도 없었다.
- **초대 수락 후 "그 워크스페이스가 목록에 나타난다 / 기본 워크스페이스는 안 바뀐다"** 상태의 프레임이 아직 없다. 이 상태는 사이드바 워크스페이스 스위처에서 드러나므로 이 행이 아니라 워크스페이스 셸 행에서 다뤄야 한다.
- **사이드바 폭이 v4 전체에서 255**다(실측 256). 1px 차이가 y=20000~32000 전 행에 동일하게 적용돼 있어 이 행만 고치면 오히려 어긋난다.
- **설정 화면 본문이 1105 폭 풀블리드**다. 실측의 832 컬럼은 워크스페이스 화면(사이드바+중앙 정렬) 기준이라 설정 라우트에는 적용하지 않았다.
- `/mock-oauth`는 워크스페이스 라우트가 아니라 `NavbarGate`/`FooterGate`가 **마케팅 내비게이션·푸터를 렌더한다**. 프레임에는 HeyMoa 워드마크만 있는 최소 앱바로 존재 사실만 표시했다. 마케팅 내비는 랜딩 행 소관.
- 목 `authorize`는 `/mock-oauth?workspaceId=…&provider=…`로 302하고, 승인 후에는 설정 화면이 아니라 `/w/{workspaceId}`로 돌아간다(`components/mocks/mock-oauth-consent.tsx`). 연동 설정 → 승인 → 워크스페이스로 튀는 흐름이라 UX상 재확인이 필요할 수 있다.
- 다른 행 소관이지만 눈에 띈 것: `evks6`(v4/personal-chat-empty, y=26000)에 `placeholder: true`가 남아 있다.
