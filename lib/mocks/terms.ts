import { delay, http } from "msw";

import { mockDb } from "@/lib/mocks/db";
import { failWith, paramId, respond } from "@/lib/mocks/mock-envelope";
import { normalizeTerm } from "@/lib/terms/term-list";

/**
 * 전사 용어 사전 목 (APP-1187 계약). 서버와 같은 규칙만 흉내 낸다 — 같은 용어(대소문자·앞뒤 공백 무시)는 멱등하게
 * 기존 항목을 200 으로, 한도는 409 `TERM_LIMIT_EXCEEDED`, 프로젝트에 워크스페이스 용어를 새로 넣으면 409
 * `TERM_IN_WORKSPACE`, 삭제는 없어도 204.
 *
 * **응답을 조금 늦춘다.** 화면은 응답을 기다리지 않고 칩을 먼저 그린다(낙관적 갱신). 목이 즉시 답하면 그 경로와
 * 연달아 누를 때의 줄 세우기가 dev 에서 한 번도 드러나지 않는다.
 *
 * 「오류재현」이 들어간 용어는 500 으로 거절한다 — 실패 롤백을 화면에서 확인하는 자리다(브라우저 서비스 워커가
 * 처리하는 요청은 Playwright `page.route` 가 가로채지 못한다).
 */
type StoredTerm = { termId: string; term: string };

const WORKSPACE_LIMIT = 200;
const PROJECT_LIMIT = 100;
const LATENCY_MS = 250;

let workspaceTerms: Map<string, StoredTerm[]>;
let projectTerms: Map<string, StoredTerm[]>;
let counter = 0;

const nextId = () => `0T${String((counter += 1)).padStart(11, "0")}`;
const seed = (terms: string[]) =>
  terms.map((term) => ({ termId: nextId(), term }));

function reset() {
  counter = 0;
  workspaceTerms = new Map([
    [
      "01K0000000000",
      seed(["HeyMoa", "핀볼", "MCP", "PRD", "pyannote", "온보딩 퍼널"]),
    ],
  ]);
  projectTerms = new Map([
    // 「주간」 — 「핀볼」은 워크스페이스에도 있다(나중에 워크스페이스에 생긴 경우의 표본)
    ["01K0000000001", seed(["결제 승인", "PG사", "핀볼"])],
    // 「고객」 — 한도에 닿은 표본
    [
      "01K0000000004",
      seed(Array.from({ length: PROJECT_LIMIT }, (_, i) => `고객사 ${i + 1}`)),
    ],
  ]);
}
reset();
mockDb.onReset(reset);

const view = (list: StoredTerm[], inWorkspace?: (term: string) => boolean) =>
  list.map((item) =>
    inWorkspace ? { ...item, inWorkspace: inWorkspace(item.term) } : item
  );

function wsList(workspaceId: string) {
  mockDb.listProjects(workspaceId); // 없는 워크스페이스는 404
  if (!workspaceTerms.has(workspaceId)) workspaceTerms.set(workspaceId, []);
  return workspaceTerms.get(workspaceId)!;
}

function projectList(workspaceId: string, projectId: string) {
  mockDb.getProject(workspaceId, projectId);
  if (!projectTerms.has(projectId)) projectTerms.set(projectId, []);
  return projectTerms.get(projectId)!;
}

const inWorkspaceOf = (workspaceId: string) => {
  const keys = new Set(wsList(workspaceId).map((t) => normalizeTerm(t.term)));
  return (term: string) => keys.has(normalizeTerm(term));
};

async function readTerm(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { term?: unknown };
  const term = typeof body.term === "string" ? body.term.trim() : "";
  if (!term || term.length > 40)
    failWith("BAD_REQUEST", 400, "잘못된 요청입니다.");
  if (term.includes("오류재현"))
    failWith("INTERNAL_ERROR", 500, "잠시 후 다시 시도해 주세요.");
  return term;
}

/** 멱등 추가. 새로 만들면 201, 이미 있으면 그 항목을 200 으로. */
function add(
  list: StoredTerm[],
  term: string,
  limit: number,
  beforeCreate?: () => void
) {
  const existing = list.find(
    (item) => normalizeTerm(item.term) === normalizeTerm(term)
  );
  if (existing) return { item: existing, status: 200 };
  beforeCreate?.();
  if (list.length >= limit)
    failWith(
      "TERM_LIMIT_EXCEEDED",
      409,
      `용어는 ${limit}개까지 넣을 수 있습니다.`
    );
  const item = { termId: nextId(), term };
  list.push(item);
  return { item, status: 201 };
}

/** 추가는 결과에 따라 200·201 이 갈린다 — 상태를 정한 뒤 봉투로 감싼다. */
async function addResponse<T>(run: () => Promise<{ item: T; status: number }>) {
  await delay(LATENCY_MS);
  try {
    const { item, status } = await run();
    return respond(() => item, status);
  } catch (error) {
    return respond(() => {
      throw error;
    });
  }
}

export const termHandlers = [
  http.get("*/v1/workspaces/:workspaceId/terms", ({ params }) =>
    respond(() => ({
      terms: view(wsList(paramId(params.workspaceId))),
      limit: WORKSPACE_LIMIT,
    }))
  ),
  http.post("*/v1/workspaces/:workspaceId/terms", async ({ params, request }) =>
    addResponse(async () =>
      add(
        wsList(paramId(params.workspaceId)),
        await readTerm(request),
        WORKSPACE_LIMIT
      )
    )
  ),
  http.delete(
    "*/v1/workspaces/:workspaceId/terms/:termId",
    async ({ params }) => {
      await delay(LATENCY_MS);
      return respond(() => {
        const list = wsList(paramId(params.workspaceId));
        const index = list.findIndex(
          (item) => item.termId === paramId(params.termId)
        );
        if (index >= 0) list.splice(index, 1);
      }, 204);
    }
  ),
  http.get(
    "*/v1/workspaces/:workspaceId/projects/:projectId/terms",
    ({ params }) =>
      respond(() => {
        const workspaceId = paramId(params.workspaceId);
        return {
          terms: view(
            projectList(workspaceId, paramId(params.projectId)),
            inWorkspaceOf(workspaceId)
          ),
          limit: PROJECT_LIMIT,
        };
      })
  ),
  http.post(
    "*/v1/workspaces/:workspaceId/projects/:projectId/terms",
    async ({ params, request }) =>
      addResponse(async () => {
        const workspaceId = paramId(params.workspaceId);
        const term = await readTerm(request);
        const inWorkspace = inWorkspaceOf(workspaceId);
        const result = add(
          projectList(workspaceId, paramId(params.projectId)),
          term,
          PROJECT_LIMIT,
          () => {
            if (inWorkspace(term))
              failWith(
                "TERM_IN_WORKSPACE",
                409,
                "워크스페이스 용어 사전에 이미 있는 용어입니다."
              );
          }
        );
        return {
          ...result,
          item: { ...result.item, inWorkspace: inWorkspace(result.item.term) },
        };
      })
  ),
  http.delete(
    "*/v1/workspaces/:workspaceId/projects/:projectId/terms/:termId",
    async ({ params }) => {
      await delay(LATENCY_MS);
      return respond(() => {
        const list = projectList(
          paramId(params.workspaceId),
          paramId(params.projectId)
        );
        const index = list.findIndex(
          (item) => item.termId === paramId(params.termId)
        );
        if (index >= 0) list.splice(index, 1);
      }, 204);
    }
  ),
];
