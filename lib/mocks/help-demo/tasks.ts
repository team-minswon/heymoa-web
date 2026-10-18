import { NOTE_DEFS, type NoteDef } from "@/lib/mocks/help-demo/notes";
import {
  HD_ME,
  HD_GUESTS,
  HD_MEMBERS,
  HD_PROJECTS,
  type PersonRef,
} from "@/lib/mocks/help-demo/people";
import { helpDemoReviewSets } from "@/lib/mocks/help-demo/reviews";

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
  edit?: { by: string; due?: number; status?: "OPEN" | "COMPLETED" | "CANCELLED" };
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
  manual("spring-1", "spring", "5월 광고 소재 후기 문구 초안을 쓴다", "minjae", 3),
  manual("spring-2", "spring", "검색 광고 키워드 그룹을 다시 정리한다", "doyun", -1),
  manual("spring-3", "spring", "인플루언서 제품 발송 송장을 확인한다", "doyun", -4, "COMPLETED"),
  manual("spring-4", "spring", "디스플레이 지역 비교 테스트를 설계한다", "doyun", 4),
  manual("spring-5", "spring", "봄 캠페인 랜딩 페이지 배너를 교체한다", "minjae", 0),
  manual("spring-6", "spring", "4월 성과 리포트 시트의 공유 권한을 정리한다", "seoyun", -2),
  manual("spring-7", "spring", "월말 캠페인 예산 사용 현황을 정리한다", "harin", 6),
  manual("spring-8", "spring", "경쟁 브랜드의 봄 프로모션을 모아 본다", null, null, "CANCELLED"),
  manual("launch-1", "launch", "사전 신청 폼의 개인정보 동의 문구를 확인한다", "seoyun", 1),
  manual("launch-2", "launch", "상세 페이지에 넣을 사용 순서 이미지를 만든다", "minjae", 5),
  manual("launch-3", "launch", "결제 연동 심사 결과를 확인한다", "jiho", -1),
  manual("launch-4", "launch", "베타 테스터 후기 사용 동의서를 회수한다", "sera", 2),
  manual("launch-5", "launch", "출시 당일 고객 응대 스크립트를 작성한다", "yuna", 9),
  manual("launch-6", "launch", "패키지 인쇄 업체 견적을 비교한다", "sera", -6, "COMPLETED"),
  manual("interview-1", "interview", "4차 인터뷰 참가자에게 연락한다", "minjae", 3),
  manual("interview-2", "interview", "인터뷰 사례비 상품권을 준비한다", "seoyun", -3),
  manual("interview-3", "interview", "인터뷰 녹취 요약을 공유한다", "minjae", -5, "COMPLETED"),
  manual("interview-4", "interview", "설문 응답 중복을 확인한다", "g:jian", 2),
  manual("weekly-1", "weekly", "문의 분류 규칙을 교환 · 환불 우선으로 고친다", "jiho", 3),
  manual("weekly-2", "weekly", "배송 지연 쿠폰 안내 문자를 보낸다", "yuna", 0),
  manual("weekly-3", "weekly", "택배사 지연 구간 보상 기준을 문서로 남긴다", "sera", 4),
  manual("weekly-4", "weekly", "바코드 스캐너 두 대 구매를 요청한다", "jiho", 5),
  manual("weekly-5", "weekly", "연휴 응대 계획 초안을 쓴다", "yuna", 8),
  manual("weekly-6", "weekly", "자주 쓰는 답변 템플릿 열 개를 정리한다", "seoyun", 7),
  manual("weekly-7", "weekly", "품절 상품의 입고 일정을 물류에 확인한다", "g:jaehyun", 1),
  manual("brand-1", "brand", "로고 합친 시안을 가져온다", "g:taeo", 6),
  manual("brand-2", "brand", "문구 톤 예시 문장을 만든다", "minjae", 10),
  manual("brand-3", "brand", "브랜드 가이드에 대체 글꼴 항목을 추가한다", "g:taeo", 11),
  manual("brand-5", "brand", "브랜드 리뉴얼 발주 품의서를 쓴다", "harin", 13),
  manual("brand-6", "brand", "기존 로고 사용처 목록을 만든다", "seoyun", -7, "COMPLETED"),
];

export function helpDemoTaskRows(): TaskSeedRow[] {
  return [...approvedRows(), ...MANUAL_ROWS];
}
