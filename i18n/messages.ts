import enAgents from "@/messages/en/agents.json";
import enBilling from "@/messages/en/billing.json";
import enAuth from "@/messages/en/auth.json";
import enChat from "@/messages/en/chat.json";
import enCommon from "@/messages/en/common.json";
import enDates from "@/messages/en/dates.json";
import enDownload from "@/messages/en/download.json";
import enErrors from "@/messages/en/errors.json";
import enHelp from "@/messages/en/help.json";
import enLanding from "@/messages/en/landing.json";
import enLegal from "@/messages/en/legal.json";
import enNotes from "@/messages/en/notes.json";
import enNotification from "@/messages/en/notification.json";
import enSettings from "@/messages/en/settings.json";
import enRecording from "@/messages/en/recording.json";
import enShell from "@/messages/en/shell.json";
import enTasks from "@/messages/en/tasks.json";
import enWorkspace from "@/messages/en/workspace.json";
import koAgents from "@/messages/ko/agents.json";
import koBilling from "@/messages/ko/billing.json";
import koAuth from "@/messages/ko/auth.json";
import koChat from "@/messages/ko/chat.json";
import koCommon from "@/messages/ko/common.json";
import koDates from "@/messages/ko/dates.json";
import koDownload from "@/messages/ko/download.json";
import koErrors from "@/messages/ko/errors.json";
import koHelp from "@/messages/ko/help.json";
import koLanding from "@/messages/ko/landing.json";
import koLegal from "@/messages/ko/legal.json";
import koNotes from "@/messages/ko/notes.json";
import koNotification from "@/messages/ko/notification.json";
import koSettings from "@/messages/ko/settings.json";
import koRecording from "@/messages/ko/recording.json";
import koShell from "@/messages/ko/shell.json";
import koTasks from "@/messages/ko/tasks.json";
import koWorkspace from "@/messages/ko/workspace.json";
import type { Locale } from "@/lib/i18n/locales";

const ko = {
  common: koCommon,
  auth: koAuth,
  billing: koBilling,
  landing: koLanding,
  download: koDownload,
  legal: koLegal,
  help: koHelp,
  errors: koErrors,
  shell: koShell,
  settings: koSettings,
  workspace: koWorkspace,
  notes: koNotes,
  chat: koChat,
  tasks: koTasks,
  notification: koNotification,
  agents: koAgents,
  recording: koRecording,
  dates: koDates,
};

export type Messages = typeof ko;
export type Namespace = keyof Messages;

export const PRODUCT_NAMESPACES: readonly Namespace[] = [
  "common",
  "auth",
  "errors",
  "shell",
  "settings",
  "workspace",
  "notes",
  "chat",
  "tasks",
  "notification",
  "agents",
  "recording",
  "billing",
  "dates",
];

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const en: DeepPartial<Messages> = {
  common: enCommon,
  auth: enAuth,
  billing: enBilling,
  landing: enLanding,
  download: enDownload,
  legal: enLegal,
  help: enHelp,
  errors: enErrors,
  shell: enShell,
  settings: enSettings,
  workspace: enWorkspace,
  notes: enNotes,
  chat: enChat,
  tasks: enTasks,
  notification: enNotification,
  agents: enAgents,
  recording: enRecording,
  dates: enDates,
};

export function overlay<T>(base: T, top: unknown): T {
  if (
    typeof base !== "object" ||
    base === null ||
    typeof top !== "object" ||
    top === null ||
    Array.isArray(top)
  ) {
    return (top ?? base) as T;
  }
  const merged: Record<string, unknown> = {
    ...(base as Record<string, unknown>),
  };
  for (const [key, value] of Object.entries(top)) {
    merged[key] = overlay((base as Record<string, unknown>)[key], value);
  }
  return merged as T;
}

export const messagesFor = (locale: Locale): Messages =>
  locale === "ko" ? ko : overlay(ko, en);

export const rawMessages = { ko, en };
