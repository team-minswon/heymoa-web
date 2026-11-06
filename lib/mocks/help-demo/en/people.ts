import { MOCK_USER } from "@/lib/mocks/mock-user";

/**
 * 가이드 캡처용 프리셋의 사람·워크스페이스·프로젝트. 전부 가상이고 이메일은 `@example.com` 이다.
 *
 * ID 는 `01KH` 로 시작한다 — 목 DB 가 새로 만드는 ID(`01K0000000100` 부터)와 겹치지 않는다.
 * 대표 워크스페이스·연습 워크스페이스만 기본 목과 같은 ID 를 쓴다(용어 사전 등 ID 로 묶인 목 모듈이 그대로 맞도록).
 */
export const HD_WORKSPACE_ID = "01K0000000000";
export const HD_PRACTICE_WORKSPACE_ID = "01K0000000009";

export const HD_PROJECTS = {
  spring: { id: "01KH000000101", name: "Spring Campaign", description: "Runs our spring ads and promotions for April and May." },
  launch: { id: "01KH000000102", name: "New Product Launch", description: "Gets the landing page, timeline, and waitlist ready for our new moisturizer." },
  interview: { id: "01KH000000103", name: "Customer Interviews", description: "Talks to customers who bought from us to collect reviews and pricing feedback." },
  weekly: { id: "01KH000000104", name: "Weekly Ops", description: null },
  brand: { id: "01KH000000105", name: "Brand Refresh", description: "Updates our logo, colors, and voice, and turns them into a brand guide." },
} as const;

export type ProjectKey = keyof typeof HD_PROJECTS;

type MemberDef = {
  userId: string;
  accountName: string;
  /** 워크스페이스에서 따로 정한 표시 이름 */
  displayName: string | null;
  email: string;
  role: "ADMIN" | "MEMBER";
  joinedDaysAgo: number;
};

/** 나는 `MOCK_USER` 의 계정이다(userId 는 그대로, 이름만 프리셋 값). */
export const HD_ME = MOCK_USER.userId;
export const HD_ME_NAME = "Emma Carter";
export const HD_ME_EMAIL = "emma.carter@example.com";

export const HD_MEMBERS = {
  seoyun: { userId: HD_ME, accountName: HD_ME_NAME, displayName: null, email: HD_ME_EMAIL, role: "ADMIN", joinedDaysAgo: 220 },
  harin: { userId: "01KH000000202", accountName: "Olivia Brooks", displayName: null, email: "olivia.brooks@example.com", role: "ADMIN", joinedDaysAgo: 214 },
  doyun: { userId: "01KH000000203", accountName: "Daniel Reyes", displayName: null, email: "daniel.reyes@example.com", role: "MEMBER", joinedDaysAgo: 190 },
  minjae: { userId: "01KH000000204", accountName: "Marcus Chen", displayName: "Marcus (Design)", email: "marcus.chen@example.com", role: "MEMBER", joinedDaysAgo: 150 },
  yuna: { userId: "01KH000000205", accountName: "Grace Kim", displayName: "Grace (Ops)", email: "grace.kim@example.com", role: "MEMBER", joinedDaysAgo: 120 },
  jiho: { userId: "01KH000000206", accountName: "Jake Morgan", displayName: null, email: "jake.morgan@example.com", role: "MEMBER", joinedDaysAgo: 90 },
  sera: { userId: "01KH000000207", accountName: "Sophie Lane", displayName: null, email: "sophie.lane@example.com", role: "MEMBER", joinedDaysAgo: 40 },
} as const satisfies Record<string, MemberDef>;

export type MemberKey = keyof typeof HD_MEMBERS;

/** 계정 없는 임시 참여자. 회사 이름도 가상이다. */
export const HD_GUESTS = {
  taeo: { guestId: "01KH000000301", displayName: "Tyler Owens (Starlight Design)" },
  sohee: { guestId: "01KH000000302", displayName: "Rachel Young (Halo Media)" },
  jaehyun: { guestId: "01KH000000303", displayName: "Ethan Ross (Daybreak Logistics)" },
  jian: { guestId: "01KH000000304", displayName: "Ava Bennett (Grain Research)" },
} as const;

export type GuestKey = keyof typeof HD_GUESTS;

/** 회의 참석자를 가리키는 열쇠. 멤버 열쇠이거나 `g:` 가 붙은 임시 참여자 열쇠다. */
export type PersonRef = MemberKey | `g:${GuestKey}`;

/** 목록에 보이는 이름(표시 이름 ?? 계정 이름). */
export function personName(ref: PersonRef): string {
  if (ref.startsWith("g:")) return HD_GUESTS[ref.slice(2) as GuestKey].displayName;
  const member = HD_MEMBERS[ref as MemberKey] as MemberDef;
  return member.displayName ?? member.accountName;
}
