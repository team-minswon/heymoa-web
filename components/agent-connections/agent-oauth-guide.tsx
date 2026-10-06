import { CopyBlock } from "@/components/agent-connections/copy-block";
import { Button } from "@/components/ui/button";
import { buildUrl } from "@/lib/api/fetcher";

/** ChatGPT 의 커스텀 커넥터 조건은 자주 바뀐다 — 요금제를 적지 않고 공식 도움말로 보낸다(APP-889). */
const CHATGPT_HELP_URL =
  "https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt";

/**
 * OAuth 로 연결하는 안내(APP-889). 에이전트에 MCP 주소만 등록하면, 에이전트가 연 브라우저에서 로그인하고
 * 동의 화면(APP-888)에서 워크스페이스를 고른다 — 그래서 여기에는 토큰도 워크스페이스 고르기도 없다.
 * 브라우저로 허락할 수 없는 환경은 개인 토큰으로 간다(PRD 「정한 것」 6).
 */
export function AgentOAuthGuide({
  onPersonalToken,
  onClose,
}: {
  onPersonalToken: () => void;
  onClose: () => void;
}) {
  const mcpUrl = buildUrl("/mcp");
  return (
    <section
      aria-label="OAuth 연결 안내"
      className="space-y-5 rounded-panel border border-[var(--el-hairline)] bg-white p-5"
    >
      <div>
        <p className="text-sm font-medium text-[var(--el-ink)]">
          에이전트에 HeyMoa 주소를 등록하세요
        </p>
        <p className="mt-1 text-xs text-[var(--el-muted)]">
          등록한 뒤 에이전트가 연 브라우저에서 HeyMoa 에 로그인하고 맡길
          워크스페이스를 고르면 연결이 끝납니다. 토큰을 복사하지 않습니다.
        </p>
      </div>
      <CopyBlock label="MCP 주소" value={mcpUrl} />

      <AgentSection title="Claude Code">
        <CopyBlock
          label="Claude Code — 터미널에 붙여 넣기"
          value={`claude mcp add --transport http heymoa ${mcpUrl}`}
        />
        <p>
          등록한 뒤 Claude Code 에서 <code>/mcp</code> 를 열어 heymoa 를
          인증하세요. 명령을 실행한 폴더에서만 연결됩니다. 어느 폴더에서나
          쓰려면 <code>--scope user</code> 를 붙이세요. 이미 등록했다면 먼저{" "}
          <code>claude mcp remove heymoa</code> 로 지우세요.
        </p>
      </AgentSection>

      <AgentSection title="Codex CLI">
        <CopyBlock
          label="Codex CLI — 터미널에 붙여 넣기"
          value={`codex mcp add heymoa --url ${mcpUrl}`}
        />
        {/* Codex 는 OAuth 서버를 등록하면 바로 로그인을 시작한다 — `codex mcp login` 을 같이 붙여 넣으면 허락을
            두 번 하게 되고 연결도 둘 생긴다(APP-889 로컬 확인) */}
        <p>
          등록하면 Codex 가 브라우저를 열어 허락을 받습니다. 브라우저가 열리지
          않았거나 나중에 다시 로그인하려면 <code>codex mcp login heymoa</code>{" "}
          를 실행하세요. 이미 등록했다면 먼저{" "}
          <code>codex mcp remove heymoa</code> 로 지우세요.
        </p>
      </AgentSection>

      <AgentSection title="claude.ai · Claude 앱">
        <p>
          커넥터 설정의 「사용자 지정 커넥터 추가」에 위 MCP 주소를 넣으세요.
          Team·Enterprise 는 소유자가 조직 설정에서 먼저 추가해야 합니다.
        </p>
      </AgentSection>

      <AgentSection title="ChatGPT">
        <p>
          개발자 모드에서 커스텀 커넥터를 만들 수 있는 요금제라면 위 MCP 주소를
          넣으세요.{" "}
          <a
            href={CHATGPT_HELP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            쓸 수 있는 조건 보기
          </a>
        </p>
      </AgentSection>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* 공용 Button 은 줄바꿈하지 않는다 — 긴 설명은 버튼 밖에 두고 버튼은 짧게 둔다 */}
        <p className="text-xs text-[var(--el-muted)]">
          브라우저 없는 환경(CI·서버에서 도는 에이전트)이면{" "}
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

function AgentSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 border-t border-[var(--el-hairline)] pt-4 text-xs text-[var(--el-muted)]">
      <p className="text-sm font-medium text-[var(--el-ink)]">{title}</p>
      {children}
    </div>
  );
}
