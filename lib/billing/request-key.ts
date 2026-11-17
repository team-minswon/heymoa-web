/** 사용자의 한 번의 의도마다 하나입니다. 같은 키에 다른 본문은 409 `REQUEST_KEY_CONFLICT` 입니다. */
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
