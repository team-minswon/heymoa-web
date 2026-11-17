import { delay, http } from "msw";

import { mockDb } from "@/lib/mocks/db";
import { helpDemoPack, isHelpDemoEnabled } from "@/lib/mocks/help-demo";
import { failWith, paramId, respond } from "@/lib/mocks/mock-envelope";
import {
  TERM_MAX_LENGTH,
  cleanTerm,
  normalizeTerm,
} from "@/lib/terms/term-list";

type StoredTerm = { termId: string; term: string };

const WORKSPACE_LIMIT = 200;
const LATENCY_MS = 250;

let workspaceTerms: Map<string, StoredTerm[]>;
let counter = 0;

const nextId = () => `0T${String((counter += 1)).padStart(11, "0")}`;
const seed = (terms: string[]) =>
  terms.map((term) => ({ termId: nextId(), term }));

function reset() {
  counter = 0;
  workspaceTerms = new Map([
    [
      "01K0000000000",
      seed(
        isHelpDemoEnabled()
          ? [...helpDemoPack().terms]
          : ["HeyMoa", "핀볼", "MCP", "PRD", "pyannote", "온보딩 퍼널"]
      ),
    ],
  ]);
}
reset();
mockDb.onReset(reset);

function wsList(workspaceId: string) {
  mockDb.listProjects(workspaceId);
  if (!workspaceTerms.has(workspaceId)) workspaceTerms.set(workspaceId, []);
  return workspaceTerms.get(workspaceId)!;
}

async function readTerm(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { term?: unknown };
  const term = typeof body.term === "string" ? body.term.trim() : "";
  if (!term || term.length > 40)
    failWith("BAD_REQUEST", 400, "잘못된 요청입니다.");
  if (term.includes("오류재현"))
    failWith("INTERNAL_ERROR", 500, "잠시 후 다시 시도해 주세요.");
  return term;
}

function add(list: StoredTerm[], term: string, limit: number) {
  const existing = list.find(
    (item) => normalizeTerm(item.term) === normalizeTerm(term)
  );
  if (existing) return { item: existing, status: 200 };
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
      terms: wsList(paramId(params.workspaceId)),
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
  http.post(
    "*/v1/workspaces/:workspaceId/terms/batch",
    async ({ params, request }) => {
      await delay(LATENCY_MS);
      return respond(async () => {
        const body = (await request.json().catch(() => ({}))) as {
          terms?: unknown;
        };
        const raw = Array.isArray(body.terms) ? body.terms : [];
        if (
          raw.length < 1 ||
          raw.length > 100 ||
          raw.some((t) => typeof t !== "string")
        )
          failWith("BAD_REQUEST", 400, "잘못된 요청입니다.");
        if (raw.some((t: string) => t.includes("오류재현")))
          failWith("INTERNAL_ERROR", 500, "잠시 후 다시 시도해 주세요.");
        const list = wsList(paramId(params.workspaceId));
        const added: StoredTerm[] = [];
        const existing: StoredTerm[] = [];
        const rejected: { term: string; reason: string }[] = [];
        const seen = new Set<string>();
        for (const item of raw as string[]) {
          const term = cleanTerm(item);
          if (!term) {
            rejected.push({ term: "", reason: "BLANK" });
            continue;
          }
          if (term.length > TERM_MAX_LENGTH) {
            rejected.push({
              term: term.slice(0, TERM_MAX_LENGTH),
              reason: "TOO_LONG",
            });
            continue;
          }
          const key = normalizeTerm(term);
          if (seen.has(key)) continue;
          seen.add(key);
          const found = list.find((t) => normalizeTerm(t.term) === key);
          if (found) existing.push(found);
          else if (list.length >= WORKSPACE_LIMIT)
            rejected.push({ term, reason: "LIMIT" });
          else {
            const created = { termId: nextId(), term };
            list.push(created);
            added.push(created);
          }
        }
        return { added, existing, rejected };
      });
    }
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
];
