# APP-186 codex 게이트 기록

`codex exec review --base feature/app-148-멤버-초대-이메일-발송-및-확대` (통합 브랜치 기준 —
APP-148은 서브이슈 → 통합 브랜치 → 마지막에 dev 방식이다). 3회차, 총 P2 9건.
반영 3, 이연 4, 반려 2. 이연은 전부 APP-187(멤버 탭·알림 벨) 몫이라 거기서 갚는다.

## R1 — 3건 P2

### 1. OAuth returnTo에 토큰 미인코딩 (invite-landing.tsx) — 반영

`/invite?token=${token}`으로 날것 보간이라 토큰에 URL 예약 문자가 있으면 로그인 복귀에서
잘린다. 실서버 토큰은 base64url이라 실제로는 안 터지지만, 웹이 서버 토큰 알파벳을 전제로
까는 결합이 문제였다. **`encodeURIComponent(token)` 한 줄.**

### 2. 토큰 수락 목이 만료·이메일 불일치를 검증 안 함 (db.ts) — 반영

`INVITATION_EXPIRED`·`INVITATION_EMAIL_MISMATCH` 메시지 맵만 있고 그 코드를 만들어내는
경로가 목에 없었다 — 에러 카드 중 NOT_FOUND 경로만 실제로 밟을 수 있었다.

**반영:** 목 시계 `mockNowMs()`(고정 기준 — 실제 시계를 쓰면 고정 시드가 세월 따라 만료돼
버린다) 기준의 `expireIfNeeded`를 공용 `resolveInvitation`에, 이메일 불일치 403은 토큰 전용
`acceptInvitationByToken`에 넣었다. 만료 지난 PENDING 시드(01K0000000026)를 추가해 dev에서
만료 카드를 직접 밟을 수 있다. 세 경로(만료·불일치·정상 리다이렉트) 브라우저 실검증.

### 3. 알림 벨 EXPIRED 라벨 없음 — 이연 (APP-187)

지적 자체는 맞다. APP-187이 정확히 "알림 벨 만료 반영"을 담당하는 이슈라 거기서 처리한다.
R2·R3에서도 같은 지적이 반복됐다 — 결정 유지.

## R2 — 3건 P2

### 1. refresh 401 계약 "회귀" — 반려, 대신 APP-371 파생

"옛 계약의 401 INVALID_REFRESH_TOKEN을 손으로 되살려라"는 지적. 두 겹으로 틀렸다:
미러 손편집은 api-data.md 위반이고, **그 401은 서버에 존재한 적이 없는 허구다**
(`git log --all -S`가 서버 전체 히스토리에서 빈 결과, 예외는 GlobalExceptionHandler의
`else -> BAD_REQUEST` 400, E2E도 400 단언, refresh는 permitAll). 새 사본이 오히려 실동작과
일치한다.

다만 이 추적이 진짜 결함을 드러냈다 — 웹의 만료 판정(refresh-failure.ts)이 서버가 절대
보내지 않는 코드를 기다려 죽은 세션을 영영 감지 못 한다. **APP-371**로 분리했다
(서버에 코드 추가가 해법 — 웹은 이미 그 코드를 기다리고 있다).

### 2. 알림 벨 EXPIRED 라벨 — 이연 (R1-3과 동일)

### 3. 토큰 수락 목에 이미-멤버 409 없음 — 반영 (가드만)

서버 계약에 검사가 있는 건 맞아서 3줄 가드를 넣었다. 단 codex 주장과 달리 dev에서 그
카드를 밟을 수 있게 되는 건 아니다 — `createInvitation`이 이미 멤버를 막고 있어
"PENDING인데 이미 멤버"는 목의 공개 API로 만들 수 없는 상태다. 목에 멤버 변동 기능이
생겨도 실서버와 갈라지지 않게 하는 보험이다.

## R3 — 3건 P2

### 1. 멤버 탭 inviteeName null 폴백 — 이연 (APP-187)

미가입자 초대 행의 이름 표시가 APP-187 "멤버 탭 미가입자 반영" 그 자체다.

### 2. 알림 벨 EXPIRED 라벨 — 이연 (세 번째 같은 지적)

### 3. "만료 판정을 토큰 수락에만 적용하라" — 반려, 사실관계 오류

서버가 accept-by-token에만 만료를 정의했다는 전제가 틀렸다. 서버는 **4개 서비스 전부**
(토큰 수락·인앱 수락·거절·취소)가 `expireIfNeeded` → `INVITATION_EXPIRED` 409를 낸다 —
APP-184에서 의도적으로 넣은 중복이다. 계약 yml 예시에 accept-by-token 쪽만 실려 있을
뿐이고, 목은 문서 예시가 아니라 실동작을 따라야 한다. 공용 `resolveInvitation` 배치가
서버와 정확히 일치한다.
