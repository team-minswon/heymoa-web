"use client";

import { useState } from "react";
import {
  CheckCircle2,
  MessageCircle,
  Sparkles,
  SquareTerminal,
  Terminal,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { CopyBlock } from "@/components/agent-connections/copy-block";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildUrl } from "@/lib/api/fetcher";
import { cn } from "@/lib/utils";

/** ChatGPT 의 커스텀 커넥터 조건은 자주 바뀐다 — 요금제를 적지 않고 공식 도움말로 보낸다(APP-889). */
const CHATGPT_HELP_URL =
  "https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt";

type AppKey = "claude-app" | "claude-code" | "codex" | "chatgpt";

/** 고르는 카드 네 장. 이름 아래 한 줄은 「어디서 하는 일인가」 — 터미널이 필요한지 먼저 보이게 한다. */
const APPS: {
  key: AppKey;
  name: string;
  where: string;
  Icon: ComponentType<{ className?: string }>;
}[] = [
  {
    key: "claude-app",
    name: "Claude 앱",
    where: "claude.ai",
    Icon: MessageCircle,
  },
  {
    key: "claude-code",
    name: "Claude Code",
    where: "터미널",
    Icon: SquareTerminal,
  },
  { key: "codex", name: "Codex", where: "터미널", Icon: Terminal },
  { key: "chatgpt", name: "ChatGPT", where: "개발자 모드", Icon: Sparkles },
];

const ALLOW = "열린 브라우저에서 워크스페이스를 고르고 「허락」";

/**
 * OAuth 로 연결하는 안내(APP-889 · APP-1031). 앱 카드 하나를 고르면 그 앱의 단계만 타임라인으로 보인다 — 네 앱을
 * 한꺼번에 펼치면 내 앱을 찾다가 막혔다. 앱에 주소만 등록하면 앱이 연 브라우저에서 로그인하고 동의 화면(APP-888)에서
 * 워크스페이스를 고른다 — 그래서 여기에는 토큰도 워크스페이스 고르기도 없다. 브라우저로 허락할 수 없는 곳은 개인 토큰으로
 * 간다(PRD 「정한 것」 6). 카드 안에서는 「에이전트」·「MCP」라는 말을 쓰지 않는다.
 */
