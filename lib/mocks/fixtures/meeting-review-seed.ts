import type { MeetingReviewResponseDataItemsItemKind } from "@/lib/api/generated/models";

/**
 * 멘토링 회의(`mentoring-note.ts`)의 검토본 시드. 인용은 그 회의 전사의 **순번**으로 적고,
 * 목이 실제 발화 ID로 푼다 — 스크립트 트리가 실제 줄을 가리켜야 화면을 검증할 수 있다.
 *
 * 한 회의에서 항목이 백 개 가까이 나오는 크기를 그대로 둔다. 몇 개짜리 시드로는 섹션을 접을지,
 * 주제 칩이 필요한지 판단할 수 없다.
 */
export type SeedKind = MeetingReviewResponseDataItemsItemKind;

/** 담당. 글자는 그 회의의 화자 라벨, `me` 는 목 유저다. */
export type SeedWho = "A" | "B" | "C" | "me";

export type SeedStep = {
  operation: "AMEND" | "CORRECT" | "RESOLVE" | "RETRACT";
  at: number;
  /** 이 판의 내용. 마지막 판이 검토 항목 내용이다 */
  content: string;
  role?: "SUPPORTS" | "REFUTES" | "CONDITIONS" | "RETRACTS" | "REFERENCES";
};

export type SeedItem = {
  kind: SeedKind;
  /** 처음 나온 내용. `history` 가 있으면 마지막 판 내용이 검토 항목에 선다 */
  content: string;
  at: number[];
  who?: SeedWho;
  /** 회의 날짜(9월 11일)로부터 며칠 뒤가 기한인가 */
  dueIn?: number;
  history?: SeedStep[];
  excluded?: boolean;
  /**
   * 이 결정이 대신하자고 제안된 이전 결정. `decision` 은 검토에서 이미 저장한 선택이고,
   * `endedElsewhere` 는 검토하는 사이 다른 회의의 확정이 그 결정을 먼저 끝낸 경우다
   */
  replaces?: { content: string; reason: string; decision?: "END" | "KEEP"; endedElsewhere?: boolean };
  /** 이 할 일이 바꾸자고 제안된 기존 할 일(`project-tasks` 시드의 열쇠). `decision` 은 이미 저장한 선택 */
  changesTask?: {
    task: string;
    status?: "OPEN" | "COMPLETED" | "CANCELLED";
    who?: SeedWho | null;
    dueIn?: number | null;
    reason: string;
    decision?: "APPLIED" | "KEEP";
  };
};

export type SeedTopic = {
  title: string;
  /** 뿌리 안건이 있으면 `items[0]` 이 그 안건이다 */
  hasAgenda: boolean;
  /** AI 가 중심 항목을 고르지 못한 주제. 요약의 `centerItemId` 가 비고 「주제」 관계가 없다 */
  centerless?: boolean;
  items: SeedItem[];
  /** 주제 서술. 숫자는 이 주제 `items` 의 순번이다 */
  sentences: Array<{ text: string; items: number[] }>;
};

export const REVIEW_SEED_HEADLINE =
  "회의 뒤 할 일이 흐려지는 문제를 주제별 확정으로 풀기로 했다";

export const REVIEW_SEED_LEAD: Array<{ text: string; topics: number[] }> = [
  {
    text: "문제 정의를 「회의 뒤 할 일이 확정되지 않는다」로 좁히고, 분석 결과는 주제별로 묶어 한 번에 확정하기로 했다.",
    topics: [1, 6],
  },
  {
    text: "요금은 회의 시간 기준으로 다시 계산하고, 온톨로지 작업은 다음 학기로 넘겼다.",
    topics: [2, 6],
  },
];

