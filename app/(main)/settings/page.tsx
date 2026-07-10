import type { Metadata } from "next";
import { Hash, Mail } from "lucide-react";

import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { PageSection } from "@/components/heymoa/primitives";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getCurrentUserForSsr } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "내 정보",
  alternates: {
    canonical: "/settings",
  },
  robots: {
    index: false,
    follow: false,
  },
};

function getUserInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "U";
}

export default async function SettingsPage() {
  const user = await getCurrentUserForSsr();
  const displayName = user?.name ?? user?.email ?? "사용자";

  return (
    <PageSection className="py-10 sm:py-14">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">내 정보</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--clay-muted)]">
            현재 로그인된 Google 계정 정보를 확인합니다.
          </p>
        </div>

        {user ? (
          <Card className="rounded-2xl bg-[var(--clay-surface-card)] shadow-none">
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar size="lg" className="size-12">
                  {user.image ? (
                    <AvatarImage
                      src={user.image}
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <AvatarFallback className="bg-[var(--clay-brand-mint)] text-[var(--clay-primary)]">
                    {getUserInitial(displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <CardTitle className="truncate text-xl">
                    {displayName}
                  </CardTitle>
                  <CardDescription className="truncate">
                    {user.email ?? "이메일 정보 없음"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Separator className="mb-4" />
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--clay-hairline)] bg-[var(--clay-canvas)] p-4">
                  <dt className="flex items-center gap-2 font-semibold text-[var(--clay-muted)]">
                    <Hash className="size-4" />
                    사용자 ID
                  </dt>
                  <dd className="mt-2 font-mono text-base text-[var(--clay-primary)]">
                    {user.id}
                  </dd>
                </div>
                <div className="rounded-2xl border border-[var(--clay-hairline)] bg-[var(--clay-canvas)] p-4">
                  <dt className="flex items-center gap-2 font-semibold text-[var(--clay-muted)]">
                    <Mail className="size-4" />
                    이메일
                  </dt>
                  <dd className="mt-2 truncate text-base font-semibold text-[var(--clay-primary)]">
                    {user.email ?? "-"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl bg-[var(--clay-surface-card)] shadow-none">
            <CardHeader>
              <CardTitle>로그인이 필요합니다</CardTitle>
              <CardDescription>
                내 정보를 보려면 Google 계정으로 로그인해 주세요.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GoogleLoginButton className="items-start" />
            </CardContent>
          </Card>
        )}
      </div>
    </PageSection>
  );
}
