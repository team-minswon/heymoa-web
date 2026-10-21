"use client";

import { useState } from "react";

import { PersonAvatar } from "@/components/heymoa/person-avatar";
import { SitePageLink } from "@/components/heymoa/site-page-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
      <div>
        <h2 className="text-3xl font-light tracking-[-0.03em] text-[var(--el-ink)]">
          내 계정
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--el-muted)]">
          프로필 정보를 확인합니다.
        </p>
      </div>
      <div className="flex items-center gap-5 rounded-panel border border-[var(--el-hairline)] bg-white p-6">
        <PersonAvatar
          name={user.userId}
          image={user.image}
          alt={`${user.name} 프로필`}
          size={56}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="account-email">이메일</Label>
          <Input id="account-email" value={user.email} disabled />
        </div>
      </div>
      <div className="space-y-2 rounded-panel border border-[var(--el-hairline)] bg-white p-6">
        <Label htmlFor="account-name">계정 이름</Label>
        <Input
          id="account-name"
          value={user.name}
          disabled
          aria-describedby="account-name-hint"
        />
        {/* 계정 이름은 로그인한 계정에서 와 여기서 못 고친다. 고칠 길이 어디 있는지만 한 줄로 알린다(APP-1206). */}
        <p id="account-name-hint" className="text-xs text-[var(--el-muted)]">
          워크스페이스에서 보일 이름은 멤버 탭에서 바꿉니다.
        </p>
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
 * **머리글은 가리지 않는다** — 제목과 설명은 응답이 아니라 고정 문구다. `h-9`(36) 막대로
 * 덮었을 때 실제 머리글 블록(68)보다 낮아 도착하는 순간 아래가 밀렸다.
 *
 * 계정 카드는 둘이다. 셋째였던 기본 워크스페이스 카드(280)는 APP-401에서 사라졌다. 이용 통계 카드는
 * 조회와 무관한 고정 카드라 막대가 아니라 실물을 세운다.
 */
export function AccountSettingsFormSkeleton() {
  return (
    <div
      className="mx-auto max-w-2xl space-y-8"
      aria-label="내 계정 설정 불러오는 중"
    >
      <div>
        <h2 className="text-3xl font-light tracking-[-0.03em] text-[var(--el-ink)]">
          내 계정
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--el-muted)]">
          프로필 정보를 확인합니다.
        </p>
      </div>
      {/* 아바타 + 이메일 카드(106) · 계정 이름 카드(128, 안내 한 줄 포함) */}
      <Skeleton className="h-[106px] rounded-panel" />
      <Skeleton className="h-[128px] rounded-panel" />
      <AnalyticsConsentCard />
    </div>
  );
}
