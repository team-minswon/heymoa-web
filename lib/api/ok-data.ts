type OkPayload<R> = Extract<R, { status: 200 }> extends { data: { data?: infer D } } ? NonNullable<D> : never;

export function okData<R extends { status: number; data: unknown }>(
  response: R | undefined
): OkPayload<R> | null {
  if (response?.status !== 200) return null;
  const body = response.data as { success?: boolean; data?: unknown } | null;
  return body?.success ? (body.data as OkPayload<R>) : null;
}
