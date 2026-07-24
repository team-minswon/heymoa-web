# APP-117 설정 멤버 탭 설계

**목표:** 설정 다이얼로그에 멤버 섹션을 더한다 — 멤버 목록(이름·이메일·역할·가입일),
ADMIN이면 초대 폼(이메일 + ADMIN/MEMBER) + 대기 초대 목록 + 취소. MEMBER는 목록만 본다.

**입력:** `docs/design-decisions.md` 멤버 프레임(y=30000 `iAG1e` settings-members, 초대 실패
`UOUZl`/`KOM8F`/`iHlP8`), 계약(`GET .../members`·`GET|POST .../invitations`·`DELETE
.../invitations/{id}`), `WorkspaceMemberListResponseDataMembersItem`·
`WorkspaceInvitationListResponseDataInvitationsItem`·`CreateWorkspaceInvitationRequest`.

**범위 밖:** 알림 벨(APP-116, 완료), 연동(APP-115, 완료). 서버 초대 체인(APP-82~87) 완료·병합.

## 자문자답으로 잡은 것

### 대기 초대 목록 = GET invitations 그대로다

`GET .../invitations` 리스트 아이템에 **status 필드가 없다** — 서버가 PENDING만 돌려주기
때문이다(mock도 동일). 그래서 "대기 초대 목록"은 이 응답 전부다. 클라에서 status로 거를
필요가 없다. 아이템 필드: `inviteeName`·`inviteeEmail`·`inviteeImage`·`role`·`inviterName`·
`createdAt`·`invitationId`.

### 역할은 멤버 목록에서 내 userId로 가른다 (연동과 동일)

`useGetWorkspaceMembers`의 members에서 `useAuth().user.userId`와 같은 멤버의 `role`을 읽는다.
**ADMIN → 초대 폼 + 취소 버튼, MEMBER → 목록만.** 역할을 모르는 동안(로딩)이나 멤버 조회
실패 시에는 폼·취소를 그리지 않는다 — 낙관적으로 그리면 MEMBER에게 눌러 봤자 403인 폼이
보인다. `NOT_WORKSPACE_ADMIN`(403)은 최후 방어선일 뿐 UI가 미리 막는다. 이는 이미 있는
`workspace-integrations-settings`의 판별과 같은 규칙이다.

### 초대 실패는 인라인이다 (폼에 붙은 지속 상태)

초대 실패 3종은 모두 **입력값과 맞물린 지속 상태**라 토스트가 아니라 인라인이다(AGENTS 경계):
입력 테두리 destructive + 폼 아래 `Alert`. 전역 토스트는 `suppressErrorToast`로 끈다.

| 코드 | HTTP | 화면 | 프레임 |
|---|---|---|---|
| `ALREADY_WORKSPACE_MEMBER` | 409 | "이미 워크스페이스 멤버입니다." | `UOUZl` |
| `DUPLICATE_PENDING_INVITATION` | 409 | "이미 대기 중인 초대가 있습니다." (아래 대기 목록에 그 사람이 보인다) | `KOM8F` |
| `INVITEE_NOT_FOUND` | 404 | "초대할 사용자를 찾을 수 없습니다." + **대소문자 힌트** | `iHlP8` |

문구는 서버 것을 쓴다(`errorMessageOf`). **단 404만** `errorCodeOf`로 갈라 대소문자 힌트를
덧붙인다 — 서버가 초대 대상 조회에 이메일 정규화를 안 해 **가입한 사용자도 404가 될 수
있어**(대문자 섞인 주소), "가입하지 않은 사용자"로 단정하면 안 되기 때문이다. 힌트:
"철자와 대소문자를 확인해 주세요."

### mock이 실서버 envelope와 어긋나 있다 — 맞춘다

