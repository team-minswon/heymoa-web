import { afterEach, describe, expect, it } from "vitest";

import { buildAgendaMap } from "@/lib/projects/agenda-map";
import { createHelpDemoState, HELP_DEMO_STORAGE_KEY } from "@/lib/mocks/help-demo";
import { GUIDE_AGENDA_PROJECT_ID, guideAgendaMapLinks, guideAgendaMapSummary } from "@/lib/mocks/guide-agenda-map";
import { projectAgendaMapMock, projectAgendaMapSummary } from "@/lib/mocks/project-agenda-map";

afterEach(() => localStorage.removeItem(HELP_DEMO_STORAGE_KEY));

describe("가이드용 연결 지도 데이터", () => {
  it("프리셋이 켜졌을 때만 지도·요약 응답에 나온다", () => {
    const links = guideAgendaMapLinks();
    expect(projectAgendaMapMock(GUIDE_AGENDA_PROJECT_ID)).not.toEqual(links);
    expect(projectAgendaMapSummary(links.notes[0].noteId)?.agendas[0]?.agendaId).not.toBe(links.notes[0].agendas[0].agendaId);
    localStorage.setItem(HELP_DEMO_STORAGE_KEY, "1");
    expect(projectAgendaMapMock(GUIDE_AGENDA_PROJECT_ID)).toEqual(links);
    expect(projectAgendaMapSummary(links.notes[0].noteId)?.agendas[0].summary).toBeTruthy();
  });

  it("모양: 회의 7 · 안건 40여 개 · 주제 6, 프리셋 상태에만 프로젝트가 든다", () => {
    const links = guideAgendaMapLinks();
    expect(links.notes).toHaveLength(7);
    expect(links.notes.flatMap((note) => note.agendas).length).toBeGreaterThanOrEqual(40);
    expect(buildAgendaMap(links).flows.length).toBeGreaterThanOrEqual(6);
    const state = createHelpDemoState();
    expect(state.projects.some((project) => project.projectId === GUIDE_AGENDA_PROJECT_ID)).toBe(true);
    expect(state.notes.filter((note) => note.projectId === GUIDE_AGENDA_PROJECT_ID)).toHaveLength(7);
  });

  it("모든 안건에 요약이 있고 실제 사용자 문자열이 없다", () => {
    const links = guideAgendaMapLinks();
    for (const note of links.notes) {
      const summary = guideAgendaMapSummary(note.noteId)!;
      expect(summary.agendas.map((agenda) => agenda.agendaId)).toEqual(note.agendas.map((agenda) => agenda.agendaId));
      expect(summary.agendas.every((agenda) => (agenda.summary?.length ?? 0) > 10)).toBe(true);
    }
    const all = JSON.stringify([links, links.notes.map((note) => guideAgendaMapSummary(note.noteId))]);
    for (const banned of ["멘토링", "캠페인", "heymoa.com", "gmail.com", "@"]) expect(all).not.toContain(banned);
  });
});
