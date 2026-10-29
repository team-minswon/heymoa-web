import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";

import { mockDb } from "@/lib/mocks/db";
import {
  HELP_DEMO_NOTE_IDS,
  HELP_DEMO_STORAGE_KEY,
  HELP_DEMO_WORKSPACE_ID,
  createHelpDemoState,
  isHelpDemoEnabled,
} from "@/lib/mocks/help-demo";
import { meetingFlowHandlers } from "@/lib/mocks/meeting-flow";
import { projectTaskHandlers } from "@/lib/mocks/project-tasks";
import { restHandlers } from "@/lib/mocks/rest-handlers";
import { termHandlers } from "@/lib/mocks/terms";

const server = setupServer(
  ...meetingFlowHandlers,
  ...projectTaskHandlers,
  ...restHandlers,
  ...termHandlers
);

// 응답 모양을 건건이 타입으로 옮기지 않고 필요한 필드만 읽는다
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function get<T = any>(path: string): Promise<T> {
  const response = await fetch(`http://localhost${path}`);
  expect(response.status).toBe(200);
  return (await response.json()).data as T;
}

const WORKSPACE = HELP_DEMO_WORKSPACE_ID;
const { campaign, landing, weekly } = HELP_DEMO_NOTE_IDS;

describe("가이드 캡처 프리셋 (helpDemo)", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterAll(() => server.close());
  afterEach(() => {
    window.localStorage.removeItem(HELP_DEMO_STORAGE_KEY);
    server.resetHandlers();
    mockDb.reset();
  });

  describe("꺼져 있을 때", () => {
    it("기본 시드가 그대로다", async () => {
      expect(isHelpDemoEnabled()).toBe(false);
      expect(mockDb.listWorkspaces()[0].name).toBe("테스트 유저의 워크스페이스");
      expect(mockDb.getCurrentUser().name).toBe("테스트 유저");
      const terms = await get(`/v1/workspaces/${WORKSPACE}/terms`);
      expect(terms.terms.map((row: { term: string }) => row.term)).toEqual([
        "HeyMoa", "핀볼", "MCP", "PRD", "pyannote", "온보딩 퍼널",
      ]);
      const tasks = await get(`/v1/workspaces/${WORKSPACE}/tasks`);
      expect(tasks.tasks.map((row: { content: string }) => row.content)).toContain("랜딩 문구 초안을 쓴다");
    });
  });

  describe("켜져 있을 때", () => {
    beforeEach(() => {
      window.localStorage.setItem(HELP_DEMO_STORAGE_KEY, "1");
      mockDb.reset();
    });

    it("쿼리 helpDemo=1 로도 켜지고 localStorage 에 남는다", () => {
      window.localStorage.removeItem(HELP_DEMO_STORAGE_KEY);
      window.history.replaceState(null, "", "/?helpDemo=1");
      try {
        expect(isHelpDemoEnabled()).toBe(true);
        expect(window.localStorage.getItem(HELP_DEMO_STORAGE_KEY)).toBe("1");
      } finally {
        window.history.replaceState(null, "", "/");
      }
    });

    it("워크스페이스 · 프로젝트 · 멤버 · 임시 참여자", async () => {
      const state = createHelpDemoState();
      expect(state.workspaces.map((row) => row.name)).toEqual(["봄바람 스튜디오", "연습 공간"]);
      expect(mockDb.getCurrentUser().name).toBe("김서윤");

      expect(mockDb.getWorkspace(WORKSPACE).name).toBe("봄바람 스튜디오");
      const projects = await get<{ projects: { name: string; description: string | null }[] }>(
        `/v1/workspaces/${WORKSPACE}/projects`
      );
      expect(projects.projects.map((row) => row.name).sort()).toEqual(
        ["봄 캠페인", "신제품 출시 준비", "고객 인터뷰", "주간 운영", "브랜드 리뉴얼", "앱 출시 준비"].sort()
      );
      expect(projects.projects.filter((row) => row.description === null)).toHaveLength(1);

      const members = await get<{ members: { name: string; accountName: string; displayName: string | null; role: string; email: string }[] }>(
        `/v1/workspaces/${WORKSPACE}/members`
      );
      expect(members.members).toHaveLength(7);
      expect(new Set(members.members.map((row) => row.role))).toEqual(new Set(["ADMIN", "MEMBER"]));
      expect(members.members.every((row) => row.email.endsWith("@example.com"))).toBe(true);
      // 표시 이름이 계정 이름과 다른 멤버가 있다
      expect(members.members.filter((row) => row.displayName && row.displayName !== row.accountName).length).toBeGreaterThan(0);

      const guests = await get<{ guests: unknown[] }>(`/v1/workspaces/${WORKSPACE}/guests`);
      expect(guests.guests).toHaveLength(4);
      // 빈 워크스페이스는 프로젝트가 없다
      expect(mockDb.listProjects("01K0000000009")).toHaveLength(0);
    });

    it("노트는 30개 안팎이고 상태 · 날짜 · 참석자 수가 고르게 섞인다", async () => {
      const { notes } = await get<{ notes: { noteId: string; meetingStatus: string; participants: unknown[]; createdAt: string }[] }>(
        `/v1/workspaces/${WORKSPACE}/notes`
      );
      expect(notes.length).toBeGreaterThanOrEqual(34);
      expect(notes.length).toBeLessThanOrEqual(40);
      const count = (status: string) => notes.filter((row) => row.meetingStatus === status).length;
      expect(count("ENDED")).toBeGreaterThan(15);
      expect(count("IN_PROGRESS")).toBeGreaterThanOrEqual(1);
      expect(count("NOT_STARTED")).toBeGreaterThanOrEqual(3);
      expect(count("PAUSED")).toBe(1);
      const sizes = new Set(notes.map((row) => row.participants.length));
      expect(Math.min(...sizes)).toBe(1);
      expect(Math.max(...sizes)).toBeGreaterThanOrEqual(5);
      // 시작이 오늘부터 두 달 전까지 흩어진다
      const days = new Set(notes.map((row) => row.createdAt.slice(0, 10)));
      expect(days.size).toBeGreaterThan(15);
    });

    it("핵심 회의 1: 전사 200발화 이상, 화자 4명 중 2명만 지정, 검토본 완성", async () => {
      const transcript = await get(`/v1/notes/${campaign}/transcript`);
      expect(transcript.segments.length).toBeGreaterThanOrEqual(200);
      expect(transcript.segments.length).toBeLessThanOrEqual(400);
      expect(transcript.diarization.status).toBe("MAPPED");
      const speakers = transcript.diarization.speakers as { label: string; assignedParticipantId: string | null; speakingMs: number }[];
      expect(speakers).toHaveLength(4);
      expect(speakers.filter((row) => row.assignedParticipantId !== null)).toHaveLength(2);
      // 발화량이 한쪽으로 쏠려 있다
      const shares = speakers.map((row) => row.speakingMs).sort((a, b) => b - a);
      expect(shares[0]).toBeGreaterThan(shares[3] * 1.5);
      // 한 사람의 긴 발언이 있다
      expect(Math.max(...transcript.segments.map((row: { text: string }) => row.text.length))).toBeGreaterThan(110);
      // 분 단위 타임스탬프가 이어진다
      expect(transcript.segments.at(-1).endedAtMs).toBeGreaterThan(25 * 60_000);

      const flow = await get(`/v1/notes/${campaign}/analyses/flow`);
      expect(flow.status).toBe("REVIEWABLE");
      const review = await get<{ items: { kind: string; included: boolean; citations: unknown[]; assignee: { type: string } | null }[] }>(
        `/v1/notes/${campaign}/meeting-review`
      );
      const kinds = (kind: string) => review.items.filter((row) => row.kind === kind);
      expect(kinds("DECISION").length).toBeGreaterThanOrEqual(6);
      expect(kinds("DECISION").length).toBeLessThanOrEqual(10);
      expect(kinds("ACTION_ITEM").length).toBeGreaterThanOrEqual(8);
      expect(kinds("ACTION_ITEM").length).toBeLessThanOrEqual(12);
      const open = kinds("QUESTION").length + kinds("ISSUE").length;
      expect(open).toBeGreaterThanOrEqual(3);
      expect(open).toBeLessThanOrEqual(5);
      expect(kinds("STATUS_REPORT").length + kinds("INSIGHT").length).toBeGreaterThanOrEqual(3);
      expect(review.items.every((row) => row.kind === "AGENDA" || row.citations.length > 0)).toBe(true);
      // 지정된 화자의 할 일은 사람 이름으로, 미지정 화자의 할 일은 화자 라벨로 풀린다
      const assignees = new Set(review.items.map((row) => row.assignee?.type));
      expect(assignees.has("USER")).toBe(true);
      expect(assignees.has("SPEAKER_LABEL")).toBe(true);

      const summary = await get(`/v1/notes/${campaign}/meeting-review/summary`);
      expect(summary.status).toBe("SUCCEEDED");
      expect(summary.agendas.length).toBeGreaterThanOrEqual(3);
    });

    it("핵심 회의 2: 전사 100발화 이상, 검토 완료, 할 일이 프로젝트에 반영", async () => {
      const transcript = await get(`/v1/notes/${landing}/transcript`);
      expect(transcript.segments.length).toBeGreaterThanOrEqual(100);
      expect(transcript.segments.length).toBeLessThanOrEqual(200);
      expect(transcript.diarization.speakers).toHaveLength(3);
      expect(transcript.diarization.speakers.every((row: { assignedParticipantId: string | null }) => row.assignedParticipantId)).toBe(true);

      expect((await get(`/v1/notes/${landing}/analyses/flow`)).status).toBe("CONFIRMED");
      const review = await get<{ items: { kind: string; content: string }[] }>(`/v1/notes/${landing}/meeting-review`);
      expect(review.items.filter((row) => row.kind === "DECISION").length).toBeGreaterThanOrEqual(6);

      const note = mockDb.getNote(landing);
      const { tasks } = await get<{ tasks: { content: string; projectId: string }[] }>(
        `/v1/workspaces/${WORKSPACE}/projects/${note.projectId}/tasks`
      );
      const contents = tasks.map((row) => row.content);
      for (const item of review.items.filter((row) => row.kind === "ACTION_ITEM")) {
        expect(contents).toContain(item.content);
      }
    });

    it("핵심 회의 3: 진행 중이고 앞 전사가 있다", async () => {
      const note = mockDb.getNote(weekly);
      expect(note.meetingStatus).toBe("IN_PROGRESS");
      expect(mockDb.getCurrentSession(weekly)).toBeNull();
      const transcript = await get(`/v1/notes/${weekly}/transcript`);
      expect(transcript.segments.length).toBeGreaterThanOrEqual(15);
      expect(transcript.segments.every((row: { speakerLabel: string | null }) => row.speakerLabel === null)).toBe(true);
      // 녹음을 이어 하면 새 세션이 열린다
      expect(mockDb.createSession(weekly).status).toBe("READY");
    });

    it("중간 길이 회의는 30~80발화와 결정 2~4 · 할 일 2~5 요약을 가진다", async () => {
      const ids = mockDb
        .listWorkspaceNotes(WORKSPACE)
        .map((row) => row.noteId)
        .filter((noteId) => ![campaign, landing, weekly].includes(noteId as never));
      let mids = 0;
      for (const noteId of ids) {
        const { segments } = mockDb.getTranscript(noteId);
        if (segments.length < 30) continue;
        mids += 1;
        expect(segments.length).toBeLessThanOrEqual(80);
        const review = await get<{ items: { kind: string }[] }>(`/v1/notes/${noteId}/meeting-review`);
        const decisions = review.items.filter((row) => row.kind === "DECISION").length;
        const actions = review.items.filter((row) => row.kind === "ACTION_ITEM").length;
        expect(decisions).toBeGreaterThanOrEqual(2);
        expect(decisions).toBeLessThanOrEqual(4);
        expect(actions).toBeGreaterThanOrEqual(2);
        expect(actions).toBeLessThanOrEqual(5);
      }
      expect(mids).toBeGreaterThanOrEqual(8);
      expect(mids).toBeLessThanOrEqual(10);
    });

    it("할 일 · 용어 · 문의 · 연동 · 챗봇", async () => {
      const tasks = await get<{ tasks: { taskStatus: string; due: string | null; assignee: unknown }[]; totalCount: number }>(
        `/v1/workspaces/${WORKSPACE}/tasks`
      );
      expect(tasks.totalCount).toBeGreaterThanOrEqual(35);
      expect(tasks.totalCount).toBeLessThanOrEqual(45);
      expect(new Set(tasks.tasks.map((row) => row.taskStatus))).toEqual(new Set(["OPEN", "COMPLETED", "CANCELLED"]));
      expect(tasks.tasks.some((row) => row.assignee === null)).toBe(true);
      expect(tasks.tasks.some((row) => row.due === null)).toBe(true);

      const terms = await get<{ terms: { term: string }[] }>(`/v1/workspaces/${WORKSPACE}/terms`);
      expect(terms.terms.length).toBeGreaterThanOrEqual(20);
      expect(terms.terms.length).toBeLessThanOrEqual(30);
      const names = terms.terms.map((row) => row.term);
      expect(names).toEqual(expect.arrayContaining(["ROAS", "CTR", "전환율", "리타겟팅", "퍼널", "OKR"]));
      for (const unregistered of ["코호트", "리텐션", "이탈률"]) expect(names).not.toContain(unregistered);

      const { feedbacks } = await get<{ feedbacks: { answer: string | null; answerSeen: boolean }[] }>("/v1/feedbacks");
      expect(feedbacks.length).toBeGreaterThanOrEqual(5);
      expect(feedbacks.length).toBeLessThanOrEqual(6);
      const answered = feedbacks.filter((row) => row.answer !== null);
      expect(answered.length).toBeGreaterThanOrEqual(2);
      expect(answered.length).toBeLessThanOrEqual(3);
      expect(answered.filter((row) => !row.answerSeen)).toHaveLength(1);

      const { integrations } = await get<{ integrations: { provider: string; connected: boolean }[] }>(
        `/v1/workspaces/${WORKSPACE}/integrations`
      );
      expect(integrations.find((row) => row.provider === "LINEAR")?.connected).toBe(true);
      expect(integrations.find((row) => row.provider === "GITHUB")?.connected).toBe(false);

      const { delegations } = await get<{ delegations: { status: string }[] }>("/v1/agent-delegations");
      expect(delegations.length).toBeGreaterThanOrEqual(2);
      expect(delegations.length).toBeLessThanOrEqual(3);

      const chats = mockDb.listAgentChats({ workspaceId: WORKSPACE });
      expect(chats.length).toBeGreaterThanOrEqual(3);
      expect(chats.length).toBeLessThanOrEqual(4);
      const longest = Math.max(
        ...chats.map((chat) => mockDb.getAgentChatMessages(chat.chatId).filter((row) => row.role === "USER").length)
      );
      expect(longest).toBeGreaterThanOrEqual(3);
      expect(longest).toBeLessThanOrEqual(4);
    });

    it("사람이 보는 글에 시험용 이름 · 실제 메일 주소가 섞이지 않는다", () => {
      const state = createHelpDemoState();
      // 「테스트」 「샘플」 은 업무 용어(A/B 테스트, 샘플 제작)로 나오므로 시험용 이름이 오는 자리만 본다
      const names = JSON.stringify([
        state.user.name,
        state.workspaces.map((row) => row.name),
        state.projects.map((row) => row.name),
        state.notes.map((row) => [row.title, row.participants.map((p) => p.name)]),
        state.members.map((row) => [row.name, row.displayName]),
        state.workspaceGuests.map((row) => row.displayName),
      ]);
      for (const banned of ["테스트 유저", "샘플", "홍길동", "정리 실패"]) expect(names).not.toContain(banned);
      const all = JSON.stringify(state);
      for (const banned of ["heymoa.com", "gmail.com", "naver.com", "heymoa.dev"]) expect(all).not.toContain(banned);
      const emails = state.members.map((row) => row.email);
      expect(emails.every((email) => email.endsWith("@example.com"))).toBe(true);
    });

    it("내부 ID 가 기본 목이 새로 만드는 ID 와 겹치지 않는다", () => {
      const state = createHelpDemoState();
      const ids = [
        ...state.notes.map((row) => row.noteId),
        ...state.segments.map((row) => row.segmentId),
        ...state.sessions.map((row) => row.sessionId),
      ];
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.some((value) => /^01K0000000[1-9]\d\d$/.test(value))).toBe(false);
    });
  });
});
