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
    <PageSection className="py-12 sm:py-16">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8">
          <h1 className="font-serif font-light text-3xl sm:text-4xl text-[var(--el-ink)]">내 정보</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--el-muted)] tracking-[0.16px]">
            현재 로그인된 Google 계정 정보를 확인합니다.
          </p>
        </div>

        {user ? (
          <Card className="rounded-2xl border border-[var(--el-hairline)] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
            <CardHeader className="p-6 sm:p-8">
              <div className="flex items-center gap-4">
                <Avatar size="lg" className="size-12">
                  {user.image ? (
                    <AvatarImage
                      src={user.image}
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <AvatarFallback className="bg-[var(--el-surface-strong)] text-[var(--el-ink)] font-semibold">
                    {getUserInitial(displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <CardTitle className="truncate text-[20px] font-semibold text-[var(--el-ink)]">
                    {displayName}
                  </CardTitle>
                  <CardDescription className="truncate text-[15px] text-[var(--el-muted)]">
                    {user.email ?? "이메일 정보 없음"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 pt-0 sm:pt-0">
              <Separator className="mb-6 bg-[var(--el-hairline-soft)]" />
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-4">
                  <dt className="flex items-center gap-2 font-semibold text-[var(--el-muted)]">
                    <Hash className="size-4" />
                    사용자 ID
                  </dt>
                  <dd className="mt-2 font-mono text-[15px] text-[var(--el-ink)]">
                    {user.userId ?? "-"}
                  </dd>
                </div>
                <div className="rounded-xl border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-4">
                  <dt className="flex items-center gap-2 font-semibold text-[var(--el-muted)]">
                    <Mail className="size-4" />
                    이메일
                  </dt>
                  <dd className="mt-2 truncate text-[15px] font-semibold text-[var(--el-ink)]">
                    {user.email ?? "-"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl border border-[var(--el-hairline)] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
            <CardHeader className="p-6 sm:p-8">
              <CardTitle className="font-serif font-light text-2xl text-[var(--el-ink)]">로그인이 필요합니다</CardTitle>
              <CardDescription className="text-[15px] text-[var(--el-muted)]">
                내 정보를 보려면 Google 계정으로 로그인해 주세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 pt-0 sm:pt-0">
              <GoogleLoginButton className="items-start" />
            </CardContent>
          </Card>
        )}
      </div>
    </PageSection>
  );
}
