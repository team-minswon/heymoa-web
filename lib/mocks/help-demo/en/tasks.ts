import { NOTE_DEFS, type NoteDef } from "@/lib/mocks/help-demo/en/notes";
import {
  HD_ME,
  HD_GUESTS,
  HD_MEMBERS,
  HD_PROJECTS,
  type PersonRef,
} from "@/lib/mocks/help-demo/en/people";
import { helpDemoReviewSets } from "@/lib/mocks/help-demo/en/reviews";

/**
 * 프로젝트 할 일 시드 한 줄. `project-tasks.ts` 의 시드가 같은 모양을 쓴다.
 * `due` 는 오늘에서 며칠 떨어진 날(음수는 기한 지남), `null` 은 기한 없음이다.
 */
export type TaskSeedRow = {
  key: string;
  projectId: string;
  content: string;
  status: "OPEN" | "COMPLETED" | "CANCELLED";
  assignee:
    | { type: "USER" | "GUEST"; id: string }
    | { type: "SPEAKER_LABEL"; noteId: string; label: string }
    | null;
  due: number | null;
  /** 회의 확정에서 생긴 할 일이다 */
  fromApproval?: boolean;
  edit?: {
    by: string;
    due?: number;
    status?: "OPEN" | "COMPLETED" | "CANCELLED";
    /** 외부 에이전트 연결이 `by` 의 이름으로 고친 판이다. null 이면 그 연결 행이 지워졌다 */
    via?: { delegationId: string; name: string } | null;
  };
};

const person = (ref: PersonRef | null): TaskSeedRow["assignee"] => {
  if (!ref) return null;
  if (ref.startsWith("g:")) {
    return { type: "GUEST", id: HD_GUESTS[ref.slice(2) as keyof typeof HD_GUESTS].guestId };
  }
  return { type: "USER", id: HD_MEMBERS[ref as keyof typeof HD_MEMBERS].userId };
};

const PROJECT = (key: NoteDef["project"]) => HD_PROJECTS[key].id;

/**
 * 확정된 회의(핵심 회의 2와 확정 상태의 중간 회의)의 할 일 항목이 그대로 프로젝트 할 일이 된 것.
 * 담당은 화자 라벨 → 참석자로 풀고, 기한은 회의 날짜 기준 `dueIn` 을 오늘 기준으로 옮긴다.
 * 오래된 회의의 할 일은 대부분 끝난 것으로, 하나는 기한이 지난 채 남은 것으로 둔다.
 */
function approvedRows(): TaskSeedRow[] {
  return helpDemoReviewSets()
    .filter((set) => set.flow === "CONFIRMED")
    .flatMap((set) => {
      const def = NOTE_DEFS.find((row) => row.noteId === set.noteId)!;
      const speakers = def.speakers ?? [];
      return set.topics
        .flatMap((topic) => topic.items)
        .filter((item) => item.kind === "ACTION_ITEM")
        .map((item, index): TaskSeedRow => {
          const who = item.who;
          const assignee =
            who === undefined
              ? null
              : who === "me"
                ? { type: "USER" as const, id: HD_ME }
                : who.startsWith("user:")
                  ? { type: "USER" as const, id: who.slice(5) }
                  : person(speakers["ABCD".indexOf(who)] ?? null);
          const old = def.daysAgo >= 14;
          const done = old && index % 3 !== 0;
          return {
            key: `${def.key}-${index + 1}`,
            projectId: PROJECT(def.project),
            content: item.content,
            status: done ? "COMPLETED" : "OPEN",
            assignee,
            due: (item.dueIn ?? 7) - def.daysAgo,
            fromApproval: true,
            edit: done ? { by: (assignee && "id" in assignee && assignee.id) || HD_ME, status: "COMPLETED" } : undefined,
          };
        });
    });
}

const manual = (
  key: string,
  project: NoteDef["project"],
  content: string,
  assignee: PersonRef | null,
  due: number | null,
  status: TaskSeedRow["status"] = "OPEN"
): TaskSeedRow => ({
  key,
  projectId: PROJECT(project),
  content,
  status,
  assignee: person(assignee),
  due,
  edit: status === "COMPLETED" ? { by: HD_ME, status: "COMPLETED" } : undefined,
});

/** 손으로 둔 할 일. 기한은 지남 · 오늘 · 이번 주 · 그 뒤 · 없음이 고르게 섞인다. */
const MANUAL_ROWS: TaskSeedRow[] = [
  manual("spring-1", "spring", "Draft review-based copy for May ad creative", "minjae", 3),
  manual("spring-2", "spring", "Reorganize search ad keyword groups", "doyun", -1),
  manual("spring-3", "spring", "Confirm tracking numbers for influencer product shipments", "doyun", -4, "COMPLETED"),
  manual("spring-4", "spring", "Design the regional comparison test for display", "doyun", 4),
  manual("spring-5", "spring", "Swap the banner on the Spring Campaign landing page", "minjae", 0),
  manual("spring-6", "spring", "Clean up sharing permissions on the April performance report sheet", "seoyun", -2),
  manual("spring-7", "spring", "Summarize month-end campaign budget spend", "harin", 6),
  manual("spring-8", "spring", "Collect competitors' spring promotions", null, null, "CANCELLED"),
  manual("launch-1", "launch", "Check the privacy consent text on the waitlist form", "seoyun", 1),
  manual("launch-2", "launch", "Create the how-to-use images for the product detail page", "minjae", 5),
  manual("launch-3", "launch", "Check the result of the payment integration review", "jiho", -1),
  manual("launch-4", "launch", "Collect review consent forms from beta testers", "sera", 2),
  manual("launch-5", "launch", "Write the launch day customer support script", "yuna", 9),
  manual("launch-6", "launch", "Compare quotes from packaging printers", "sera", -6, "COMPLETED"),
  manual("interview-1", "interview", "Reach out to round 4 interview participants", "minjae", 3),
  manual("interview-2", "interview", "Prepare gift cards for interview participants", "seoyun", -3),
  manual("interview-3", "interview", "Share the interview transcript summaries", "minjae", -5, "COMPLETED"),
  manual("interview-4", "interview", "Check survey responses for duplicates", "g:jian", 2),
  manual("weekly-1", "weekly", "Update ticket routing rules to prioritize exchanges and refunds", "jiho", 3),
  manual("weekly-2", "weekly", "Send the late delivery coupon text message", "yuna", 0),
  manual("weekly-3", "weekly", "Document the compensation rule for the delayed carrier route", "sera", 4),
  manual("weekly-4", "weekly", "Request purchase of two barcode scanners", "jiho", 5),
  manual("weekly-5", "weekly", "Draft the holiday support coverage plan", "yuna", 8),
  manual("weekly-6", "weekly", "Clean up the ten most-used reply templates", "seoyun", 7),
  manual("weekly-7", "weekly", "Confirm restock dates for sold-out items with logistics", "g:jaehyun", 1),
  manual("brand-1", "brand", "Bring the combined logo concept", "g:taeo", 6),
  manual("brand-2", "brand", "Write sample lines for the brand voice", "minjae", 10),
  manual("brand-3", "brand", "Add a fallback fonts section to the brand guide", "g:taeo", 11),
  manual("brand-5", "brand", "Write the purchase request for the brand refresh", "harin", 13),
  manual("brand-6", "brand", "List everywhere the current logo is used", "seoyun", -7, "COMPLETED"),
];

export function helpDemoTaskRows(): TaskSeedRow[] {
  return [...approvedRows(), ...MANUAL_ROWS];
}
