import { unnamedSpeakerAvatarKey } from "@/lib/people/avatar-key";

export type AssigneeValue = {
  type: "USER" | "GUEST" | "SPEAKER_LABEL";
  id?: string;
  name?: string;
  image?: string | null;
  noteId?: string;
  label?: string;
};

type AssigneeView = {
  name: string;
  avatarKey: string;
  image: string | null;
  unnamed: boolean;
};

export function describeAssignee(
  value: AssigneeValue | null | undefined,
  speakerName: (label: string) => string
): AssigneeView | null {
  if (!value) return null;
  if (value.type === "SPEAKER_LABEL") {
    return {
      name: speakerName(value.label ?? "").trim(),
      avatarKey: unnamedSpeakerAvatarKey(value.label ?? ""),
      image: null,
      unnamed: true,
    };
  }
  return {
    name: value.name ?? "",
    avatarKey: value.id ?? value.name ?? "",
    image: value.image ?? null,
    unnamed: false,
  };
}

export type AssigneeChoice =
  | { type: "USER" | "GUEST"; id: string; name: string; image?: string | null }
  | { type: "SPEAKER_LABEL"; noteId: string; label: string };

export function assigneeKey(value: AssigneeValue | AssigneeChoice | null | undefined) {
  if (!value) return "";
  return value.type === "SPEAKER_LABEL"
    ? `SPEAKER_LABEL:${value.noteId ?? ""}:${value.label ?? ""}`
    : `${value.type}:${value.id ?? ""}`;
}

export function assigneeRequestOf(choice: AssigneeValue | AssigneeChoice | null) {
  if (!choice) return null;
  return choice.type === "SPEAKER_LABEL"
    ? { type: choice.type, noteId: choice.noteId, label: choice.label }
    : { type: choice.type, id: choice.id };
}

/** 서버는 담당을 풀 때 사진을 싣지 않아 사람 목록에서 같은 열쇠로 찾아 잇습니다. */
export function assigneeImageOf(
  choices: readonly AssigneeChoice[],
  value: AssigneeValue | AssigneeChoice | null | undefined
): string | null {
  if (!value) return null;
  const key = assigneeKey(value);
  return (
    choices.find(
      (choice): choice is Extract<AssigneeChoice, { id: string }> =>
        choice.type !== "SPEAKER_LABEL" && assigneeKey(choice) === key
    )?.image ?? null
  );
}
