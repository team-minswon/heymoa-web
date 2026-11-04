# errors — web 자체 오류 문구

## 코드 리뷰 (codex, 1차 — 뼈대 커밋)

- [P2][local] 녹음 오류(`lib/transcription/recording-messages.ts`)와 채팅 fallback(`lib/chat/use-chat-turn.ts`)이 아직 한국어 — **반영 예정**: plan 7(채팅)·11(녹음) 단계에서 같은 `errors`/`recording` 이름공간으로 옮깁니다. 이 커밋은 fetcher·토스트 fallback·판 충돌만 옮긴 뼈대입니다
- P1 0건

## 문구 평가

plan 12단계에서 이름공간을 다 채운 뒤 매깁니다.

## 한국어에서 바뀐 문장

| 키 | 전 | 후 |
|---|---|---|
| serverUnavailable | 서버에 잠시 연결할 수 없습니다. 잠시 후 다시 시도해 주세요. | 지금 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요. |
