import { http } from "msw";

import type {
  CreateProjectTaskRequest,
  ProjectTaskResponseData,
  ProjectTaskRevisionListResponseDataRevisionsItem,
  UpdateProjectTaskRequest,
} from "@/lib/api/generated/models";
import { getAppDateKey } from "@/lib/format/date";
import {
  assigneeFromRequest,
  resolveAssignee,
  workspaceOfProject,
  type StoredAssignee,
} from "@/lib/mocks/assignees";
import { mockDb } from "@/lib/mocks/db";
import {
  MENTORING_GUEST_IDS,
  MENTORING_NOTE_ID,
} from "@/lib/mocks/fixtures/mentoring-note";
import { failWith, paramId, respond } from "@/lib/mocks/mock-envelope";

type TaskStatus = ProjectTaskResponseData["taskStatus"];

type StoredRevision = {
  revision: number;
  content: string;
  taskStatus: TaskStatus;
  assignee: StoredAssignee | null;
  due: string | null;
  changedAt: string;
  changedBy: string | null;
  approvalId: string | null;
};

type StoredTask = {
  taskId: string;
  projectId: string;
  key: string | null;
  history: StoredRevision[];
};

const DAY_MS = 86_400_000;
let tasks: StoredTask[] | null = null;
let counter = 0;
mockDb.onReset(() => {
  tasks = null;
  counter = 0;
});

const nextId = (prefix: string) =>
  `${prefix}${String((counter += 1)).padStart(13 - prefix.length, "0")}`;

/** 오늘에서 며칠 떨어진 날. 할 일 목록의 「기한 지남 · 이번 주 · 그 뒤」가 매일 같은 모양으로 선다. */
const dayFromToday = (days: number) =>
  getAppDateKey(new Date(Date.now() + days * DAY_MS));
const hoursAgo = (hours: number) =>
  new Date(Date.now() - hours * 3_600_000).toISOString();

const current = (task: StoredTask) => task.history[task.history.length - 1];

