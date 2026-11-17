"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  MessageCircle,
  Sparkles,
  SquareTerminal,
  Terminal,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { CopyBlock } from "@/components/agent-connections/copy-block";
import { Collapse } from "@/components/heymoa/collapse";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildUrl } from "@/lib/api/fetcher";
import { cn } from "@/lib/utils";

const CHATGPT_HELP_URL =
  "https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt";

type AppKey = "claude-app" | "claude-code" | "codex" | "chatgpt";

const APPS: {
  key: AppKey;
  name: string | { key: "claudeApp" };
  where: string | { key: "terminal" | "developerMode" };
  Icon: ComponentType<{ className?: string }>;
}[] = [
  {
    key: "claude-app",
    name: { key: "claudeApp" },
    where: "claude.ai",
    Icon: MessageCircle,
  },
  {
    key: "claude-code",
    name: "Claude Code",
    where: { key: "terminal" },
    Icon: SquareTerminal,
  },
  { key: "codex", name: "Codex", where: { key: "terminal" }, Icon: Terminal },
  {
    key: "chatgpt",
    name: "ChatGPT",
    where: { key: "developerMode" },
    Icon: Sparkles,
  },
];

const code = (chunks: ReactNode) => <code>{chunks}</code>;

export function AgentOAuthGuide({
  onPersonalToken,
  onClose,
}: {
  onPersonalToken: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("agents.guide");
  const tActions = useTranslations("common.actions");
  const word = (value: string | { key: "claudeApp" | "terminal" | "developerMode" }) =>
    typeof value === "string" ? value : t(`apps.${value.key}`);
  const mcpUrl = buildUrl("/mcp");
  const address = <CopyBlock inline label={t("address")} value={mcpUrl} />;

  return (
    <section
      aria-label={t("label")}
      className="rounded-panel border border-[var(--el-hairline)] bg-white p-6"
    >
      <h3 className="text-xl font-light tracking-[-0.02em] text-[var(--el-ink)]">
        {t("title")}
      </h3>
      <p className="mt-1 text-sm text-[var(--el-muted)]">
        {t("description")}
      </p>

      <Tabs defaultValue="claude-app" className="mt-5 gap-5">
        <TabsList className="grid w-full grid-cols-2 gap-2 bg-transparent p-0 group-data-horizontal/tabs:h-auto sm:grid-cols-4">
          {APPS.map(({ key, name, where, Icon }) => (
            <TabsTrigger
              key={key}
              value={key}
              aria-label={word(name)}
              className={cn(
                "h-auto flex-col items-start gap-0 rounded-block border border-[var(--el-hairline-strong)] bg-white px-3 py-2.5 text-left whitespace-normal shadow-none",
                "data-active:border-[var(--el-ink)] data-active:bg-[var(--el-canvas-soft)] data-active:shadow-none data-active:ring-1 data-active:ring-[var(--el-ink)]"
              )}
            >
              <Icon className="size-4 text-[var(--el-ink)]" />
              <span className="mt-2 text-sm font-medium text-[var(--el-ink)]">
                {word(name)}
              </span>
              <span className="text-xs font-normal text-[var(--el-muted)]">
                {word(where)}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="grid">
          <TabsContent
            value="claude-app"
            keepMounted
            data-keep-size
            className={PANEL}
          >
            <Steps>
              <Step n={1}>{t("claudeApp.openSettings")}</Step>
              <Step n={2}>
                {t("claudeApp.addConnector")}
                {address}
              </Step>
              <Step n={3}>{t("claudeApp.connect")}</Step>
            </Steps>
            <Done trouble={t("claudeApp.trouble")} />
          </TabsContent>

          <TabsContent
            value="claude-code"
            keepMounted
            data-keep-size
            className={PANEL}
          >
            <Steps>
              <Step n={1}>
                {t("pasteInTerminal")}
                {/* 어느 폴더에서나 쓰이게 한다 — 폴더 범위(기본)로 등록하면 다른 폴더에서 heymoa 가 보이지 않았다 */}
                <CopyBlock
                  inline
                  label={t("claudeCode.command")}
                  value={`claude mcp add --transport http --scope user heymoa ${mcpUrl}`}
                />
              </Step>
              <Step n={2}>
                {t.rich("claudeCode.authenticate", { code })}
              </Step>
              <Step n={3}>{t("allow")}</Step>
            </Steps>
            <Done trouble={t.rich("claudeCode.trouble", { code })} />
          </TabsContent>

          <TabsContent
            value="codex"
            keepMounted
            data-keep-size
            className={PANEL}
          >
            <Steps>
              <Step n={1}>
                {t("pasteInTerminal")}
                {/* Codex 는 OAuth 서버를 등록하면 바로 로그인을 시작한다 — `codex mcp login` 을 같이 붙여 넣으면 허락을
                  두 번 하게 되고 연결도 둘 생긴다 */}
                <CopyBlock
                  inline
                  label={t("codex.command")}
                  value={`codex mcp add heymoa --url ${mcpUrl}`}
                />
              </Step>
              <Step n={2}>{t("allow")}</Step>
            </Steps>
            <Done trouble={t.rich("codex.trouble", { code })} />
          </TabsContent>

          <TabsContent
            value="chatgpt"
            keepMounted
            data-keep-size
            className={PANEL}
          >
            <Steps>
              <Step n={1}>
                {t.rich("chatgpt.developerMode", {
                  link: (chunks) => (
                    <a
                      href={CHATGPT_HELP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      {chunks}
                    </a>
                  ),
                })}
              </Step>
              <Step n={2}>
                {t("chatgpt.addConnector")}
                {address}
              </Step>
              <Step n={3}>{t("allow")}</Step>
            </Steps>
            <Done />
          </TabsContent>
        </div>
      </Tabs>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--el-hairline)] pt-4">
        <p className="text-xs text-[var(--el-muted)]">
          {t.rich("noBrowser", {
            token: (chunks) => (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs underline underline-offset-2"
                onClick={onPersonalToken}
              >
                {chunks}
              </Button>
            ),
          })}
        </p>
        <Button type="button" size="sm" className="h-8" onClick={onClose}>
          {tActions("close")}
        </Button>
      </div>
    </section>
  );
}

const PANEL = "col-start-1 row-start-1";

function Steps({ children }: { children: ReactNode }) {
  return <ol>{children}</ol>;
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="group/step relative pb-4 pl-8 text-sm text-[var(--el-body-strong)] last:pb-0">
      <span
        aria-hidden
        className="absolute top-6 bottom-0 left-[9px] w-px bg-[var(--el-hairline-strong)] group-last/step:hidden"
      />
      <span
        aria-hidden
        className="absolute top-0 left-0 flex size-[19px] items-center justify-center rounded-full bg-[var(--el-ink)] text-[11px] text-[var(--el-on-dark)]"
      >
        {n}
      </span>
      <div className="min-w-0 space-y-2">{children}</div>
    </li>
  );
}

function Done({ trouble }: { trouble?: ReactNode }) {
  const t = useTranslations("agents.guide");
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5 text-xs text-[var(--el-muted)]">
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <CheckCircle2
          className="size-3.5 text-[var(--el-success-strong)]"
          aria-hidden
        />
        {t("done")}
        {trouble ? (
          <>
            {" · "}
            <button
              type="button"
              aria-expanded={open}
              className="underline underline-offset-2 hover:text-[var(--el-ink)]"
              onClick={() => setOpen((value) => !value)}
            >
              {t("trouble")}
            </button>
          </>
        ) : null}
      </p>
      <Collapse open={open}>
        <p className="pt-2 leading-relaxed">{trouble}</p>
      </Collapse>
    </div>
  );
}
