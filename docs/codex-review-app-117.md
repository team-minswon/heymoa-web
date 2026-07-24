# APP-117 codex 리뷰 판단

로컬 `codex exec review --base dev` 3라운드. 마지막 라운드 clean(무findings)로 게이트 통과.

## 반영한 지적

- **[R1 P2] 초대 목록 ADMIN 게이트** — `useGetWorkspaceInvitations`는 ADMIN 전용
  엔드포인트라 MEMBER가 열면 403+재시도가 쌓인다. `enabled: canManage`로 역할이 ADMIN으로
  확정된 뒤에만 조회한다. (반영)
- **[R1 P2] 제출 잠금 유지** — 초대 성공 후 `create.isPending`이 무효화 완료 전에 false로
  풀려, 폼에 남은 같은 이메일이 중복 제출될 수 있었다(409). 제출~리셋 구간을 `isSubmitting`
  으로 잠근다. (반영)
- **[R2 P2] 이메일 수정 시 stale 오류 해제** — 실패 후 주소를 고치면 지난 서버 오류와
  destructive 스타일이 새 값에 붙어 있었다. 이메일 onChange에서 `inviteError`를 지운다. (반영)
- **[R2 P2] 클라 검증 aria-invalid** — zod가 빈/잘못된 이메일을 막을 때 `aria-invalid`가
  false였다(AT에 잘못된 유효성 전달). 조건에 `form.formState.errors.email`을 더한다. (반영)

## 판단

R3는 findings 없음. codex 샌드박스가 보고한 test/build 실패는 그 환경의 MSW 생성물 누락·
Google Fonts 네트워크 차단 때문으로, 코드 결함이 아니다 — 로컬에서 `pnpm test:run`(365)·
`pnpm build`·`pnpm test:e2e`(10) 전부 통과했다.

## 곁들인 mock 정합성

`invitationResult`가 실패 봉투에 `message: code`를 넣어 dev(MSW)에서 `errorMessageOf`가
코드를 노출하던 것을, 코드→openapi3.yml 한국어 메시지 맵으로 실서버 봉투와 맞췄다.
`createInvitation`은 대문자 섞인 이메일에 `INVITEE_NOT_FOUND`(404)를 던져 서버 비정규화
quirk를 재현한다(design frame `iHlP8`).
