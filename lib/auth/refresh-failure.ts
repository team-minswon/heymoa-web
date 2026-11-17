import { errorCodeOf } from "@/lib/api/error-message";

const INVALID_REFRESH_TOKEN_CODE = "INVALID_REFRESH_TOKEN";

/** 상태 코드로 판정하지 않습니다 — 회전 경쟁에서 진 정상 요청도 400·401 이라 막 발급된 리프레시 쿠키를 지우게 됩니다. 봉투를 못 읽으면 false 입니다. */
export async function isRefreshTokenDead(response: Response) {
  if (response.ok) {
    return false;
  }

  try {
    return errorCodeOf(await response.json()) === INVALID_REFRESH_TOKEN_CODE;
  } catch {
    return false;
  }
}
