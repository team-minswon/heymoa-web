import { MOCK_USER } from "@/lib/mocks/mock-user";

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
  displayName: string | null;
  email: string;
  role: "ADMIN" | "MEMBER";
  joinedDaysAgo: number;
};

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

export const HD_GUESTS = {
  taeo: { guestId: "01KH000000301", displayName: "Tyler Owens (Starlight Design)" },
  sohee: { guestId: "01KH000000302", displayName: "Rachel Young (Halo Media)" },
  jaehyun: { guestId: "01KH000000303", displayName: "Ethan Ross (Daybreak Logistics)" },
  jian: { guestId: "01KH000000304", displayName: "Ava Bennett (Grain Research)" },
} as const;

export type GuestKey = keyof typeof HD_GUESTS;

export type PersonRef = MemberKey | `g:${GuestKey}`;

export function personName(ref: PersonRef): string {
  if (ref.startsWith("g:")) return HD_GUESTS[ref.slice(2) as GuestKey].displayName;
  const member = HD_MEMBERS[ref as MemberKey] as MemberDef;
  return member.displayName ?? member.accountName;
}
