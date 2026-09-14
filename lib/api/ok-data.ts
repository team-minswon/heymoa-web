type OkPayload<R> = Extract<R, { status: 200 }> extends { data: { data?: infer D } } ? NonNullable<D> : never;

/**
 * 생성 훅 응답에서 성공한 본문만 꺼낸다. 200 이 아니거나 봉투가 실패면 `null` 이다 — 화면은 있다 · 없다만
 * 가르고, 왜 없는지(불러오는 중 · 실패)는 쿼리 상태가 말한다.
 */
export function okData<R extends { status: number; data: unknown }>(
  response: R | undefined
): OkPayload<R> | null {
  if (response?.status !== 200) return null;
  const body = response.data as { success?: boolean; data?: unknown } | null;
  return body?.success ? (body.data as OkPayload<R>) : null;
}