function seed(): StoredTask[] {
  const me = mockDb.getCurrentUser().userId;
  const meetingProject = mockDb.getNote(MENTORING_NOTE_ID).projectId;
  const workspaceId = workspaceOfProject(meetingProject);
  const otherProject =
    mockDb
      .listProjects(workspaceId)
      .find((project) => project.projectId !== meetingProject)?.projectId ??
    meetingProject;
  const approvalId = nextId("01KA");

  const rows: Array<{
    key: string;
    projectId: string;
    content: string;
    status: TaskStatus;
    assignee: StoredAssignee | null;
    due: number | null;
    fromApproval?: boolean;
    edit?: { by: string; due?: number; status?: TaskStatus };
  }> = [
    {
      key: "measure-items",
      projectId: meetingProject,
      content: "한 회의에서 나온 항목 수를 잰다",
      status: "OPEN",
      assignee: { type: "GUEST", id: MENTORING_GUEST_IDS.kimMinsu },
      due: -2,
      fromApproval: true,
      edit: { by: "01K0000000020", due: -2 },
    },
    {
      key: "pricing-table",
      projectId: meetingProject,
      content: "경쟁 서비스 요금제를 표로 정리한다",
      status: "OPEN",
      assignee: { type: "USER", id: me },
      due: 3,
      fromApproval: true,
    },
    {
      key: "results-slide",
      projectId: meetingProject,
      content: "발표 자료의 결과물 장을 정리한다",
      status: "OPEN",
      assignee: { type: "GUEST", id: MENTORING_GUEST_IDS.hanJiwon },
      due: 1,
      fromApproval: true,
    },
    {
      key: "stt-cost",
      projectId: meetingProject,
      content: "STT 원가를 분 단위로 다시 잰다",
      status: "OPEN",
      // 그 회의에서 한 번도 말하지 않은 라벨이라 사람으로 풀리지 않는다.
      assignee: { type: "SPEAKER_LABEL", noteId: MENTORING_NOTE_ID, label: "F" },
      due: null,
      fromApproval: true,
    },
    {
      key: "landing-copy",
      projectId: meetingProject,
      content: "랜딩 문구 초안을 쓴다",
      status: "OPEN",
      assignee: { type: "USER", id: "01K0000000020" },
      due: 9,
    },
    {
      key: "retro",
      projectId: meetingProject,
      content: "지난 스프린트 회고를 정리한다",
      status: "OPEN",
      assignee: { type: "USER", id: me },
      due: -5,
      edit: { by: me, status: "COMPLETED" },
    },
    {
      key: "integrations",
      projectId: meetingProject,
      content: "외부 도구 연동 목록을 정리한다",
      status: "CANCELLED",
      assignee: null,
      due: null,
    },
    {
      key: "interview-questions",
      projectId: otherProject,
      content: "고객 인터뷰 질문지를 고친다",
      status: "OPEN",
      assignee: { type: "GUEST", id: "01K0000000900" },
      due: 2,
    },
    {
      key: "consent",
      projectId: otherProject,
      content: "인터뷰 녹음 동의서를 받는다",
      status: "OPEN",
      assignee: { type: "USER", id: me },
      due: -1,
    },
    {
      key: "feedback-tags",
      projectId: otherProject,
      content: "피드백 태그 기준을 정한다",
      status: "OPEN",
      assignee: null,
      due: null,
    },
    {
      key: "interview-schedule",
      projectId: otherProject,
      content: "인터뷰 일정표를 공유한다",
      status: "OPEN",
      assignee: { type: "USER", id: me },
      due: 12,
    },
  ];

  return rows.map((row, index) => {
    const first: StoredRevision = {
      revision: 1,
      content: row.content,
      taskStatus: row.status,
      assignee: row.assignee,
      due: row.due === null ? null : dayFromToday(row.due),
      changedAt: hoursAgo(72 + index),
      changedBy: row.fromApproval ? null : me,
      approvalId: row.fromApproval ? approvalId : null,
    };
    const history = [first];
    if (row.edit) {
      history.push({
        ...first,
        revision: 2,
        taskStatus: row.edit.status ?? first.taskStatus,
        due: row.edit.due === undefined ? first.due : dayFromToday(row.edit.due + 7),
        changedAt: hoursAgo(20 + index),
        changedBy: row.edit.by,
        approvalId: null,
      });
    }
    return { taskId: nextId("01KT"), projectId: row.projectId, key: row.key, history };
  });
}

const all = () => (tasks ??= seed());

function view(task: StoredTask): ProjectTaskResponseData {
  const head = current(task);
  return {
    taskId: task.taskId,
    content: head.content,
    taskStatus: head.taskStatus,
    assignee: resolveAssignee(workspaceOfProject(task.projectId), head.assignee),
    due: head.due,
    revision: head.revision,
  };
}

function revisionView(
  task: StoredTask,
  row: StoredRevision
): ProjectTaskRevisionListResponseDataRevisionsItem {
  return {
    revision: row.revision,
    content: row.content,
    taskStatus: row.taskStatus,
    assignee: resolveAssignee(workspaceOfProject(task.projectId), row.assignee),
    due: row.due,
    changedAt: row.changedAt,
    changedBy: row.changedBy,
    approvalId: row.approvalId,
  };
}

function tasksOf(workspaceId: string, projectId: string) {
  if (workspaceOfProject(projectId) !== workspaceId) {
    failWith("PROJECT_NOT_FOUND", 404, "프로젝트를 찾을 수 없습니다.");
  }
  return all().filter((task) => task.projectId === projectId);
}

function taskOf(workspaceId: string, projectId: string, taskId: string) {
  return (
    tasksOf(workspaceId, projectId).find((task) => task.taskId === taskId) ??
    failWith("NOT_FOUND", 404, "존재하지 않는 리소스입니다.")
  );
}

