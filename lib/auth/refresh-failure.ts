import { errorCodeOf } from "@/lib/api/error-message";

/**
 * 리프레시 토큰이 죽었다고 서버가 명시할 때의 코드. 원본은 heymoa-server의
 * `AppErrorType.INVALID_REFRESH_TOKEN`입니다.
 */
const INVALID_REFRESH_TOKEN_CODE = "INVALID_REFRESH_TOKEN";

/**
 * 갱신 실패가 **재로그인이 필요한 실패**인가. 아니면 일시적인 실패입니다.
 *
 * **상태 코드로 판정하지 않습니다.** 400·401을 전부 "토큰이 죽었다"로 보던 동안, 회전
 * 경쟁에서 진 요청(정상 동작이다)까지 같은 칸에 떨어져 proxy가 **막 발급된 리프레시 쿠키를
 * 지웠습니다.** 그러면 회복 경로가 사라져 재로그인 말고는 방법이 없습니다 (APP-347).
 *
 * 판정 규칙이 여기 하나뿐이어야 하는 이유가 그것입니다 — `proxy.ts`(SSR)와
 * `lib/api/fetcher.ts`(브라우저)가 서로 다르게 판정하면 한쪽만 로그아웃시킵니다.
 *
 * 봉투를 못 읽으면 **false**입니다. 죽었다는 증거가 없으면 쿠키를 살려 두고 다음 요청이
 * 다시 시도하게 둡니다 — 잘못 지우는 쪽의 대가가 훨씬 큽니다.
 */
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
