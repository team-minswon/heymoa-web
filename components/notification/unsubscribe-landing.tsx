"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button, LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import {
  useGetMailUnsubscribe,
  useUnsubscribeMail,
} from "@/lib/api/generated/mail-unsubscribe/mail-unsubscribe";
import { useUpdateNotificationPreference } from "@/lib/api/generated/notification-settings/notification-settings";
import { buildGoogleOAuthUrl } from "@/lib/auth/paths";
import { InAppLoginGate } from "@/components/auth/in-app-login-gate";

const MAIL_ITEMS = {
  MEETING_PAUSED_REMINDER: ["pausedNextDay", "autoEnded"],
  INQUIRY_ANSWERED: ["inquiryAnswered"],
} as const;
type MailKind = keyof typeof MAIL_ITEMS;
const mailKindOf = (kind: string | undefined): MailKind =>
  kind === "INQUIRY_ANSWERED" ? kind : "MEETING_PAUSED_REMINDER";

export function UnsubscribeLanding({ token }: { token: string | null }) {
  const t = useTranslations("notification.unsubscribe");
  const tActions = useTranslations("common.actions");
  const query = useGetMailUnsubscribe(
    { t: token ?? "" },
    { query: { enabled: Boolean(token) } }
  );
  const unsubscribe = useUnsubscribeMail();
  const [done, setDone] = useState(false);

  if (!token || errorCodeOf(query.error) === "UNSUBSCRIBE_LINK_INVALID") {
    return (
      <Card title={t("invalidTitle")}>
        <p>{t("invalidBody")}</p>
        <Footer>
          <HomeLink />
        </Footer>
      </Card>
    );
  }

  if (query.isError) {
    return (
      <Card title={t("checkFailed")}>
        <p>{errorMessageOf(query.error, t("retryLater"))}</p>
        <Footer>
          <Button
            type="button"
            size="lg"
            loading={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {tActions("retry")}
          </Button>
        </Footer>
      </Card>
    );
  }

  const info =
    query.data?.status === 200 && query.data.data.success
      ? query.data.data.data
      : null;
  const kind = mailKindOf(info?.kind);
  const items = MAIL_ITEMS[kind];
  const name = t(`names.${kind}`);

  if (done) {
    return (
      <ResubscribeCard
        token={token}
        kind={kind}
        title={t("off", { name })}
      />
    );
  }
  if (info?.unsubscribed) {
    return (
      <ResubscribeCard
        token={token}
        kind={kind}
        title={t("alreadyOff", { name })}
      />
    );
  }

  return (
    <Card title={t("confirm", { name })}>
      {/* `Skeleton` 이 div 라 `<p>` 안에 둘 수 없다(하이드레이션 오류). preflight 에서 둘의 기하는 같다. */}
      <div>
        {t.rich("body", {
          count: items.length,
          email: () =>
            info ? (
              <span className="font-medium text-[var(--el-ink)]">{info.email}</span>
            ) : (
              <Skeleton
                aria-label={t("loadingEmail")}
                className="inline-block h-4 w-36 translate-y-0.5 rounded-chip"
              />
            ),
        })}
      </div>
      <ul className="mt-3 list-disc space-y-1 pl-5">
        {items.map((item) => (
          <li key={item}>{t(`items.${item}`)}</li>
        ))}
      </ul>
      <p className="mt-3">
        {kind === "MEETING_PAUSED_REMINDER" && info?.autoEndActive
          ? `${t("autoEndNote")} `
          : null}
        {t("otherMail")}
      </p>
      <Footer>
        <LinkButton href="/" variant="outline" size="lg">
          {tActions("cancel")}
        </LinkButton>
        <Button
          type="button"
          size="lg"
          disabled={!info}
          loading={unsubscribe.isPending}
          onClick={() =>
            unsubscribe
              .mutateAsync({ params: { t: token } })
              .then((response) => {
                if (response.status === 200 && response.data.success)
                  setDone(true);
              })
              .catch(() => {})
          }
        >
          {t("turnOff")}
        </Button>
      </Footer>
    </Card>
  );
}

function ResubscribeCard({
  token,
  kind,
  title,
}: {
  token: string;
  kind: MailKind;
  title: string;
}) {
  const t = useTranslations("notification.unsubscribe");
  const { status } = useAuth();
  const resubscribe = useUpdateNotificationPreference();
  const locale = useLocale();
  const [resubscribed, setResubscribed] = useState(false);

  if (resubscribed) {
    return <Card title={t("resubscribed", { name: t(`names.${kind}`) })} />;
  }

  return (
    <Card title={title}>
      <Footer>
        <InAppLoginGate
          enabled={status !== "authenticated"}
          returnTo={`/unsubscribe?t=${encodeURIComponent(token)}`}
        >
          <Button
            type="button"
            variant="outline"
            size="lg"
            loading={resubscribe.isPending}
            onClick={() => {
              if (status !== "authenticated") {
                window.location.assign(
                  buildGoogleOAuthUrl(
                    `/unsubscribe?t=${encodeURIComponent(token)}`, locale
                  )
                );
                return;
              }
              resubscribe
                .mutateAsync({
                  data: {
                    type: kind,
                    channel: "EMAIL",
                    enabled: true,
                  },
                })
                .then((response) => {
                  if (response.status === 200 && response.data.success)
                    setResubscribed(true);
                })
                .catch(() => {});
            }}
          >
            {t("turnOn")}
          </Button>
        </InAppLoginGate>
      </Footer>
    </Card>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <section className="w-full max-w-[480px] rounded-2xl border border-[var(--el-hairline)] bg-white p-8 text-left shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
        <h1 className="text-xl font-medium tracking-[-0.01em] text-balance text-[var(--el-ink)]">
          {title}
        </h1>
        {children ? (
          <div className="mt-3 text-[15px] leading-6 text-[var(--el-body)]">
            {children}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex justify-end gap-2">{children}</div>;
}

function HomeLink() {
  const t = useTranslations("common.error");
  return (
    <LinkButton href="/" variant="outline" size="lg">
      {t("home")}
    </LinkButton>
  );
}