export const REVIEW_SEED_TOPICS: SeedTopic[] = [
  {
    title: "회의가 끝난 뒤 할 일이 흐려지는 문제",
    hasAgenda: true,
    items: [
      { kind: "AGENDA", content: "회의가 끝난 뒤 할 일이 흐려지는 문제", at: [12] },
      {
        kind: "DECISION",
        content: "문제 정의를 「회의 뒤 할 일이 정해지지 않는다」로 둔다",
        at: [12],
        history: [
          {
            operation: "AMEND",
            at: 14,
            content:
              "문제 정의를 「회의 뒤 할 일이 확정되지 않는다」 한 문장으로 좁힌다",
          },
        ],
      },
      { kind: "DECISION", content: "설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다", at: [13] },
      {
        kind: "DECISION",
        content: "첫 화면 메시지는 회의 기록보다 회의 뒤 실행 연결로 둔다",
        at: [16],
        replaces: {
          content: "첫 화면 메시지는 회의 기록 품질로 둔다",
          reason: "지난 회의의 「첫 화면 메시지는 회의 기록 품질로 둔다」를 대신합니다",
        },
      },
      { kind: "ACTION_ITEM", content: "아틀라시안 설문 원문 링크와 표본 수를 찾아 붙인다", at: [12], who: "A", dueIn: 4 },
      { kind: "ACTION_ITEM", content: "문제 정의 슬라이드를 한 장으로 줄인다", at: [15], who: "B", dueIn: 5 },
      { kind: "ACTION_ITEM", content: "회의 뒤 할 일이 사라진 실제 사례 세 개를 모은다", at: [17], who: "C" },
      { kind: "ACTION_ITEM", content: "경쟁 도구의 회의 뒤 흐름을 캡처해 비교표를 만든다", at: [18], who: "me", dueIn: 7 },
      { kind: "ISSUE", content: "설문의 54%가 우리 사용자층에도 맞는 수치인지 알 수 없다", at: [13] },
      { kind: "QUESTION", content: "팀 내부 회의만으로 문제를 검증했다고 말할 수 있나", at: [19] },
      { kind: "STATUS_REPORT", content: "설문 자료는 아틀라시안 보고서에서 가져왔다", at: [12] },
      { kind: "STATUS_REPORT", content: "팀 회의 여섯 번을 직접 기록해 봤다", at: [11] },
      { kind: "INSIGHT", content: "기록이 없어서가 아니라 누가 할지 안 정해서 놓친다", at: [14] },
    ],
    sentences: [
      { text: "회의 뒤 할 일이 흐려지는 문제를 한 문장으로 좁히고, 설문 근거는 출처와 함께 적기로 했다.", items: [1, 2] },
      { text: "첫 화면 메시지를 실행 연결로 바꾸고, 사례 수집과 비교표를 나눠 맡았다.", items: [3, 6, 7] },
    ],
  },
  {
    title: "차별점과 요금",
    hasAgenda: true,
    items: [
      { kind: "AGENDA", content: "차별점과 요금 정리", at: [24] },
      { kind: "DECISION", content: "차별점은 「외부 도구까지 읽고 답하는 에이전트」로 쓴다", at: [24, 25] },
      {
        kind: "DECISION",
        content: "요금은 좌석 기준으로 계산한다",
        at: [106],
        history: [
          {
            operation: "CORRECT",
            at: 108,
            content: "요금은 좌석이 아니라 회의 시간 기준으로 계산한다",
            role: "REFUTES",
          },
        ],
      },
      { kind: "DECISION", content: "무료 구간은 월 5시간으로 둔다", at: [109] },
      { kind: "ACTION_ITEM", content: "요금 계산표에 STT 원가를 분 단위로 넣는다", at: [108], who: "A", dueIn: 7 },
      { kind: "ACTION_ITEM", content: "차별점 세 줄을 랜딩 문구 초안에 옮긴다", at: [25], who: "B", dueIn: 6 },
      {
        kind: "ACTION_ITEM",
        content: "경쟁 서비스 요금제를 한 표로 정리한다",
        at: [107],
        who: "C",
        changesTask: {
          task: "pricing-table",
          who: null,
          dueIn: null,
          reason: "요금제 표는 이번 회의에서 다시 맡기로 해 담당과 기한을 비웁니다",
        },
      },
      { kind: "ACTION_ITEM", content: "무료 구간 5시간의 원가를 다시 계산한다", at: [109] },
      { kind: "ISSUE", content: "외부 도구 연동이 늘면 요금 원가가 흔들린다", at: [26] },
      { kind: "QUESTION", content: "팀 단위 요금제가 따로 필요한가", at: [111] },
      { kind: "STATUS_REPORT", content: "지금 요금 계산은 좌석 기준 초안이다", at: [106] },
      { kind: "INSIGHT", content: "요금 계산이 가장 잘 정리된 부분이라는 평가를 받았다", at: [108] },
    ],
    sentences: [
      { text: "차별점을 외부 도구까지 읽는 에이전트로 쓰고, 요금은 회의 시간 기준으로 바꾸기로 했다.", items: [1, 2] },
      { text: "무료 구간 원가와 경쟁 요금제 비교가 남았다.", items: [3, 6, 7] },
    ],
  },
  {
    title: "인프라와 운영 비용",
    hasAgenda: false,
    items: [
      { kind: "DECISION", content: "ECS 파게이트 구성을 이번 학기 동안 유지한다", at: [36] },
      { kind: "DECISION", content: "토큰 사용량은 슈퍼베이스에 모아 주 단위로 본다", at: [48] },
      { kind: "ACTION_ITEM", content: "작업별 토큰 기록을 대시보드로 묶는다", at: [48, 49], who: "A", dueIn: 8 },
      { kind: "ACTION_ITEM", content: "ECS 월 비용을 서비스별로 나눠 적는다", at: [37], who: "B" },
      { kind: "ACTION_ITEM", content: "로컬 토큰 기록이 빠지는 경우를 찾는다", at: [50], who: "C", dueIn: 10 },
      { kind: "ISSUE", content: "법적 검토 없이 음성 데이터를 오래 보관하고 있다", at: [60] },
      { kind: "QUESTION", content: "슈퍼베이스 무료 한도를 언제 넘나", at: [49] },
      { kind: "STATUS_REPORT", content: "지금은 ECS 파게이트로 서버 셋을 돌린다", at: [36] },
      { kind: "STATUS_REPORT", content: "토큰 기록은 단계 전환마다 로컬에 남긴다", at: [48] },
      { kind: "INSIGHT", content: "비용보다 데이터 보관 기간이 먼저 걸림돌이다", at: [60] },
    ],
    sentences: [
      { text: "지금 인프라는 유지하고 토큰 사용량을 주 단위로 보기로 했다.", items: [0, 1, 2] },
      { text: "음성 데이터 보관에 법적 검토가 빠져 있다는 이슈가 남았다.", items: [5] },
    ],
  },
  {
    title: "AI 활용 개발과 문서 체계",
    hasAgenda: false,
    items: [
      { kind: "DECISION", content: "문서는 PRD, spec, 이슈 순서로 한 저장소에 모은다", at: [168] },
      { kind: "DECISION", content: "AI 활용 개발 절차를 발표 자료 한 장으로 넣는다", at: [156] },
      { kind: "ACTION_ITEM", content: "문서 양이 늘어난 과정을 그림 한 장으로 그린다", at: [168], who: "C", dueIn: 11 },
      { kind: "ACTION_ITEM", content: "하네스 규칙 중 발표에 쓸 셋을 고른다", at: [170], who: "A" },
      { kind: "ACTION_ITEM", content: "AI 리뷰로 잡은 버그 사례를 두 개 정리한다", at: [158], who: "me", dueIn: 9 },
      { kind: "STATUS_REPORT", content: "이슈마다 spec 을 쓰고 리뷰를 거친다", at: [165] },
      { kind: "INSIGHT", content: "문서 양이 많아서 체계가 먼저 필요했다", at: [168] },
      { kind: "INSIGHT", content: "복잡해 보여도 흐름이 보이면 괜찮다", at: [144] },
    ],
    sentences: [
      { text: "문서를 한 저장소에 모으는 절차를 발표에 한 장으로 넣기로 했다.", items: [0, 1, 2] },
    ],
  },
  {
    title: "실시간 스크립트 표시",
    hasAgenda: true,
    items: [
      { kind: "AGENDA", content: "실시간 스크립트를 어떻게 보여 줄지", at: [192] },
      { kind: "DECISION", content: "확정 전 문장은 흐리게 먼저 보이고 확정되면 바꾼다", at: [192, 194] },
      {
        kind: "DECISION",
        content: "음성 데이터 저장 주기는 10분 단위로 둔다",
        at: [288],
        history: [
          { operation: "CORRECT", at: 290, content: "음성 데이터 저장 주기는 5분 단위로 둔다" },
        ],
      },
      { kind: "ACTION_ITEM", content: "부분 인식 문장 표시를 모바일에서도 확인한다", at: [193], who: "B", dueIn: 8 },
      { kind: "ACTION_ITEM", content: "STT 지연 시간을 회의 길이별로 잰다", at: [195], who: "C", dueIn: 13 },
      { kind: "ACTION_ITEM", content: "저장 주기 5분의 복구 시나리오를 문서로 남긴다", at: [289], who: "A" },
      { kind: "ISSUE", content: "보여 주기용 중간 결과가 실제 지연을 가린다", at: [216] },
      { kind: "QUESTION", content: "STT 엔진 둘을 함께 쓰나", at: [336] },
      { kind: "STATUS_REPORT", content: "지금은 빠르게 보여 주려고 중간 결과를 먼저 띄운다", at: [192] },
    ],
    sentences: [
      { text: "확정 전 문장을 흐리게 먼저 보이고, 음성 저장 주기는 5분으로 줄이기로 했다.", items: [1, 2] },
      { text: "중간 결과가 지연을 가린다는 이슈는 지연 측정으로 확인한다.", items: [6, 4] },
    ],
  },
  {
    title: "분석 결과가 너무 많이 나온다",
    hasAgenda: true,
    items: [
      { kind: "AGENDA", content: "회의 뒤 분석 결과가 너무 많이 나오는 문제", at: [408] },
      {
        kind: "DECISION",
        content: "확정은 주제별로 묶어 검토한다",
        at: [410, 420],
        history: [
          { operation: "AMEND", at: 422, content: "확정은 주제별로 묶어 한 번에 검토한다" },
        ],
      },
      { kind: "DECISION", content: "할 일과 결정만 앞에 두고 나머지는 참고로 접는다", at: [421] },
      {
        kind: "DECISION",
        content: "온톨로지 작업은 다음 학기로 미룬다",
        at: [444],
        replaces: {
          content: "온톨로지를 이번 학기 안에 붙인다",
          reason: "지난 회의의 「온톨로지를 이번 학기 안에 붙인다」를 대신합니다",
          decision: "KEEP",
          endedElsewhere: true,
        },
      },
      {
        kind: "ACTION_ITEM",
        content: "한 회의에서 나온 항목 수를 회의 열 개로 잰다",
        at: [420],
        who: "B",
        dueIn: 7,
        changesTask: {
          task: "measure-items",
          who: "B",
          dueIn: 7,
          reason: "같은 측정을 상어가 이어받고 기한을 다음 주로 옮깁니다",
          decision: "KEEP",
        },
      },
      { kind: "ACTION_ITEM", content: "주제 묶음 요약 화면 시안을 만든다", at: [410], who: "A", dueIn: 9 },
      { kind: "ACTION_ITEM", content: "참고로 접을 종류를 정리해 공유한다", at: [421], who: "C" },
      { kind: "ACTION_ITEM", content: "결정 대체 제안이 틀린 사례를 모은다", at: [425] },
      { kind: "ISSUE", content: "기능이 늘면 사용자인 팀도 결과를 다 못 본다", at: [432] },
      { kind: "ISSUE", content: "온톨로지 없이 관계를 얼마나 믿을 수 있나", at: [444] },
      {
        kind: "QUESTION",
        content: "사람이 고친 항목을 다음 분석이 알아야 하나",
        at: [412],
        history: [
          { operation: "RESOLVE", at: 430, content: "사람이 고친 항목은 다음 분석의 입력에 넣는다" },
        ],
      },
      { kind: "STATUS_REPORT", content: "지금 분석은 결정과 할 일을 따로 만들어 준다", at: [408] },
      { kind: "INSIGHT", content: "사용자는 전부가 아니라 바뀐 것만 보고 싶어 한다", at: [420] },
    ],
    sentences: [
      { text: "결과가 너무 많다는 문제에 주제별로 묶어 한 번에 확정하는 방식으로 답했다.", items: [1, 2] },
      { text: "온톨로지는 다음 학기로 미루고, 항목 수를 먼저 재기로 했다.", items: [3, 4] },
    ],
  },
  {
    title: "결과물과 기대 효과",
    hasAgenda: false,
    items: [
      { kind: "DECISION", content: "기대 효과는 줄어든 회의 뒤 정리 시간으로 잰다", at: [264] },
      { kind: "ACTION_ITEM", content: "회의 뒤 정리 시간을 전후로 재는 방법을 정한다", at: [265], who: "C", dueIn: 14 },
      {
        kind: "ACTION_ITEM",
        content: "구현 결과를 기대 효과 순서로 다시 배치한다",
        at: [264],
        who: "A",
        changesTask: {
          task: "results-slide",
          status: "COMPLETED",
          reason: "결과물 장 정리는 이번 회의 전에 끝났다고 말했습니다",
        },
      },
      { kind: "QUESTION", content: "멘토 피드백을 보고서에 어떻게 반영하나", at: [276] },
      { kind: "STATUS_REPORT", content: "결과물 설명은 방식 위주로만 나와 있다", at: [264] },
      { kind: "INSIGHT", content: "방식보다 무엇이 줄었는지를 보여 줘야 한다", at: [266] },
    ],
    sentences: [
      { text: "기대 효과를 정리 시간 감소로 재기로 하고 측정 방법을 정한다.", items: [0, 1] },
    ],
  },
  {
    title: "다음 멘토링과 활동비",
    hasAgenda: false,
    centerless: true,
    items: [
      { kind: "DECISION", content: "다음 멘토링은 다음 주 중간 시간대로 잡는다", at: [468] },
      { kind: "ACTION_ITEM", content: "가능한 시간대를 모아 멘토님께 보낸다", at: [468], who: "B", dueIn: 4 },
      { kind: "ACTION_ITEM", content: "활동비를 다시 신청한다", at: [384], who: "C", dueIn: 8 },
      { kind: "ACTION_ITEM", content: "보고서와 발표 자료를 함께 만든다", at: [384], who: "A", dueIn: 15 },
      { kind: "STATUS_REPORT", content: "활동비 신청은 다시 준비하고 있다", at: [384] },
    ],
    sentences: [
      { text: "다음 멘토링 시간을 모으고 활동비와 보고서를 다시 준비한다.", items: [0, 1, 2] },
    ],
  },
];

