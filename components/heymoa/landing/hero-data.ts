import { useMessages } from "next-intl";

import type { Demo, NoteTab } from "@/components/heymoa/landing/use-demo";
import type { TimelineTone } from "@/lib/notes/proposals/timeline";

const TOPICS: Array<{ at: string; counts: Array<[TimelineTone, number]> }> = [
  { at: "00:00", counts: [["decision", 2]] },
  {
    at: "01:02",
    counts: [
      ["task", 2],
      ["open", 1],
    ],
  },
];
const DECISIONS = [
  { at: "00:00", cites: [0] },
  { at: "00:14", cites: [1] },
];
const TASKS = [
  { who: "D", due: true, at: "01:02" },
  { who: "B", due: false, at: "01:19" },
];

export function useDoc() {
  const doc = useMessages().landing.demo.doc;
  return {
    summary: doc.summary,
    topics: TOPICS.map((topic, i) => ({ ...topic, ...doc.topics[i] })),
    decisions: DECISIONS.map((decision, i) => ({
      ...decision,
      text: doc.decisions[i],
      topic: doc.topics[0].title,
    })),
    tasks: TASKS.map((task, i) => ({
      ...task,
      text: doc.tasks[i],
      due: task.due ? doc.due : null,
    })),
  };
}

export type Scene =
  | "listen"
  | "timeline"
  | "task"
  | "open"
  | "ask"
  | "stop"
  | "paused"
  | "press"
  | "ended"
  | "analyzing"
  | "doc"
  | "evidence"
  | "confirm";

export function sceneOf(
  d: Pick<Demo, "status" | "review" | "noteTab" | "pressing" | "stopping" | "turns" | "entries">
): Scene {
  if (d.status === "ended") {
    if (d.review === 0) return d.noteTab === "summary" ? "analyzing" : "ended";
    return d.review <= 2 ? "doc" : d.review === 3 ? "evidence" : "confirm";
  }
  if (d.pressing) return "press";
  if (d.status === "paused") return "paused";
  if (d.stopping) return "stop";
  if (d.turns.some((t) => t.key.startsWith("script-"))) return "ask";
  if (d.entries >= 9) return "open";
  if (d.entries === 8) return "task";
  if (d.noteTab === "timeline") return "timeline";
  return "listen";
}

export const SCENE_TAB: Partial<Record<Scene, NoteTab>> = {
  listen: "script",
  timeline: "timeline",
  task: "timeline",
  open: "timeline",
  analyzing: "summary",
  doc: "summary",
  evidence: "summary",
  confirm: "summary",
};

export const CHAPTER_OF: Record<Scene, number> = {
  listen: 0,
  timeline: 1,
  task: 1,
  open: 1,
  ask: 2,
  stop: 3,
  paused: 3,
  press: 3,
  ended: 3,
  analyzing: 3,
  doc: 4,
  evidence: 4,
  confirm: 4,
};

export type Moment = Scene | "typed" | "asked" | "idle" | "answered";

export const ROW_IN_MS = 300;

export const HOLD_MS: Partial<Record<Moment, number>> = {
  typed: 1700,
  task: 2800,
  asked: 1400,
  open: 2800,
  idle: 1800,
  answered: 1700,
  stop: 1800,
  paused: 1200,
  ended: 1900,
  analyzing: 1500,
  doc: 1900,
  evidence: 2900,
  confirm: 2000,
};

export const ANSWERED_NARROW_MS = 400;
