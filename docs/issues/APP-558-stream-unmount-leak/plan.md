# 채팅 스트림 언마운트 누수 — 구현 순서

- 이슈: [APP-558](https://linear.app/minswon/issue/APP-558)
- spec: docs `main:projects/_미분류/APP-558/spec.md`
- APP 브랜치: `fix/app-558/stream-unmount-leak` ← `dev` (2af26e3). 프로젝트 브랜치 없음
- 병합: 로컬 squash → `dev` push → `main` ff push
- 검증: `pnpm test:run` 연속 5회(이슈 완료 기준) + `pnpm verify`

## 원인 판정 — 테스트가 아니라 제품 코드

`lib/chat/use-chat-stream.ts` 의 언마운트 정리가 `controllerRef.abort()` 만 하고 `runIdRef` 를 안 올렸다. 버려진 루프는 abort 로 끊긴 EOF 를 재연결 신호로 읽어 백오프 시간표 여섯 칸(1·2·4·8·15·15초)을 서버에 다시 붙는다. `personal-chat.test.tsx` 는 스트림을 붙잡은 채 끝나는 테스트가 열 개고, 각각의 +1초·+3초 재연결이 뒤 테스트가 공유하는 `state.resumeUrls` 목에 섞여 들어가 「B에 들렀다 A로」의 URL 수 2가 5로 보였다. 단독 실행은 파일이 1초대에 끝나 첫 재연결이 파일 종료 뒤에 떨어지므로 안 보인다.

실제 앱에서도 같은 누수다. `PersonalChatProvider` 는 `workspace-app-shell` 에 살아 워크스페이스를 떠날 때 내려가고, 그 뒤 최대 45초 동안 배경에서 SSE 를 다시 연다.

## 건드리는 것

| 파일 | 지금 | 뒤 |
|---|---|---|
| `lib/chat/use-chat-stream.ts` | `reset` 이 runId·stop·running·idle 을 손수 정리, 언마운트는 abort 만 | `discard`(runId 올림 → abort → 백오프 깨움 → 손잡이 비움 → idle 정리) 하나를 `reset` 과 언마운트가 같이 쓴다 |
| `lib/chat/use-chat-stream.test.ts` | 언마운트 케이스 없음 | 「언마운트하면 백오프가 다 지나도 다시 붙지 않는다」·「흐르는 중 언마운트는 연결을 끊고 그 EOF 로도 안 붙는다」 |

`personal-chat.test.tsx` 는 안 고친다 — 원인이 제품 코드라 그쪽이 고쳐지면 목 오염이 사라진다. `useChatStream` 의 소비자는 `PersonalChatProvider` 하나이고 다른 SSE 재연결 루프는 레포에 없다(`getEventStream` 사용처 = 이 훅뿐).

## 순서

1. 훅 테스트 둘을 먼저 써서 빨간 것을 본다(언마운트 뒤 연결 3개).
2. `discard` 로 초록.
3. `pnpm test:run` 5회 연속 + `pnpm verify`.
