import { AuthCallbackClient } from "@/components/auth/auth-callback-client";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const urlError = first(query.error);
  // 이름을 server가 정한다 — OAuth2AuthenticationSuccessHandler가 `?returnTo=`로 보낸다.
  // `return_to`로 읽던 동안 값이 항상 undefined였고, 초대 링크로 로그인한 사람이
  // 초대 페이지 대신 기본 워크스페이스로 떨어졌다 (APP-400).
  const returnTo = first(query.returnTo);

  return <AuthCallbackClient urlError={urlError} returnTo={returnTo} />;
}
