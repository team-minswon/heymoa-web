import type { NoteResponseData, ProjectMeetingLinksResponseData } from "@/lib/api/generated/models";
import type { StoreState } from "@/lib/mocks/db";
import type { SeedItem } from "@/lib/mocks/fixtures/meeting-review-seed";
import * as koAgenda from "@/lib/mocks/guide-agenda-map";
import * as enAgenda from "@/lib/mocks/help-demo/en/guide-agenda-map";
import * as enMid from "@/lib/mocks/help-demo/en/mid";
import * as enMisc from "@/lib/mocks/help-demo/en/misc";
import * as enNotes from "@/lib/mocks/help-demo/en/notes";
import * as enPeople from "@/lib/mocks/help-demo/en/people";
import * as enReviews from "@/lib/mocks/help-demo/en/reviews";
import * as enCampaign from "@/lib/mocks/help-demo/en/script-campaign";
import * as enLanding from "@/lib/mocks/help-demo/en/script-landing";
import * as enWeekly from "@/lib/mocks/help-demo/en/script-weekly";
import * as enSmall from "@/lib/mocks/help-demo/en/small";
import * as enTasks from "@/lib/mocks/help-demo/en/tasks";
import * as enText from "@/lib/mocks/help-demo/en/text";
import { helpDemoLocale, type HelpDemoLocale } from "@/lib/mocks/help-demo/locale";
import type { MidMeeting } from "@/lib/mocks/help-demo/mid-campaign";
import * as koMid from "@/lib/mocks/help-demo/mid";
import * as koMisc from "@/lib/mocks/help-demo/misc";
import * as koNotes from "@/lib/mocks/help-demo/notes";
import type { MidKey, NoteDef } from "@/lib/mocks/help-demo/notes";
import * as koPeople from "@/lib/mocks/help-demo/people";
import type { GuestKey, MemberKey, PersonRef, ProjectKey } from "@/lib/mocks/help-demo/people";
import * as koReviews from "@/lib/mocks/help-demo/reviews";
import type { HelpDemoReviewSet } from "@/lib/mocks/help-demo/reviews";
import type { ParsedScript } from "@/lib/mocks/help-demo/script";
import * as koCampaign from "@/lib/mocks/help-demo/script-campaign";
import * as koLanding from "@/lib/mocks/help-demo/script-landing";
import * as koWeekly from "@/lib/mocks/help-demo/script-weekly";
import * as koSmall from "@/lib/mocks/help-demo/small";
import type { SmallKey } from "@/lib/mocks/help-demo/small";
import * as koTasks from "@/lib/mocks/help-demo/tasks";
import type { TaskSeedRow } from "@/lib/mocks/help-demo/tasks";
import * as koText from "@/lib/mocks/help-demo/text";
import type { MeetingReviewSummary } from "@/lib/notes/review/summary";

/**
 * 가이드 캡처 프리셋 한 벌(APP-1511). 한국어(`./*.ts`)와 영어(`./en/*.ts`)가 같은 ID·같은 모양을 내고,
 * 소비자(`build.ts` · 목 핸들러)는 이 팩으로만 읽는다 — 한쪽에만 고치면 다른 언어의 캡처가 어긋난다.
 */
export type HelpDemoPack = {
  projects: Record<ProjectKey, { id: string; name: string; description: string | null }>;
  members: Record<
    MemberKey,
    {
      userId: string;
      accountName: string;
      displayName: string | null;
      email: string;
      role: "ADMIN" | "MEMBER";
      joinedDaysAgo: number;
    }
  >;
  guests: Record<GuestKey, { guestId: string; displayName: string }>;
  meName: string;
  meEmail: string;
  personName: (ref: PersonRef) => string;
  noteDefs: NoteDef[];
  midMeetings: Record<MidKey, MidMeeting>;
  smallScripts: Record<SmallKey, ParsedScript>;
  scripts: { campaign: ParsedScript; landing: ParsedScript; weekly: ParsedScript };
  pausedScript: ParsedScript;
  text: { workspaceName: string; workspaceDescription: string; practiceWorkspaceName: string; invitingWorkspaceName: string };
  chats: (now: number) => Pick<StoreState, "agentChats" | "agentChatMessages">;
  feedbacks: (now: number) => StoreState["feedbacks"];
  integrations: (now: number) => StoreState["integrations"];
  delegations: (now: number) => Pick<StoreState, "agentDelegations" | "agentDelegationUsages">;
  terms: readonly string[];
  chatAnswers: readonly string[];
  reviewSets: () => HelpDemoReviewSet[];
  endedItems: SeedItem[];
  liveScript: readonly string[];
  taskRows: () => TaskSeedRow[];
  agendaMap: {
    projectName: string;
    seed: (
      workspaceId: string,
      template: NoteResponseData
    ) => { project: StoreState["projects"][number]; notes: NoteResponseData[] };
    links: () => ProjectMeetingLinksResponseData;
    summary: (noteId: string) => MeetingReviewSummary | null;
  };
};

