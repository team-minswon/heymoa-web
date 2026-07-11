# HeyMoa Web

HeyMoa의 계약 우선(contract-first) Next.js 클라이언트입니다. 서버 구현 전에도 REST와 WebSocket 계약, 생성 클라이언트, 상태 기반 mock을 함께 검증할 수 있습니다.

## Meeting note MVP 개발 흐름

### REST API

```text
openapi3.yml → pnpm orval → TanStack Query + MSW + Faker 생성 코드
```

OpenAPI 계약을 변경한 뒤 아래 명령으로 클라이언트와 REST mock을 다시 생성합니다.

```bash
pnpm orval
```

`lib/api/generated/**` 파일은 직접 수정하지 않습니다. 변경이 필요하면 `openapi3.yml` 또는 `orval.config.ts`를 수정한 뒤 다시 생성합니다.

### WebSocket API

```text
asyncapi.yml → pnpm asyncapi:validate → 수기 작성 protocol/client/MSW
```

WebSocket 메시지와 연결 수명주기는 AsyncAPI 계약으로 검증합니다.

```bash
pnpm asyncapi:validate
```

AsyncAPI는 현재 코드 생성에 사용하지 않습니다. `lib/transcription/**`의 Zod 프로토콜·브라우저 클라이언트와 `lib/mocks/**`의 MSW WebSocket 시나리오가 계약을 구현합니다.

### Mock 앱 실행

```bash
NEXT_PUBLIC_API_MOCKING=enabled pnpm dev
```

Mock 모드에서는 REST와 WebSocket 모두 브라우저에서 동작하며, 실제 마이크 대신 결정적인 PCM 입력을 사용해 실시간 전사 흐름을 재현합니다.

- 기본 mock Workspace: `http://localhost:3000/w/01K0000000000`
- 데스크톱 side Note: `?view=side&tab=transcript`
- 전체 화면 Note 정보: `?view=full&tab=details`

## 검증

```bash
pnpm test:run
pnpm asyncapi:validate
pnpm orval
pnpm format:check
pnpm lint
pnpm build
```

Spring Kotlin 서버와 OpenAI STT 연동은 이 계약과 mock MVP가 안정된 뒤 진행하는 별도 구현 단계입니다. 서버의 시간 필드는 `Instant`와 호환되는 RFC 3339 `date-time`, 공개 ID와 PK는 문자열 TSID를 사용합니다.
