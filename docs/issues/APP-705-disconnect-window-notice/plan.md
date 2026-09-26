# 녹음 끊김 경험 — 30초 재개 창 · 알림 · 디스크 보관 제거 · 재부착 로그 — 구현 순서

- 이슈: [APP-705](https://linear.app/minswon/issue/APP-705) (PRO-51-I10·I12·I14)
- 문서: docs `main:projects/PRO-51-실시간-전사-끊김-복구/docs/` `결정.md`(D-02·03·04·05·06·10·16·17·22·24) · `state.md` · `observability.md`
- 프로젝트 브랜치: `pro-51/realtime-transcript-resilience` (af6816e, APP-704 포함)
- APP 브랜치: `feature/app-705/disconnect-window-notice` ← 프로젝트 브랜치
- 병합: 로컬 squash → 프로젝트 브랜치 push. dev·main 은 건드리지 않는다
- 검증: `pnpm test:run && pnpm verify`

## 바꾸는 자리

| 무엇 | 어디 | 결정 |
|---|---|---|
| 끊김을 알아챈 시각(`disconnectedSince`)을 하나 둔다. 소켓 닫힘·무수신·정체·reattach·offline 중 가장 이른 것. `connected` 에서 지운다. 펌프가 30초를 넘기면 캡처를 끄고 메모리 소리를 버리고 한 번 실패로 알린다. 다시 붙지 않는다 | `realtime-session.ts` | D-02·D-04 |
| 노랑: 알아챈 뒤 5초(offline 이면 곧바로), 붙은 채 max(마지막 ACK, 부착 시각)부터 10초. 컨트롤러가 `onNoticeChange` 로 알린다 | `realtime-session.ts` · `recording-connection-notice.tsx` | D-03 |
| offline: 시계와 노랑만. online: 재시도 대기 중이면 곧바로 깨운다(`reconnectReason=online`) | `realtime-session.ts` | D-24 |
| 멈추기 중 끊김 문구, 회의가 끝나 못 올린 N초 문구(폴링 MEETING_ENDED), 창 멈춤 뒤 세션을 INTERRUPTED 로 보아 [다시 녹음]을 연다, 시작 409 문구 | `recording-provider.tsx` · `recording-dock.tsx` | D-10 |
| stop 대기 11 → 25초 | `realtime-session.ts` | D-22 |
| 4분(80%) 경고·5분 문구 삭제. 한도 멈춤은 「붙어 있는데 저장이 밀림」 문구로만 남긴다 | `recording-connection-notice.tsx` | D-02 |
| 디스크 경로 삭제: `ResendBuffer` 의 store·restore·load, 컨트롤러 `resume`·`createStore`, 프로바이더의 이어 올리기 효과. 메모리 5분 유지. `audio-store.ts`·`fake-audio-store.ts` 파일은 남기고 쓰지 않는다(삭제는 따로 묻는다) | `resend-buffer.ts` · `realtime-session.ts` · `recording-provider.tsx` · `capture-config.ts` | D-05·D-06 |
| 시작 요청 본문 `{ clientInstanceId }` — STOMP 헤더와 같은 값 | `recording-provider.tsx` | D-16 |
| connect 헤더 `reconnectReason`·`disconnectedMs`·`pendingChunks`, `[transcription]` 콘솔 줄을 한 모듈에서 | `socket.ts` · `log.ts`(새) | D-17 |

## 순서

1. 기대 동작 테스트를 먼저 쓰고 빨간 것을 본다(가짜 시계): 5초·10초 노랑(`connected` 도 영수증), 30초 멈춤 한 번, online 즉시 재시도, 멈춘 뒤 연결이 돌아와도 캡처 꺼짐, 디스크 쓰기 0, 시작 본문 `clientInstanceId`, 원인별 `reconnectReason`, 알아챈 시각부터 잰 `disconnectedMs`, 콘솔 줄 순서, stop 대기 25초, 회의 종료 뒤 못 올린 N초.
2. 구현.
3. `pnpm test:run && pnpm verify`.
4. docker 재현기: 와이파이 먹통 25초(이어짐)·55초(멈춤 문구 한 번).
5. 로컬 squash → 프로젝트 브랜치 push.

## 하지 않는 것

가장 새 3초 규칙·업체 멈춤 알림 지연·전사 공백 줄(APP-706), 소리 알림, 마이크 복구, Sentry.
