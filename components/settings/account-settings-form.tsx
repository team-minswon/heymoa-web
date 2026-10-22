"use client";

import { useState } from "react";

import { PersonAvatar } from "@/components/heymoa/person-avatar";
import { SitePageLink } from "@/components/heymoa/site-page-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { SettingsHeader } from "@/components/settings/settings-layout";
import { isAnalyticsOptedOut, setAnalyticsOptOut } from "@/lib/analytics/track";
import { useGetCurrentUserSuspense } from "@/lib/api/generated/users/users";

export function AccountSettingsForm() {
  const response = useGetCurrentUserSuspense().data;
  if (response.status !== 200 || !response.data.success) {
    throw new Error("계정 정보를 불러오지 못했습니다.");
  }
  const user = response.data.data;

  return (
    <div className="mx-auto max-w-2xl space-y-8" aria-label="내 계정 설정">
      <Header />
      <div className={PROFILE_CARD}>
        <PersonAvatar
          name={user.userId}
          image={user.image}
          alt={`${user.name} 프로필`}
          size={56}
        />
        <div className={FIELD}>
          <Label htmlFor="account-email">이메일</Label>
          <Input id="account-email" value={user.email} disabled />
        </div>
      </div>
      <div className={NAME_CARD}>
        <Label htmlFor="account-name">계정 이름</Label>
        <Input
          id="account-name"
          value={user.name}
          disabled
          aria-describedby="account-name-hint"
        />
        {/* 계정 이름은 로그인한 계정에서 와 여기서 못 고친다. 고칠 길이 어디 있는지만 한 줄로 알린다(APP-1206). */}
        <NameHint id="account-name-hint" />
      </div>
      <AnalyticsConsentCard />
    </div>
  );
}

/**
 * 「이용 통계 보내기」 — 개인정보 처리방침 5조에 거부 방법으로 적혀 있다(APP-1068). 문구를 바꾸면 그 조항도 같이 고친다.
 *
 * 계정 조회와 상관없는 고정 카드라 스켈레톤에도 그대로 세운다(도착할 때 아래가 안 밀린다).
 * 설정 창은 열 때만 그려지고 서버에서 그리지 않으므로 저장소를 바로 읽어도 하이드레이션과 안 부딪힌다.
 */
function AnalyticsConsentCard() {
  const [enabled, setEnabled] = useState(() => !isAnalyticsOptedOut());

  return (
    <section
      aria-label="이용 통계 보내기"
      className="flex items-center justify-between gap-4 rounded-panel border border-[var(--el-hairline)] bg-white p-6"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--el-ink)]">
          이용 통계 보내기
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--el-muted)]">
          어떤 기능을 썼는지만 보내고, 회의 내용은 보내지 않습니다. 이
          브라우저에만 적용됩니다.{" "}
          <SitePageLink
            href="/privacy#section-5"
            className="font-medium text-[var(--el-ink)] underline underline-offset-2"
          >
            처리방침
          </SitePageLink>
        </p>
      </div>
      <Switch
        aria-label="이용 통계 보내기"
        checked={enabled}
        onCheckedChange={(checked) => {
          setAnalyticsOptOut(!checked);
          setEnabled(checked);
        }}
      />
    </section>
  );
}

/**
 * 계정 설정 로딩 스켈레톤. settings-dialog가 DataBoundary fallback으로 쓴다.
 *
 * **머리글·라벨·안내 문구는 가리지 않는다** — 고정 문구다. 아바타와 입력 칸(값)만 막대로 둔다. 카드 틀은 실제와 같은
 * 상수를 읽는다. 이용 통계 카드는 조회와 무관한 고정 카드라 실물을 세운다.
 */
export function AccountSettingsFormSkeleton() {
  return (
    <div
      className="mx-auto max-w-2xl space-y-8"
      aria-label="내 계정 설정 불러오는 중"
    >
      <Header />
      <div className={PROFILE_CARD}>
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className={FIELD}>
          <Label>이메일</Label>
          <Skeleton className="h-8 rounded-control" />
        </div>
      </div>
      <div className={NAME_CARD}>
        <Label>계정 이름</Label>
        <Skeleton className="h-8 rounded-control" />
        <NameHint />
      </div>
      <AnalyticsConsentCard />
    </div>
  );
}

function Header() {
  return (
    <SettingsHeader title="내 계정" description="프로필 정보를 확인합니다." />
  );
}

function NameHint({ id }: { id?: string }) {
  return (
    <p id={id} className="text-xs text-[var(--el-muted)]">
      워크스페이스에서 보일 이름은 멤버 탭에서 바꿉니다.
    </p>
  );
}

const PROFILE_CARD =
  "flex items-center gap-5 rounded-panel border border-[var(--el-hairline)] bg-white p-6";
const NAME_CARD =
  "space-y-2 rounded-panel border border-[var(--el-hairline)] bg-white p-6";
const FIELD = "min-w-0 flex-1 space-y-2";
