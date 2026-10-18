import { AB_MEETING, VISUAL_MEETING, type MidMeeting } from "@/lib/mocks/help-demo/mid-campaign";
import {
  BRAND_MEETING,
  INTERVIEW2_MEETING,
  INTERVIEW3_MEETING,
  LAUNCH_MEETING,
  MAIL_MEETING,
  WEEKLY_PAST_MEETING,
} from "@/lib/mocks/help-demo/mid-others";
import type { MidKey } from "@/lib/mocks/help-demo/notes";

export const MID_MEETINGS: Record<MidKey, MidMeeting> = {
  visual: VISUAL_MEETING,
  abtest: AB_MEETING,
  launch: LAUNCH_MEETING,
  mail: MAIL_MEETING,
  int3: INTERVIEW3_MEETING,
  int2: INTERVIEW2_MEETING,
  weeklyPast: WEEKLY_PAST_MEETING,
  brand: BRAND_MEETING,
};

/** 중간 길이 회의의 회의 뒤 흐름 상태. 확정된 것과 검토 전인 것을 섞는다. */
export const MID_FLOW: Record<MidKey, "REVIEWABLE" | "CONFIRMED"> = {
  visual: "REVIEWABLE",
  abtest: "CONFIRMED",
  launch: "REVIEWABLE",
  mail: "CONFIRMED",
  int3: "REVIEWABLE",
  int2: "CONFIRMED",
  weeklyPast: "REVIEWABLE",
  brand: "REVIEWABLE",
};
