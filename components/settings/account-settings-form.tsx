"use client";

import { PersonAvatar } from "@/components/heymoa/person-avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsHeader } from "@/components/settings/settings-layout";
import { useGetCurrentUserSuspense } from "@/lib/api/generated/users/users";

export function AccountSettingsForm() {
  const response = useGetCurrentUserSuspense().data;
  if (response.status !== 200 || !response.data.success) {
    throw new Error("계정 정보를 불러오지 못했습니다.");
  }
  const user = response.data.data;

  return (
    <div
      className="mx-auto w-full max-w-[720px] space-y-8"
      aria-label="내 계정 설정"
    >
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
    </div>
  );
}

/**
 * 계정 설정 로딩 스켈레톤. settings-dialog가 DataBoundary fallback으로 쓴다.
 *
 * **머리글·라벨·안내 문구는 가리지 않는다** — 고정 문구다. 아바타와 입력 칸(값)만 막대로 둔다. 카드 틀은 실제와 같은
 * 상수를 읽는다.
 */
export function AccountSettingsFormSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[720px] space-y-8"
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
