# 재부착 뒤 전사 — 가장 새 3초 · 멈춤 알림 유예 · 전사 공백 줄 · 계약 반영 — 구현 순서

- 이슈: [APP-706](https://linear.app/minswon/issue/APP-706) (PRO-51-I11·I13)
- 문서: docs `main:projects/PRO-51-실시간-전사-끊김-복구/docs/` `결정.md`(D-07·09·10·15·16·23) · `state.md` · `observability.md`
- 계약: docs `contracts/specs/openapi3-server.yml`(e4cf0de 시작 본문·409 RECORDER_DISCONNECTED, 60a01ea transcriptGaps) · `asyncapi-web-server.yml`(error `reason`)
- 프로젝트 브랜치: `pro-51/realtime-transcript-resilience` (9eb3d0d, APP-705 포함)
- APP 브랜치: `feature/app-706/post-reattach-transcript` ← 프로젝트 브랜치
- 병합: 로컬 squash → 프로젝트 브랜치 push. dev·main 은 건드리지 않는다
- 검증: `pnpm test:run && pnpm verify`

## 바꾸는 자리

| 무엇 | 어디 | 결정 |
|---|---|---|
| 실시간 줄은 가장 새 3초(캡처 좌표)보다 오래 밀리지 않는다. 다시 붙을 때(rewind)와 소켓이 다시 받아 줄 때 그 앞의 안 보낸 조각은 밀린 줄로 넘긴다. 보낸 것은 다시 보내지 않는다. server 는 받은 최대보다 앞 번호를 S3 에만 쓴다 | `resend-buffer.ts` · `realtime-session.ts` | D-09 |
| 재부착 뒤·정체 해소 뒤 한 줄: `[transcription] live {after, liveLagMs, lateChunks}` | `realtime-session.ts` · `log.ts` | D-17 |
| DEGRADED 가 5초 이어질 때만 받아쓰기 멈춤 알림. LIVE 가 오면 곧바로 지운다 | `recording-provider.tsx` | D-23 |
| `transcriptGaps` 를 「받아쓰지 못했어요 · 소리는 저장됨」 줄로. 종류끼리 합치고, LOST 와 겹치는 부분은 LOST 가 이긴다(남은 조각이 1초 미만이면 버린다) | `gaps.ts` · `transcript-gap-row.tsx` · `transcript-view.tsx` · `note-archive.tsx` | D-07·D-15 |
| 계약 미러: 시작 본문·200·409 `RECORDER_DISCONNECTED`, `transcriptGaps`. `pnpm orval` 뒤 `mutationFn` 덮어쓰기 제거 | `openapi3.yml` · `lib/api/generated` · `recording-provider.tsx` | D-16 |
| error `reason`: `MEETING_ENDED` 면 폴링을 기다리지 않고 「회의가 끝나 … 못 올렸어요」로 판정. 폴링은 reason 없는 옛 server 대비로 남긴다 | `protocol.ts` · `recording-provider.tsx` | D-10 |
| 시작 409 `RECORDER_DISCONNECTED` 는 녹음자 기기 끊김 문구, `ACTIVE_TRANSCRIPTION_SESSION` 은 다른 기기 녹음 중 문구 | `recording-provider.tsx` | D-10 |

## 순서

1. 기대 동작 테스트를 먼저 쓰고 빨간 것을 본다(가짜 시계): 10초 밀림 뒤 첫 실시간 조각이 최신 3초의 시작, 3초 이하 밀림은 전부 실시간, 정체 해소도 같은 규칙, 4초 DEGRADED 알림 없음·6초 알림, 공백 줄 병합(LOST 우선), reason 판정, 409 문구 분기, 생성 훅 본문.
2. 구현.
3. `pnpm test:run && pnpm verify`.
4. docker 재현기: `web-reset`, `web-outage-25s`, 되면 `soniox-mute-30s`. 콘솔 줄과 server 부착 줄 대조.
5. 로컬 squash → 프로젝트 브랜치 push.

## 하지 않는 것

밀림 8초 이하 번호 순 보내기(D-09 버린 안), 공백 재전사 버튼(D-07).
