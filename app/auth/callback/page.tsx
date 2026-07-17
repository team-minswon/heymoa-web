"use client";

import dynamic from "next/dynamic";

import AuthCallbackLoading from "@/app/auth/callback/loading";

const ClientAuthCallback = dynamic(
  () =>
    import("@/components/auth/auth-callback-client").then(
      (module) => module.AuthCallbackClient
    ),
  {
    loading: AuthCallbackLoading,
    ssr: false,
  }
);

export default function AuthCallbackPage() {
  return <ClientAuthCallback />;
}
