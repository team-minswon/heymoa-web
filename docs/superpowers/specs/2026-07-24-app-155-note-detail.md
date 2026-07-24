# APP-155 노트 상세 재디자인 설계

**목표:** 노트 상세(전사·요약·정보 탭)를 v5 프레임에 맞춘다 — 제품 면 대문자 키커 제거, 전사 행 밀도 단일화, 읽기 폭 통일. side 시트 열림 방식은 계승. 레코더 독 모션 불변.

**입력:** 프레임 `Ftvu9`(전사)·`m0eVmx`(요약)·`AB8zp`(정보)·side `oLmGL/viNgv/KCoyt`, FORM SPEC, 현재 `transcript-view`·`note-summary`·`note-details`.

**범위 밖:** 우측 챗봇 트레이 내부(APP-156), 계약, 레코더 독(계승 — 건드리지 않음).

## 자문자답으로 잡은 것

### 제품 면 대문자 키커가 탭마다 남아 있다 (FORM SPEC 위반)

실측: 세 탭 모두 대문자 키커 + 세리프 제목의 잡지 조판이 있다 — 탭이 이미 위치를 말하는데 중복이다.

- `transcript-view`: `Conversation`(활성 시 상태 라벨) 키커 + 세리프 `대화 기록`. Ftvu9는 키커·제목 없이 전사 행이 바로 시작한다. → **헤더 블록 제거.** 활성 상태는 상단바·레코더 독이 이미 말한다.
- `note-summary` `AnalyzingSkeleton`: `Analyzing` 키커. → 제거(세리프 `회의를 정리하고 있습니다`는 유지). `SummarySections`는 이미 한글 세리프 섹션 제목(개요·액션 아이템·인사이트)이라 SPEC 준수 — 유지(프레임 m0eVmx의 대문자 OVERVIEW/ACTION ITEMS/INSIGHTS는 잔재).
- `note-details`: `Note details` 키커. → 제거(세리프 `노트 정보` 유지).

### 전사 행 밀도가 반응형으로 갈라져 있다

실측: 행 grid가 `grid-cols-[58px_1fr] gap-4 sm:grid-cols-[66px_1fr] sm:gap-6`로 폭마다 timecode 열·gap이 달라진다. v4 감사의 "6/7/8/10 갈라짐"과 같은 종류다. → **단일 값 통일:** timecode 64 · gap 20(`gap-5`) · 세로 padding `py-4` 단일. 본문은 `text-read`(15) 토큰. (근거: APP-152 plan "타임코드 64 + gap 20 + 본문 780".)

### 읽기 폭이 탭마다 다르다

`transcript`·`summary`는 `max-w-[820px]`, `details`는 `max-w-3xl`(768). → **820 컨테이너로 통일.** transcript 본문의 중복 `max-w-3xl`도 제거(컨테이너가 폭을 정한다).

### note-details 카드가 마케팅 단일 티어 그림자를 쓴다

`rounded-2xl … shadow-[0_4px_16px_rgba(0,0,0,0.03)]` — ELEVATION SPEC상 카드 안의 카드는 그림자 금지·hairline만. → `rounded-block` + hairline, 그림자 제거(153 토큰 채택).

### side 시트

탭 컴포넌트를 full·side가 공유하므로 위 변경이 side에도 그대로 반영된다. 시트 열림 방식·헤더는 계승(APP-154에서 side 헤더 유지). side는 2탭(전사·정보), 우측 트레이 없음 — 현행 유지.

## 완료 조건

- [ ] 세 탭에 대문자 키커 없음, 세리프 제목만 유지
- [ ] 전사 행 grid가 단일 값(timecode 64·gap 20·py 단일), 본문 `text-read`
- [ ] 읽기 폭 820으로 통일
- [ ] 레코더 독 모션 회귀 없음(폭 전환 시 알약 안 일그러짐 — 코드 불변)
- [ ] 컴포넌트 테스트, 게이트, `codex exec review --base dev` P1 없음, Playwright full·side 대조

## 링크
- 이슈: https://linear.app/minswon/issue/APP-155
- 근거: `docs/design/v5-spec-notes.md`(FORM SPEC), 프레임 Ftvu9·m0eVmx·AB8zp
