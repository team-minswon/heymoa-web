# APP-162 노트 허브 목록 행 flat 재구성 + 필터 칩 설계

**목표:** 노트 허브 목록을 v4 흰 카드에서 FORM SPEC "목록 행 정본"(flat 52·아이콘+제목+상대시각)으로, 필터를 `전체`·`내가 시작`으로. 프레임 LHXhy 대조. 계약 불변.

**입력:** 프레임 `LHXhy`·`cWU64`, FORM SPEC 목록 행 정본, 현재 `note-list-row`·`workspace-note-list`·`workspace-page`.

**범위 밖:** 계약 변경(상태 배지·`녹음 중` 필터 안 만듦 — 목록 계약에 `meetingStatus` 없음), 다른 화면.

## 자문자답으로 잡은 것

### 목록 행이 흰 카드다 (drift #1)

실측: `note-list-row`가 `min-h-[64px] rounded-2xl bg-white/55 hover:shadow-[0_8px_24px…]` 카드에 세리프 `text-xl` 제목 + 프로젝트 배지 + 우측 절대시각+녹음시간. FORM SPEC 정본: **높이 52 · 한 줄 · `rounded-control`(8) · 배경 없음 · 행 사이 hairline · gap 14 · 파일 아이콘 + 제목 15(`text-read`) + (우측) 상대 시각. 카드·그림자·배지 없음.** → 카드 걷어내고 flat 행으로. 세리프 제목→`text-read`, 배지·녹음시간·절대시각 제거, 우측은 상대 시각 하나. 녹음 중이면 파일 아이콘 자리에 미터(라이브 상태는 유지).

### 프레임 LHXhy는 날짜 그룹 없이 flat 최근순이다

현재는 `groupNotesByDate`로 날짜 헤더 + separator를 그린다. LHXhy는 날짜 헤더 없이 **최근순 flat 목록** + 필터 칩 + "최근 순"이다. → 날짜 그룹 제거, `updatedAt` 내림차순 단일 목록에 행 사이 hairline. `groupNotesByDate`와 그 테스트는 제거.

### 상대 시각은 하이드레이션 안전하게

상대 시각("방금/14분 전/어제…")은 `now`가 필요해 SSR/클라 시각 차로 하이드레이션이 어긋난다(AGENTS.md 렌더타임 now 금지). → 순수 `formatRelativeTime(iso, now)`(테스트) + `RelativeTime` 클라 컴포넌트가 **마운트 후** `now`를 채운다. SSR·첫 렌더는 짧은 절대 날짜 fallback으로 동일 → 불일치 없음, 마운트 후 상대 시각으로 교체.

### 필터는 전체·내가 시작 두 개

`workspace-page`에 칩 두 개. `내가 시작` = `meetingStartedBy?.userId === user.userId`(`useAuth`). `녹음 중` 필터는 목록에 `meetingStatus`가 없어 안 만든다(FORM SPEC·APP-159 취소). 정렬은 최근순 고정(별도 컨트롤 없이).

## 구현 (파일)

- `lib/format/relative-time.ts`(신규) + 테스트 — 순수 포매터.
- `note-list-row.tsx` — flat 52 행(파일 아이콘/미터 + 제목 15 + `RelativeTime`), 카드·배지·녹음시간 제거. 메뉴(전체 화면 열기) 유지.
- `workspace-note-list.tsx` — 날짜 그룹 제거, 최근순 flat + 행 사이 hairline. 빈 상태 카드 그림자 정리(153 토큰).
- `workspace-page.tsx` — 필터 칩 `전체`·`내가 시작`, `useAuth`로 판별.

## 완료 조건

- [ ] 행 flat 52·r8·아이콘+제목 15+상대시각(카드/배지/그림자 없음), LHXhy 대조
- [ ] 날짜 그룹 없이 최근순 flat + 행 사이 hairline
- [ ] 필터 `전체`·`내가 시작`(meetingStartedBy)
- [ ] `formatRelativeTime` + 목록/행 컴포넌트 테스트
- [ ] 게이트·`codex exec review --base dev` P1 없음·Playwright LHXhy 대조

## 링크
- 이슈: https://linear.app/minswon/issue/APP-162
- 근거: FORM SPEC 목록 행 정본, 프레임 LHXhy·cWU64
