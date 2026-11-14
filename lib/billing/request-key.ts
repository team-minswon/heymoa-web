/**
 * 명령 하나(구매 시작·해지·재개)의 requestKey. **사용자의 한 번의 의도마다 하나**다 — 네트워크 실패 뒤 같은 버튼을 다시 눌러도
 * 같은 키가 나가서 서버가 같은 등록을 돌려주고, 성공했거나 화면이 본 상태가 바뀌었으면 `renew()` 로 새 키를 쓴다
 * (같은 키에 다른 본문은 409 `REQUEST_KEY_CONFLICT` 다).
 */
export function createRequestKey() {
  let key: string | null = null;
  return {
    current() {
      key ??= crypto.randomUUID();
      return key;
    },
    renew() {
      key = null;
    },
  };
}