/** 어느 주제에도 묶이지 않은 항목. 관계 판정이 없으면 이렇게 남는다. */
export const REVIEW_SEED_LOOSE: SeedItem[] = [
  { kind: "DECISION", content: "에어플로우는 배치 작업에만 쓴다", at: [372] },
  { kind: "ACTION_ITEM", content: "툴 에이전트 목록과 개수를 문서에 적는다", at: [240] },
  { kind: "ISSUE", content: "회의 내용이 바뀌면 알림이 필요하다", at: [348] },
  { kind: "QUESTION", content: "툴 에이전트는 몇 개가 적당한가", at: [240] },
  { kind: "INSIGHT", content: "에어플로우는 배치에서 가장 흔히 쓴다", at: [372] },
  { kind: "STATUS_REPORT", content: "마스크 때문에 인식률이 떨어졌다", at: [96] },
  { kind: "STATUS_REPORT", content: "발표 순서는 김민수가 맡는다", at: [84] },
  { kind: "AGENDA", content: "질의응답", at: [300] },
  { kind: "INSIGHT", content: "보완할 부분을 먼저 물어보는 게 좋다", at: [312] },
  { kind: "STATUS_REPORT", content: "실시간 요약은 지금도 동작한다", at: [396] },
  { kind: "ACTION_ITEM", content: "마스크를 벗고 다시 녹음한다", at: [96], excluded: true },
];
