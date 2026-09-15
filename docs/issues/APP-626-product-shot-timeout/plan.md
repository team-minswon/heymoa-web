# product-shot fake timer 테스트 시간 제한 — 구현 순서

- 이슈: [APP-626](https://linear.app/minswon/issue/APP-626)
- spec: docs `main:projects/_미분류/APP-626/spec.md`
- APP 브랜치: `fix/app-626/product-shot-timeout` ← `dev` (2af26e3). 프로젝트 브랜치 없음
- 병합: 로컬 squash → `dev` push → `main` ff push
- 검증: `pnpm test:run` 반복 + `pnpm verify`

## 판정 — 무한 대기가 아니라 실행 지연

`components/heymoa/landing/product-shot.test.tsx` 는 가짜 시계로 대본 한 바퀴(90초)를 `act` 1500번으로 돌린다. 대본이 `setTimeout` 체인이라 한 `act` 에 타이머가 하나만 진행되고(효과가 `act` 끝에 돌아 다음 타이머를 건다), 좁은·넓은 화면 두 벌이 매번 렌더된다. 혼자 돌면 무거운 테스트가 0.6초지만 다른 vitest 전체 실행과 나란히 돌리니 1.7초, server·AI 회귀 검사까지 겹치면 기본 제한 5초를 넘긴다. 같은 재발이 09-04 에 있었다(STEP 20→60ms, cbd17df).

기다림은 전부 상한이 있다. `play(n)` 은 걸음 수가 정해져 있고 `playUntil` 은 1500걸음 뒤 거짓을 돌려줘 `expect(...).toBe(true)` 가 잡는다.

## 건드리는 것

| 파일 | 변경 |
|---|---|
| `product-shot.test.tsx` | `vi.setConfig({ testTimeout: 20_000 })` 파일 단위(전역은 안 올린다 — 다른 파일의 진짜 멈춤을 가린다). `playUntil` 이 상한에서 거짓으로 끝남을 단언하는 도우미 테스트 1건. 「레일을 만져 뒀어도」의 조건 없는 `play()` 1500걸음을 답이 서는 순간까지의 `playUntil` 로 |

대본(`use-demo.ts`)·화면은 안 건드린다(이슈 「안 하는 것」).

## 순서

1. 도우미 테스트로 유한성 단언 → 파일 timeout → `play()` 교체.
2. 다른 vitest 전체 실행과 나란히 돌려 시간 기록 → 반복 실행 → `pnpm verify`.
