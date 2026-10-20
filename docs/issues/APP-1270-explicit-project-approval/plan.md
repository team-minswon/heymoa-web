# 프로젝트 추가 선택과 상세 검토 UI

- 이슈: [APP-1270](https://linear.app/minswon/issue/APP-1270)
- spec: docs `docs/app-1270/explicit-project-approval:projects/PRO-48-명제-관계-온톨로지-재정립/spec/APP-1270/spec.md` @ `f7c4756c4dd0b0a14cfc2477cd85e1dfec990bc6`
- 프로젝트 브랜치: 없음
- APP 브랜치: `feature/app-1270/explicit-project-approval` ← `dev`
- 병합: APP → dev squash
- 검증: `pnpm test:run && pnpm verify`, 저장소 추가 관문 `pnpm test:e2e`

이 문서는 사용자와 실제 페이지를 보며 확정한 구현 순서와 통합 관문을 정리한다.

## spec 검토 결과

| 관점 | 확인 결과 |
|---|---|
| 계약 | APP-1269 생성 계약의 `projectSelected`와 `projectSelectionConfirmed`를 소비한다. 회의록의 `included`는 별도로 유지한다. |
| 실측 | 상태별 갤러리는 실제 노트 경로와 MSW를 사용한다. 실제 서버·운영 배포 검증으로 취급하지 않는다. |
| 경계 | ReviewRow, 승인 개수·차단 조건, 낙관적 저장·복구, MSW, 랜딩 시연을 함께 갱신한다. |
| 되돌리기 | 웹 커밋을 되돌릴 수 있으나 새 서버는 옛 화면의 승인을 거절한다. 서버·웹 배포 순서를 맞춘다. |
| 사용자 결정 | 기본 OFF 추가 스위치, 대체/유지, 제외 유지, 짧은 관계 이름, 역순 수정이력과 모바일 본문 우선 배치를 확정했다. |

## 건드리는 것

| 경로 | 변경 |
|---|---|
| `openapi3.yml`, `lib/api/generated/` | 서버 생성 계약 동기화와 Orval 재생성 |
| `lib/notes/review/` | 프로젝트 대상 판별, 승인·제안 집계, 선택 저장 복구, 수정이력 정렬 |
| `components/notes/review/` | 추가 스위치, 대체 결과 목록, 수정·제외 조작, 연결 목록, 모바일 상세 표시 |
| `lib/mocks/`, `components/mocks/review-showcase.tsx` | 실제 페이지에서 선택·실패·충돌·완료 상태 재현 |
| `components/heymoa/landing/` | 명시적 선택 후 최종 승인 흐름 설명 |
| 관련 단위 테스트, `e2e/meeting-review.spec.ts` | 기본 미선택, 일부 선택, 복구와 기존 흐름 회귀 확인 |

## 순서

### 1. 계약과 프로젝트 대상 판별

- 서버 계약을 동기화하고 생성 훅·모델을 재생성한다.
- 포함 여부와 프로젝트 선택을 분리하고 승인 집계·저장 복구·MSW에 같은 조건을 적용한다.
- 관련 selector·patch·MSW 단위 테스트로 확인한다.

### 2. 검토 조작과 상세 목록

- 기존 화면 구조와 공용 스위치·ChoiceToggle을 사용한다.
- 선택된 항목의 제안, 대체/유지 결과, 수정·제외 및 상세 목록을 구현한다.
- 컴포넌트 테스트와 실제 브라우저의 넓은 화면·390px 모바일에서 확인한다.

### 3. 소개 문구와 통합

- 소개 페이지의 설명을 선택 후 검토 완료 흐름으로 맞춘다.
- 전체 검증과 Codex 리뷰 후 spec을 docs main에 반영하고 웹을 dev에 squash한다.
- 운영 배포와 서버 마이그레이션 적용은 별도 작업이다.

## 마지막 관문

`pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e`를 확인한다. 실패 항목을 재실행한 결과는 최초 실행과 구분한다. `codex exec review --base dev`에서 P1·P2를 처리한 뒤 통합한다. 기준 dev가 바뀌면 통합 결과를 다시 검증·리뷰한다.

## 안 하는 것

서버 승인 정책 변경, AI 관계 판정 변경, 그래프 배치 변경, 일괄 선택, 완료 후 재승인, 운영 배포는 포함하지 않는다.