function requireContent(content: string | undefined) {
  if (!content?.trim()) failWith("BAD_REQUEST", 400, "잘못된 요청입니다.");
  return content;
}

export const projectTasks = {
  idOf(key: string) {
    return all().find((task) => task.key === key)?.taskId ?? "";
  },
  ids() {
    return all().map((task) => task.taskId);
  },
  revisionOf(taskId: string) {
    const task = all().find((row) => row.taskId === taskId);
    return task ? current(task).revision : 1;
  },
  /** 회의 확정이 포함된 할 일 항목마다 새 할 일을 만든다. */
  promote(
    projectId: string,
    entries: Array<{ content: string; assignee: StoredAssignee | null; due: string | null }>,
    approvalId: string
  ) {
    return entries.map((entry) => {
      const task: StoredTask = {
        taskId: nextId("01KT"),
        projectId,
        key: null,
        history: [
          {
            revision: 1,
            content: entry.content,
            taskStatus: "OPEN",
            assignee: entry.assignee,
            due: entry.due,
            changedAt: new Date().toISOString(),
            changedBy: null,
            approvalId,
          },
        ],
      };
      all().push(task);
      return { itemId: task.taskId, revision: 1 };
    });
  },
};

export const projectTaskHandlers = [
  http.get("*/v1/workspaces/:workspaceId/projects/:projectId/tasks", ({ params }) =>
    respond(() => ({
      tasks: tasksOf(paramId(params.workspaceId), paramId(params.projectId)).map(view),
    }))
  ),

  http.post(
    "*/v1/workspaces/:workspaceId/projects/:projectId/tasks",
    async ({ params, request }) =>
      respond(async () => {
        const projectId = paramId(params.projectId);
        tasksOf(paramId(params.workspaceId), projectId);
        const body = (await request.json()) as CreateProjectTaskRequest;
        if (body.assignee?.type === "SPEAKER_LABEL") {
          failWith("BAD_REQUEST", 400, "잘못된 요청입니다.");
        }
        const task: StoredTask = {
          taskId: nextId("01KT"),
          projectId,
          key: null,
          history: [
            {
              revision: 1,
              content: requireContent(body.content),
              taskStatus: "OPEN",
              assignee: assigneeFromRequest(body.assignee, null),
              due: body.due ?? null,
              changedAt: new Date().toISOString(),
              changedBy: mockDb.getCurrentUser().userId,
              approvalId: null,
            },
          ],
        };
        all().push(task);
        return view(task);
      }, 201)
  ),

  http.put(
    "*/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId",
    async ({ params, request }) =>
      respond(async () => {
        const task = taskOf(
          paramId(params.workspaceId),
          paramId(params.projectId),
          paramId(params.taskId)
        );
        const body = (await request.json()) as UpdateProjectTaskRequest;
        const head = current(task);
        if (body.revision !== head.revision) {
          failWith(
            "PROJECT_KNOWLEDGE_CONFLICT",
            409,
            "프로젝트 승인 기준이 변경되었습니다. 다시 조회해 주세요."
          );
        }
        const next = {
          content: requireContent(body.content),
          taskStatus: body.taskStatus,
          assignee: assigneeFromRequest(body.assignee, null),
          due: body.due ?? null,
        };
        const same =
          next.content === head.content &&
          next.taskStatus === head.taskStatus &&
          next.due === head.due &&
          JSON.stringify(next.assignee) === JSON.stringify(head.assignee);
        if (!same) {
          task.history.push({
            ...next,
            revision: head.revision + 1,
            changedAt: new Date().toISOString(),
            changedBy: mockDb.getCurrentUser().userId,
            approvalId: null,
          });
        }
        return view(task);
      })
  ),

  http.get(
    "*/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/revisions",
    ({ params }) =>
      respond(() => {
        const task = taskOf(
          paramId(params.workspaceId),
          paramId(params.projectId),
          paramId(params.taskId)
        );
        return { revisions: task.history.map((row) => revisionView(task, row)) };
      })
  ),
];
