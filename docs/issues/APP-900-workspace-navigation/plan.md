# 목록 화면 이동의 조회 대기 제거

- 이슈: [APP-900](https://linear.app/minswon/issue/APP-900)
- spec: docs `docs/app-900/workspace-navigation:projects/_미분류/APP-900/spec.md` @ `164163d` (최종 링크 선택 시점 반영)
- 프로젝트 브랜치: 없음. 기존 APP-884와 같은 미분류 탐색 버그입니다.
- APP 브랜치: `fix/app-900/workspace-navigation` ← 로컬 dev `369717a` (APP-899 반영 뒤 rebase)
- 병합: 부모 조율까지 로컬 커밋만 보존합니다. 웹 원격 push·PR은 금지합니다.
- 검증: `pnpm test:run && pnpm verify`와 `pnpm test:e2e`

## spec 검토 결과

| 관점 | 확인한 근거 |
| --- | --- |
| 계약 | AllTasks가 기존 workspace tasks 생성 훅을 사용하며 OpenAPI 변경이 없습니다. |
| 실측 | 운영 클릭 후 이전 화면 유지 관찰만 있으며 정확한 운영 ms는 주장하지 않습니다. |
| 경계 | shared SSR prefetch를 유지하고 sidebar의 프로젝트 삭제 후 선택 해제를 보존합니다. |
| 되돌리기 | API와 저장 데이터 변경 없이 로컬 구현 커밋으로 복구합니다. |
| 결정 | 사용자 요청 범위는 탐색 버그 수정·로컬 검증이며 부모가 좁힌 설계를 수락했습니다. |

## 건드리는 것

task page의 불필요한 HydrationBoundary와 죽은 task prefetch를 제거합니다. sidebar Link가 route 이동을 담당하고 shell은 선택 상태만 소유합니다. 현재 목록의 프로젝트 필터는 버튼으로 유지합니다. Link pending은 설치된 Next의 useLinkStatus로 표시합니다.

## 순서

1. 조회 대기와 중복 navigation 제거: route와 sidebar/shell 경계를 수정하고 해당 단위 테스트를 실행합니다.
2. 느린 응답·실패·왕복·키보드 이동: 실제 생성 훅/브라우저 mock 경로에서 E2E를 실행합니다.
3. 전체 게이트와 적대적 리뷰: 단위·lint·typecheck·build·E2E 후 변경 범위 리뷰를 실행하고 지적을 수정합니다.

## 마지막 관문

변경 완료 뒤 검증 명령 전체를 실행합니다. 부모의 작업과 포트를 공유하지 않습니다. 결과·커밋·남은 운영 측정 범위를 Linear에 기록합니다.

## 안 하는 것

공유 dev 편집·원격 웹 push·PR·배포·SQL 변경·새 loading layout·지연 타이머는 하지 않습니다.