export function AgentOAuthGuide({
  onPersonalToken,
  onClose,
}: {
  onPersonalToken: () => void;
  onClose: () => void;
}) {
  const mcpUrl = buildUrl("/mcp");
  const address = <CopyBlock inline label="HeyMoa 주소" value={mcpUrl} />;

  return (
    <section
      aria-label="OAuth 연결 안내"
      className="rounded-panel border border-[var(--el-hairline)] bg-white p-6"
    >
      <h3 className="font-serif text-xl font-light tracking-[-0.02em] text-[var(--el-ink)]">
        어떤 앱에서 쓰시나요?
      </h3>
      <p className="mt-1 text-sm text-[var(--el-muted)]">
        고른 앱의 AI 가 이 워크스페이스의 회의와 프로젝트를 읽습니다. 읽기만
        합니다.
      </p>

      {/* 기본은 Claude 앱이다 — 터미널이 필요 없고, 같은 계정의 Claude Code 에도 들어온다(APP-1031 spec) */}
      <Tabs defaultValue="claude-app" className="mt-5 gap-5">
        {/* primitive 의 회색 줄 · 고정 높이(group-data-horizontal/tabs:h-8)를 풀고 카드 격자로 쓴다 */}
        <TabsList className="grid w-full grid-cols-2 gap-2 bg-transparent p-0 group-data-horizontal/tabs:h-auto sm:grid-cols-4">
          {APPS.map(({ key, name, where, Icon }) => (
            <TabsTrigger
              key={key}
              value={key}
              aria-label={name}
              className={cn(
                "h-auto flex-col items-start gap-0 rounded-block border border-[var(--el-hairline-strong)] bg-white px-3 py-2.5 text-left whitespace-normal shadow-none",
                "data-active:border-[var(--el-ink)] data-active:bg-[var(--el-canvas-soft)] data-active:shadow-none data-active:ring-1 data-active:ring-[var(--el-ink)]"
              )}
            >
              <Icon className="size-4 text-[var(--el-ink)]" />
              <span className="mt-2 text-sm font-medium text-[var(--el-ink)]">
                {name}
              </span>
              <span className="text-xs font-normal text-[var(--el-muted)]">
                {where}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="claude-app">
          <Steps>
            <Step n={1}>
              Claude 앱이나 claude.ai 에서 설정 › 커넥터를 엽니다
            </Step>
            <Step n={2}>
              「추가」 › 「사용자 지정 커넥터」에 주소를 붙여 넣습니다
              {address}
            </Step>
            <Step n={3}>「연결」을 누르고 {ALLOW}</Step>
          </Steps>
          <Done trouble="Team·Enterprise 플랜은 조직 소유자가 먼저 커넥터를 추가해야 할 수 있습니다. 같은 계정으로 Claude Code 를 쓰면 여기서 연결한 것이 Claude Code 에도 들어옵니다." />
        </TabsContent>

        <TabsContent value="claude-code">
          <Steps>
            <Step n={1}>
              터미널에 붙여 넣습니다
              {/* 어느 폴더에서나 쓰이게 한다 — 폴더 범위(기본)로 등록하면 다른 폴더에서 heymoa 가 보이지 않았다(APP-1031) */}
              <CopyBlock
                inline
                label="Claude Code 명령"
                value={`claude mcp add --transport http --scope user heymoa ${mcpUrl}`}
              />
            </Step>
            <Step n={2}>
              {/* 「Claude Code 에서」만 쓰면 데스크톱 앱의 Code 탭으로 읽힌다 — 터미널 CLI 임을 적는다(APP-1031) */}
              터미널에서 <code>claude</code> 를 실행하고 <code>/mcp</code> →
              heymoa → 인증
            </Step>
            <Step n={3}>{ALLOW}</Step>
          </Steps>
          <Done
            trouble={
              <>
                「이미 있다」고 나오면 <code>claude mcp remove heymoa</code> 로
                지운 뒤 다시 붙여 넣으세요. Claude 앱에서 커넥터로 연결했다면
                따로 등록하지 않아도 됩니다.
              </>
            }
          />
        </TabsContent>

        <TabsContent value="codex">
          <Steps>
            <Step n={1}>
              터미널에 붙여 넣습니다
              {/* Codex 는 OAuth 서버를 등록하면 바로 로그인을 시작한다 — `codex mcp login` 을 같이 붙여 넣으면 허락을
                  두 번 하게 되고 연결도 둘 생긴다(APP-889 로컬 확인) */}
              <CopyBlock
                inline
                label="Codex 명령"
                value={`codex mcp add heymoa --url ${mcpUrl}`}
              />
            </Step>
            <Step n={2}>{ALLOW}</Step>
          </Steps>
          <Done
            trouble={
              <>
                브라우저가 열리지 않으면 <code>codex mcp login heymoa</code> 를
                실행하세요. 「이미 있다」고 나오면{" "}
                <code>codex mcp remove heymoa</code> 로 지운 뒤 다시 붙여
                넣으세요.
              </>
            }
          />
        </TabsContent>

        <TabsContent value="chatgpt">
          {/* 메뉴 이름이 자주 바뀌어 화면 경로를 자세히 적지 않는다(APP-1031 spec) */}
          <Steps>
            <Step n={1}>
              설정에서 개발자 모드를 켭니다 ·{" "}
              <a
                href={CHATGPT_HELP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                쓸 수 있는 요금제 보기
              </a>
            </Step>
            <Step n={2}>
              새 커넥터에 주소를 붙여 넣습니다
              {address}
            </Step>
            <Step n={3}>{ALLOW}</Step>
          </Steps>
          <Done />
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--el-hairline)] pt-4">
        {/* 공용 Button 은 줄바꿈하지 않는다 — 긴 설명은 버튼 밖에 두고 버튼은 짧게 둔다 */}
        <p className="text-xs text-[var(--el-muted)]">
          브라우저가 없는 곳이면{" "}
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs underline underline-offset-2"
            onClick={onPersonalToken}
          >
            개인 토큰 만들기
          </Button>
        </p>
        <Button type="button" size="sm" className="h-8" onClick={onClose}>
          닫기
        </Button>
      </div>
    </section>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol>{children}</ol>;
}

/** 타임라인 한 칸. 번호 점을 세로선으로 잇고, 마지막 칸은 선을 그리지 않는다. */
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

/** 끝 상태 한 줄. 예외는 본 단계와 같은 무게로 섞지 않고 「잘 안 될 때」를 눌러야 보인다(APP-1031). */
function Done({ trouble }: { trouble?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5 text-xs text-[var(--el-muted)]">
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <CheckCircle2
          className="size-3.5 text-[var(--el-success-strong)]"
          aria-hidden
        />
        연결되면 아래 목록에 나타납니다
        {trouble ? (
          <>
            {" · "}
            <button
              type="button"
              aria-expanded={open}
              className="underline underline-offset-2 hover:text-[var(--el-ink)]"
              onClick={() => setOpen((value) => !value)}
            >
              잘 안 될 때
            </button>
          </>
        ) : null}
      </p>
      {open ? <p className="mt-2 leading-relaxed">{trouble}</p> : null}
    </div>
  );
}
