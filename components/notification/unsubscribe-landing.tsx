"use client";

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

/**
 * 링크가 끄는 설정 항목(응답 `kind`)별 문구. 자동 종료 안내 메일의 링크도 리마인더 항목으로 온다(계약).
 * 모르는 종류·불러오는 중에는 리마인더 문구다 — 이 화면이 처음 생긴 메일이다.
 */
const MAILS = {
  MEETING_PAUSED_REMINDER: {
    name: "일시정지된 회의 메일",
    items: [
      "회의를 일시정지한 다음 영업일에 보내는 안내",
      "자동 종료했을 때 보내는 안내",
    ],
  },
  INQUIRY_ANSWERED: {
    name: "문의 답변 메일",
    items: ["보낸 문의에 HeyMoa 팀이 답했을 때 보내는 안내"],
  },
} as const;
type MailKind = keyof typeof MAILS;
const mailKindOf = (kind: string | undefined): MailKind =>
  kind === "INQUIRY_ANSWERED" ? kind : "MEETING_PAUSED_REMINDER";

/**
 * 메일 푸터의 「이 종류의 메일 받지 않기」가 여는 독립 페이지(APP-1314, PRO-67 userflow 「수신거부」). 로그인이 필요 없다.
 *
 * **여는 것은 아무것도 바꾸지 않는다** — 메일 보안 검사기·링크 미리보기가 먼저 열 수 있어서 GET 으로 읽기만 하고,
 * 「메일 끄기」를 눌러야 POST 한다. 완료는 저장 응답을 받은 뒤에만 보인다. 실패는 전역 mutation 토스트가 말하고
 * 확인 화면은 그대로 남는다.
 *
 * 「다시 켜기」는 로그인한 사람의 설정을 바꾼다. 로그인하지 않았으면 로그인한 뒤 같은 링크로 돌아오고, 그때 GET 이
 * 「이미 꺼져 있습니다」로 다시 켜기를 보인다. 「알림 설정 열기」는 설정 탭(PRO-67 I10, 트랙 B)이 생기면 둔다.
 */
export function UnsubscribeLanding({ token }: { token: string | null }) {
  const query = useGetMailUnsubscribe(
    { t: token ?? "" },
    { query: { enabled: Boolean(token) } }
  );
  const unsubscribe = useUnsubscribeMail();
  const [done, setDone] = useState(false);

  if (!token || errorCodeOf(query.error) === "UNSUBSCRIBE_LINK_INVALID") {
    return (
      <Card title="유효하지 않은 링크입니다">
        <p>
          링크가 잘렸거나 더 이상 쓸 수 없습니다. 받은 메일의 링크를 다시 열어
          주세요.
        </p>
        <Footer>
          <HomeLink />
        </Footer>
      </Card>
    );
  }

  if (query.isError) {
    return (
      <Card title="링크를 확인하지 못했습니다">
        <p>{errorMessageOf(query.error, "잠시 후 다시 시도해 주세요.")}</p>
        <Footer>
          <Button
            type="button"
            size="lg"
            loading={query.isFetching}
            onClick={() => void query.refetch()}
          >
            다시 시도
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
  const mail = MAILS[kind];

  if (done) {
    return (
      <ResubscribeCard
        token={token}
        kind={kind}
        title={`${mail.name}을 껐습니다`}
      />
    );
  }
  if (info?.unsubscribed) {
    return (
      <ResubscribeCard
        token={token}
        kind={kind}
        title={`${mail.name}은 이미 꺼져 있습니다`}
      />
    );
  }

  return (
    <Card title={`${mail.name}을 받지 않을까요?`}>
      <p>
        {info ? (
          <span className="font-medium text-[var(--el-ink)]">{info.email}</span>
        ) : (
          <Skeleton
            aria-label="계정 이메일 불러오는 중"
            className="inline-block h-4 w-36 translate-y-0.5 rounded-chip"
          />
        )}{" "}
        계정으로 오는 아래 {mail.items.length === 1 ? "" : "두 "}메일을 더 이상
        보내지 않습니다.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5">
        {mail.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="mt-3">
        {/* 자동 종료가 실제로 돌 때만 고지한다(PRO-67 userflow). 판정은 서버가 싣는다(APP-1328) */}
        {kind === "MEETING_PAUSED_REMINDER" && info?.autoEndActive
          ? "메일을 꺼도 일시정지된 회의는 일정대로 자동 종료됩니다. "
          : null}
        초대 등 다른 메일은 그대로 받습니다.
      </p>
      <Footer>
        <LinkButton href="/" variant="outline" size="lg">
          취소
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
              // 실패 문구는 전역 mutation 토스트가 띄운다. 확인 화면은 그대로 둔다.
              .catch(() => {})
          }
        >
          메일 끄기
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
  const { status } = useAuth();
  const resubscribe = useUpdateNotificationPreference();
  const [resubscribed, setResubscribed] = useState(false);

  if (resubscribed) {
    return <Card title={`${MAILS[kind].name}을 다시 켰습니다`} />;
  }

  return (
    <Card title={title}>
      <Footer>
        <Button
          type="button"
          variant="outline"
          size="lg"
          loading={resubscribe.isPending}
          onClick={() => {
            if (status !== "authenticated") {
              // 로그인한 뒤 같은 링크로 돌아온다(`normalizeReturnTo` 가 `/unsubscribe` 를 허용한다).
              window.location.assign(
                buildGoogleOAuthUrl(
                  `/unsubscribe?t=${encodeURIComponent(token)}`
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
          다시 켜기
        </Button>
      </Footer>
    </Card>
  );
}

/** 빈 배경 위 카드 하나. 목록이 있어 왼쪽 정렬이고, 버튼은 확인 창과 같은 자리(오른쪽, 취소 → 실행)다. */
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
  return (
    <LinkButton href="/" variant="outline" size="lg">
      홈으로
    </LinkButton>
  );
}
