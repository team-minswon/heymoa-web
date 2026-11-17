import { MOCK_USER } from "@/lib/mocks/mock-user";

export const HD_WORKSPACE_ID = "01K0000000000";
export const HD_PRACTICE_WORKSPACE_ID = "01K0000000009";

export const HD_PROJECTS = {
  spring: { id: "01KH000000101", name: "봄 캠페인", description: "4~5월 봄 시즌 광고와 프로모션을 운영합니다." },
  launch: { id: "01KH000000102", name: "신제품 출시 준비", description: "신제품 수분 크림의 소개 페이지, 일정, 사전 신청을 준비합니다." },
  interview: { id: "01KH000000103", name: "고객 인터뷰", description: "구매 고객을 만나 후기와 가격 반응을 모읍니다." },
  weekly: { id: "01KH000000104", name: "주간 운영", description: null },
  brand: { id: "01KH000000105", name: "브랜드 리뉴얼", description: "로고, 색, 문구 톤을 정리해 브랜드 가이드를 만듭니다." },
} as const;

export type ProjectKey = keyof typeof HD_PROJECTS;

type MemberDef = {
  userId: string;
  accountName: string;
  displayName: string | null;
  email: string;
  role: "ADMIN" | "MEMBER";
  joinedDaysAgo: number;
};

export const HD_ME = MOCK_USER.userId;
export const HD_ME_NAME = "김서윤";
export const HD_ME_EMAIL = "seoyun.kim@example.com";

export const HD_MEMBERS = {
  seoyun: { userId: HD_ME, accountName: HD_ME_NAME, displayName: null, email: HD_ME_EMAIL, role: "ADMIN", joinedDaysAgo: 220 },
  harin: { userId: "01KH000000202", accountName: "이하린", displayName: null, email: "harin.lee@example.com", role: "ADMIN", joinedDaysAgo: 214 },
  doyun: { userId: "01KH000000203", accountName: "박도윤", displayName: null, email: "doyun.park@example.com", role: "MEMBER", joinedDaysAgo: 190 },
  minjae: { userId: "01KH000000204", accountName: "최민재", displayName: "민재 (디자인)", email: "minjae.choi@example.com", role: "MEMBER", joinedDaysAgo: 150 },
  yuna: { userId: "01KH000000205", accountName: "정유나", displayName: "유나 (운영)", email: "yuna.jung@example.com", role: "MEMBER", joinedDaysAgo: 120 },
  jiho: { userId: "01KH000000206", accountName: "한지호", displayName: null, email: "jiho.han@example.com", role: "MEMBER", joinedDaysAgo: 90 },
  sera: { userId: "01KH000000207", accountName: "오세라", displayName: null, email: "sera.oh@example.com", role: "MEMBER", joinedDaysAgo: 40 },
} as const satisfies Record<string, MemberDef>;

export type MemberKey = keyof typeof HD_MEMBERS;

export const HD_GUESTS = {
  taeo: { guestId: "01KH000000301", displayName: "강태오 (별빛 디자인)" },
  sohee: { guestId: "01KH000000302", displayName: "윤소희 (달무리 미디어)" },
  jaehyun: { guestId: "01KH000000303", displayName: "임재현 (새벽 물류)" },
  jian: { guestId: "01KH000000304", displayName: "배지안 (모래알 리서치)" },
} as const;

export type GuestKey = keyof typeof HD_GUESTS;

export type PersonRef = MemberKey | `g:${GuestKey}`;

export function personName(ref: PersonRef): string {
  if (ref.startsWith("g:")) return HD_GUESTS[ref.slice(2) as GuestKey].displayName;
  const member = HD_MEMBERS[ref as MemberKey] as MemberDef;
  return member.displayName ?? member.accountName;
}
