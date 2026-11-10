# APP-1547 실시간 소켓을 연결 티켓으로 여는 클라이언트

설계: docs `projects/PRO-74-server-안정화와-구조-정리/spec/APP-1546/spec.md` 의 web 절.

## 바꾸는 것

- `lib/api/realtime-ticket.ts` — `ticketedSocketUrl(url, timeoutMs)`. `POST /v1/realtime/tickets` 를 `apiFetch` 로 부른다.
  - 성공: `<url>?ticket=<encodeURIComponent(ticket)>`
  - 401: fetcher 가 갱신 뒤 다시 받는다. 갱신 토큰까지 만료면 게이트가 열리고 `null`.
  - 그 밖의 실패(망·404·5xx·시한): 티켓 없는 `url`(쿠키 이행 경로). 던지지 않는다.
- 녹음 소켓(`lib/transcription/socket.ts`)·노트 토픽(`lib/notes/note-topic-client.ts`)은 `beforeConnect` 에서 시도마다 부르고 `client.brokerURL` 을 바꾼다.
  - 녹음: `null` 이면 소켓을 열지 않고 `SessionExpiredError` 로 끝낸다. 재부착 루프는 그것을 보고 창을 기다리지 않고 닫는다.
  - 노트: `null` 이면 지금처럼 쿠키 주소로 재시도한다.
- APP-1543 `refresh-before-reconnect.ts` 와 `SocketHandshakeError` 를 지운다(티켓 요청이 401 을 보므로 「못 붙었을 때만 갱신」이 필요 없다).
- `asyncapi.yml` 연결 설명을 티켓으로 바꾼다.

## 시험

- `lib/api/realtime-ticket.test.ts`: 시도마다 새 티켓, 401→갱신 후 티켓, 만료→게이트·null, 404·5xx·망 오류·시한→티켓 없는 주소.
- 두 소켓 시험: 시도마다 새 주소, 만료 처리. `realtime-session.test.ts`: 만료면 닫고, 그 밖의 실패는 재시도.
- `pnpm test:run && pnpm verify`.

## 배포

server(APP-1546) → web. server 가 없거나 되돌려져도 티켓 요청이 404 로 실패해 쿠키로 붙는다.
