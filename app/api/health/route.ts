import { NextResponse } from "next/server";

/**
 * 컨테이너 health check.
 *
 * **여기서 API 서버에 닿지 않는다.** compose가 web을 healthy로 볼 조건은 「Next가 요청을
 * 받는다」뿐이다. 서버 상태까지 섞으면 web이 server를 기다리고 server가 web을 기다리는
 * 구성에서 둘 다 안 뜨거나, server가 잠깐 흔들릴 때 web 컨테이너가 재시작된다.
 *
 * `/`를 health로 쓰면 안 되는 이유도 같다 — 랜딩은 SSR에서 유저를 조회하므로 server가
 * 없으면 실패한다.
 *
 * proxy는 쿠키 없는 요청을 그대로 통과시키므로 이 경로가 토큰 갱신을 타지 않는다.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok" });
}
