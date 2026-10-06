# 긴 전사 렌더링 검증

조사일: 2026-10-06

종료된 전사는 전체 조회·캐시를 유지하며 긴 목록의 DOM만 가상화합니다. 검색은 받은 전체 전사 데이터에서 실행합니다. 전체 텍스트 보기에서는 브라우저 검색과 긴 범위 선택을 지원하며 전체 렌더 비용이 남습니다.

## 큰 데이터 재현

```sh
pnpm install --frozen-lockfile
NEXT_PUBLIC_API_MOCKING=enabled NEXT_PUBLIC_TRANSCRIPT_EXPERIMENT=enabled pnpm build
pnpm start --port 3102
# 별도 터미널
node scripts/experiment-transcript.mjs
```

MSW 합성 8,114행·세 세션·공백·가변 길이·화자 지정 상태를 사용합니다. 운영 원문·인증 정보는 복제하지 않습니다. 결과는 `/tmp/transcript-virtual-experiment`에 저장합니다.

전체 렌더 대조 빌드는 `NEXT_PUBLIC_TRANSCRIPT_VIRTUALIZATION=disabled`를 추가합니다. `MEASURE_ONLY=true EXPERIMENT_LABEL=baseline` 또는 `virtual`로 실행하면 초기 렌더를 각각 세 번 측정합니다. 측정은 JSON 파싱 완료부터 DOM 삽입 감지·두 animation frame까지이며 HTTP·초기 JS·운영 기기 INP는 포함하지 않습니다.

검증 스크립트는 인용·화자 지정·보기 전환·전체 복사·검색/선택·지연 재조회·빠른 스크롤·모바일 폭 조합을 확인합니다. 브라우저 기본 검색창 자체와 Safari/스크린리더는 별도 확인이 필요합니다. 상세 조건·측정 결과의 정본은 docs 저장소 `projects/PRO-55-데스크톱-회의-사운드-캡처/spec/APP-910/docs/measurement-plan.md`입니다.

일반 빌드는 위 mock 환경변수를 설정하지 않습니다. 기존 검사 명령은 `pnpm test:run`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test:e2e`입니다.