`rest-handlers.ts`의 `invitationResult`가 실패 봉투에 **`message: code`**를 넣는다. 그래서
mock에서 `errorMessageOf(error)`는 "ALREADY_WORKSPACE_MEMBER" 같은 **코드**를 보인다 — dev는
MSW로 도는데 디자인이 요구하는 한국어 문구가 안 나온다(ground-truth 위반). 실서버 봉투는
한국어 `message`를 담으므로, **mock에 초대 에러 코드→openapi3.yml 문구 맵을 넣어** 봉투를
맞춘다. 그러면 web은 목·실서버 한 코드(`errorMessageOf`)로 처리된다.

또 mock `createInvitation`은 404를 못 낸다(멤버·대기 중복만 던짐). 디자인 `iHlP8`을
재현하려면 404가 필요하다 — **대문자가 섞인 이메일이면 `INVITEE_NOT_FOUND`(404)**를 던진다.
서버의 비정규화 quirk를 그대로 흉내 내는 최소 목이다(`ponytail:` 대문자 휴리스틱, 실제
가입자 레지스트리가 생기면 교체). `INVITEE_NOT_FOUND`를 404 코드 셋에도 등록한다.

### 성공·취소 후 무효화

- 초대 생성 성공 → `invitations` 무효화(대기 목록 갱신), 폼 리셋, 인라인 에러 클리어.
  **members는 무효화 안 한다** — 초대는 수락 전까지 멤버를 늘리지 않는다.
- 취소(`DELETE`) → `invitations` 무효화. 취소 실패는 전역 토스트(폼과 무관한 mutation).

### 멤버 목록·빈 상태·로딩

- 멤버 행: 이름·이메일·역할 chip(ADMIN/MEMBER)·`joinedAt`. 내 항목엔 "나" 표시.
- members 로딩 `Skeleton`, 실패 → 인라인 오류 + 재시도(주 데이터라 토스트만으론 빈 화면).
- 대기 초대 없음 → 섹션에 "대기 중인 초대가 없습니다". invitations 로딩/실패는 그 섹션만.

## 구조

```
components/settings/members-settings.tsx  (신규) 멤버 목록 + (ADMIN) 초대 폼 + 대기 초대
components/settings/settings-dialog.tsx    (수정) SettingsSection += "members", 나브 버튼
lib/mocks/rest-handlers.ts                 (수정) INVITEE_NOT_FOUND 404 등록 + 초대 에러 메시지 맵
lib/mocks/db.ts                            (수정) createInvitation 대문자 이메일 → 404
```

`members-settings`는 `useGetWorkspaceMembers`(role) + `useGetWorkspaceInvitations` +
`useCreateWorkspaceInvitation` + `useCancelWorkspaceInvitation`으로 만든다.

## 오류 표시 — AGENTS.md 경계

| 무엇 | 어떻게 |
|---|---|
| 초대 실패(409·404) | 입력 destructive + 인라인 `Alert` (지속 상태, `suppressErrorToast`) |
| 취소 실패 | 전역 토스트(MutationCache) |
| MEMBER 열람 | 초대 폼·취소 미노출 (안내는 프레임에 없어 생략) |
| 멤버 목록 로딩/실패 | Skeleton / 인라인 오류 + 재시도 |
| 대기 초대 로딩/실패 | 섹션 Skeleton / 섹션 오류 |

## 성공 기준

- 멤버 목록(이름·이메일·역할·가입일), 내 role=ADMIN이면 초대 폼 + 대기 초대 + 취소
- MEMBER면 목록만(폼·취소 없음), 역할 로딩·실패 중엔 폼 없음
- 초대 성공 → invitations 무효화 + 폼 리셋
- 초대 실패 409/404 → 인라인 Alert(서버 문구), 404엔 대소문자 힌트
- 취소 → invitations 무효화
- mock envelope가 한국어 메시지를 담고, 대문자 이메일이 404를 낸다
- vitest: 목록, ADMIN 폼/MEMBER 숨김, 초대 mutation+무효화, 409/404 인라인, 취소
- 브라우저 실측(초대·409·취소) + 전체 검증

## 리뷰 게이트

로컬 `codex exec review --base dev` 한 번. 판단은 `docs/codex-review-app-117.md`에 남긴다.