const KO: HelpDemoPack = {
  projects: koPeople.HD_PROJECTS,
  members: koPeople.HD_MEMBERS,
  guests: koPeople.HD_GUESTS,
  meName: koPeople.HD_ME_NAME,
  meEmail: koPeople.HD_ME_EMAIL,
  personName: koPeople.personName,
  noteDefs: koNotes.NOTE_DEFS,
  midMeetings: koMid.MID_MEETINGS,
  smallScripts: koSmall.SMALL_SCRIPTS,
  scripts: { campaign: koCampaign.CAMPAIGN_SCRIPT, landing: koLanding.LANDING_SCRIPT, weekly: koWeekly.WEEKLY_SCRIPT },
  pausedScript: koText.PAUSED_SCRIPT,
  text: koText.HD_TEXT,
  chats: koMisc.helpDemoChats,
  feedbacks: koMisc.helpDemoFeedbacks,
  integrations: koMisc.helpDemoIntegrations,
  delegations: koMisc.helpDemoDelegations,
  terms: koMisc.HELP_DEMO_TERMS,
  chatAnswers: koMisc.HELP_DEMO_CHAT_ANSWERS,
  reviewSets: koReviews.helpDemoReviewSets,
  endedItems: koReviews.HELP_DEMO_ENDED_ITEMS,
  liveScript: koWeekly.HELP_DEMO_LIVE_SCRIPT,
  taskRows: koTasks.helpDemoTaskRows,
  agendaMap: {
    projectName: koAgenda.GUIDE_AGENDA_PROJECT_NAME,
    seed: koAgenda.guideAgendaMapSeed,
    links: koAgenda.guideAgendaMapLinks,
    summary: koAgenda.guideAgendaMapSummary,
  },
};

const EN: HelpDemoPack = {
  projects: enPeople.HD_PROJECTS,
  members: enPeople.HD_MEMBERS,
  guests: enPeople.HD_GUESTS,
  meName: enPeople.HD_ME_NAME,
  meEmail: enPeople.HD_ME_EMAIL,
  personName: enPeople.personName,
  noteDefs: enNotes.NOTE_DEFS,
  midMeetings: enMid.MID_MEETINGS,
  smallScripts: enSmall.SMALL_SCRIPTS,
  scripts: { campaign: enCampaign.CAMPAIGN_SCRIPT, landing: enLanding.LANDING_SCRIPT, weekly: enWeekly.WEEKLY_SCRIPT },
  pausedScript: enText.PAUSED_SCRIPT,
  text: enText.HD_TEXT,
  chats: enMisc.helpDemoChats,
  feedbacks: enMisc.helpDemoFeedbacks,
  integrations: enMisc.helpDemoIntegrations,
  delegations: enMisc.helpDemoDelegations,
  terms: enMisc.HELP_DEMO_TERMS,
  chatAnswers: enMisc.HELP_DEMO_CHAT_ANSWERS,
  reviewSets: enReviews.helpDemoReviewSets,
  endedItems: enReviews.HELP_DEMO_ENDED_ITEMS,
  liveScript: enWeekly.HELP_DEMO_LIVE_SCRIPT,
  taskRows: enTasks.helpDemoTaskRows,
  agendaMap: {
    projectName: enAgenda.GUIDE_AGENDA_PROJECT_NAME,
    seed: enAgenda.guideAgendaMapSeed,
    links: enAgenda.guideAgendaMapLinks,
    summary: enAgenda.guideAgendaMapSummary,
  },
};

/** 그 언어의 프리셋. 언어를 안 넘기면 지금 문서의 언어(`helpDemoLocale()`)다. */
export function helpDemoPack(locale: HelpDemoLocale = helpDemoLocale()): HelpDemoPack {
  return locale === "en" ? EN : KO;
}
