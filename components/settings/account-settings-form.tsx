"use client";

import { useTranslations } from "next-intl";

import { PersonAvatar } from "@/components/heymoa/person-avatar";
import { AccountDeletionSection } from "@/components/settings/account-deletion-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsHeader } from "@/components/settings/settings-layout";
import { useGetCurrentUserSuspense } from "@/lib/api/generated/users/users";

export function AccountSettingsForm() {
  const t = useTranslations("settings.account");
  const response = useGetCurrentUserSuspense().data;
  if (response.status !== 200 || !response.data.success) {
    throw new Error(t("loadFailed"));
  }
  const user = response.data.data;

  return (
    <div
      className="mx-auto w-full max-w-[720px] space-y-8"
      aria-label={t("label")}
    >
      <Header />
      <div className={PROFILE_CARD}>
        <PersonAvatar
          name={user.userId}
          image={user.image}
          alt={t("avatarAlt", { name: user.name })}
          size={56}
        />
        <div className={FIELD}>
          <Label htmlFor="account-email">{t("email")}</Label>
          <Input id="account-email" value={user.email} disabled />
        </div>
      </div>
      <div className={NAME_CARD}>
        <Label htmlFor="account-name">{t("name")}</Label>
        <Input
          id="account-name"
          value={user.name}
          disabled
          aria-describedby="account-name-hint"
        />
        <NameHint id="account-name-hint" />
      </div>
      <AccountDeletionSection />
    </div>
  );
}

export function AccountSettingsFormSkeleton() {
  const t = useTranslations("settings.account");
  return (
    <div
      className="mx-auto w-full max-w-[720px] space-y-8"
      aria-label={t("loading")}
    >
      <Header />
      <div className={PROFILE_CARD}>
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className={FIELD}>
          <Label>{t("email")}</Label>
          <Skeleton className="h-8 rounded-control" />
        </div>
      </div>
      <div className={NAME_CARD}>
        <Label>{t("name")}</Label>
        <Skeleton className="h-8 rounded-control" />
        <NameHint />
      </div>
      <AccountDeletionSection />
    </div>
  );
}

function Header() {
  const t = useTranslations("settings.account");
  return <SettingsHeader title={t("title")} description={t("description")} />;
}

function NameHint({ id }: { id?: string }) {
  const t = useTranslations("settings.account");
  return (
    <p id={id} className="text-xs text-[var(--el-muted)]">
      {t("nameHint")}
    </p>
  );
}

const PROFILE_CARD =
  "flex items-center gap-5 rounded-panel border border-[var(--el-hairline)] bg-white p-6";
const NAME_CARD =
  "space-y-2 rounded-panel border border-[var(--el-hairline)] bg-white p-6";
const FIELD = "min-w-0 flex-1 space-y-2";
