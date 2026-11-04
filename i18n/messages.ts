import enAgents from "@/messages/en/agents.json";
import enAuth from "@/messages/en/auth.json";
import enChat from "@/messages/en/chat.json";
import enCommon from "@/messages/en/common.json";
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
import koAuth from "@/messages/ko/auth.json";
import koChat from "@/messages/ko/chat.json";
import koCommon from "@/messages/ko/common.json";
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

/**
 * 언어 파일은 `messages/<언어>/<이름공간>.json` 이다. **한국어가 기준**이고 키 타입도 한국어에서 만든다.
 * 이름공간을 더하면 두 표에 한 줄씩 더한다.
 */
const ko = {
  common: koCommon,
  auth: koAuth,
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
};

export type Messages = typeof ko;
export type Namespace = keyof Messages;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const en: DeepPartial<Messages> = {
  common: enCommon,
  auth: enAuth,
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
};

/**
 * 영어 키가 빠지면 빈칸이나 키 이름 대신 **한국어 원문**이 보이게 한국어 위에 덮어 합친다.
 * 빠뜨림 자체는 `messages.test.ts` 가 단계별 이름공간 목록으로 막는다.
 */
export function overlay<T>(base: T, top: unknown): T {
  // 목록(대본 줄 · 자주 묻는 질문)은 통째로 바꾼다. 줄 수가 언어마다 같다는 보장이 없고, 객체로 합치면 배열이 아니게 된다.
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
