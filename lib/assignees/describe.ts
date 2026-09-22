/**
 * 담당을 사람 말로 푸는 규칙 하나. 검토 화면과 할 일 화면이 같은 사람을 같은 이름·얼굴로 세운다.
 *
 * 서버는 담당을 조회 시점에 푼다. 사람은 `{type, id, name}` 으로 오고, 한 사람으로 풀리지 않은
 * 회의 라벨만 `{type: SPEAKER_LABEL, noteId, label}` 로 남는다 — 그게 곧 「이름 없는 화자」다.
 */
export type AssigneeValue = {
  type: "USER" | "GUEST" | "SPEAKER_LABEL";
  id?: string;
  name?: string;
  /** 계정 사진. 서버가 담당을 풀 때는 안 실어서, 화면이 사람 목록에서 이어 붙인다 */
  image?: string | null;
  noteId?: string;
  label?: string;
};

export type AssigneeView = {
  name: string;
  /** `PersonAvatar` 의 열쇠. 사람은 계정·임시 참여자 식별자라 다른 화면과 같은 얼굴이다 */
  avatarKey: string;
  /** 계정 사진. 있으면 `PersonAvatar` 가 생성된 얼굴 대신 이것을 쓴다 */
  image: string | null;
  /** 아직 사람이 붙지 않은 화자 */
  unnamed: boolean;
};

export function describeAssignee(
  value: AssigneeValue | null | undefined
): AssigneeView | null {
  if (!value) return null;
  if (value.type === "SPEAKER_LABEL") {
    return {
      name: `화자 ${value.label ?? ""}`.trim(),
      avatarKey: `label:${value.noteId ?? ""}:${value.label ?? ""}`,
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

/** 담당 칸에서 고를 수 있는 한 사람 또는 이 회의의 화자. */
export type AssigneeChoice =
  | { type: "USER" | "GUEST"; id: string; name: string; image?: string | null }
  | { type: "SPEAKER_LABEL"; noteId: string; label: string };

export function assigneeKey(value: AssigneeValue | AssigneeChoice | null | undefined) {
  if (!value) return "";
  return value.type === "SPEAKER_LABEL"
    ? `SPEAKER_LABEL:${value.noteId ?? ""}:${value.label ?? ""}`
    : `${value.type}:${value.id ?? ""}`;
}

/** 요청 본문의 담당. 사람은 `{type, id}`, 화자는 `{type, noteId, label}` 이다. */
export function assigneeRequestOf(choice: AssigneeValue | AssigneeChoice | null) {
  if (!choice) return null;
  return choice.type === "SPEAKER_LABEL"
    ? { type: choice.type, noteId: choice.noteId, label: choice.label }
    : { type: choice.type, id: choice.id };
}

/**
 * 그 담당의 계정 사진. **서버는 담당을 풀 때 사진을 안 싣는다** — 사람 목록에는 있으므로
 * 같은 열쇠로 찾아 잇는다. 이 함수를 안 쓰고 값만 넘기면 그 화면만 생성된 얼굴이 된다 (APP-678).
 */
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
