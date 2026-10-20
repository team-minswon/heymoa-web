# 현행 요약 소비 전환

- 이슈: [APP-1266](https://linear.app/minswon/issue/APP-1266)
- spec: docs `docs/app-1266/summary-consumer:projects/PRO-36-프로젝트-맥락-연결/spec/APP-1266/spec.md` @ `c32c4ac`
- 프로젝트 브랜치: 없음. 이미 배포된 APP-1267 호환 계약과 기존 dev 통합 흐름을 따른다.
- APP 브랜치: `feature/app-1266-summary-consumer` ← `dev`
- 병합: 전체 검사와 peer review 후 dev squash, main fast-forward
- 검증: `pnpm test:run && pnpm verify`

## spec 검토 결과

| 관점 | 검토 결과 |
|---|---|
| 계약 | 서버 생성 계약과 웹 생성 스키마의 description·memberships가 일치한다. 서버 a6b4c7a7 배포가 성공했다. |
| 실측 | 소비 코드에서 sentences·alsoItemIds·agendaItemId를 읽는 세 경로를 확인했다. |
| 경계 | 화면·markdown·PDF가 topicDigests를 공유하고 그래프와 상세가 별도로 소속을 읽는다. |
| 되돌리기 | 서버의 옛 필드가 유지되어 이전 웹 판으로 복구할 수 있다. 저장 데이터 변경은 없다. |
| 결정 | APP-1267에서 합의한 설명 전문과 주·보조 소속을 사용한다. 새 중심·안건 소속을 추론하지 않는다. |

## 건드리는 것

| 파일 | 변경 |
|---|---|
| `lib/notes/review/topics.ts` | 옛 회의도 description 전문을 읽는다. |
| `lib/notes/review/graph-model.ts` | memberships의 주 소속을 먼저, 보조 소속을 나중에 적용한다. |
| `components/notes/review/item-detail.tsx` | 연결 안건을 memberships로 판별한다. |
| 관련 단위·브라우저 시험과 목 | 옛 필드를 생략한 응답에서 내용·소속과 내보내기를 검사한다. |

## 순서

### 1. 소비자 전환과 회귀

- 세 소비 경로를 현행 계약으로 전환하고 구형 설명·교차 소속·중복·보조 전용 항목의 회귀를 추가한다.
- 검증: 관련 Vitest, 캐시 없는 타입 검사, 옛 API 필드 소비 검색
- 되돌리기: 변경 커밋 revert. 서버와 데이터는 바뀌지 않는다.

### 2. 배포와 마감

- 최종 검사·리뷰 후 docs spec을 먼저 병합하고 웹 dev/main을 승격한다.
- 운영 READY SHA와 결과를 APP-1267에 전달하며 옛 번들 유예는 미충족으로 남긴다.

## 마지막 관문

`pnpm test:run && pnpm verify`와 브라우저 E2E, peer review를 실행한다. 브라우저의 옛 필드 생략 응답·복사·PDF·그래프 보존을 확인하고 운영 배포 SHA를 기록한다.

## 안 하는 것

서버 옛 필드 제거, heartbeat 정책, 프로젝트 요약 생성 체인, 원문/DB 변경과 실제 모델 호출은 하지 않는다.
