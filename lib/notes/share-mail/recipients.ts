export const MAX_RECIPIENTS = 10;

export type Recipient = {
  email: string;
  name?: string;
  valid: boolean;
};

export type RecipientCandidate = { name: string; email: string };

/** server `NoteShareMail.isValidEmail` 과 같은 규칙이어야 합니다. 화면이 더 너그러우면 보낼 때 서버가 거절합니다. */
const EMAIL =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;
const MAX_EMAIL_LENGTH = 254;

export const isEmail = (value: string) => {
  const email = value.trim();
  return email.length <= MAX_EMAIL_LENGTH && EMAIL.test(email);
};

const keyOf = (email: string) => email.trim().toLowerCase();

export const hasRecipient = (
  list: readonly { email: string }[],
  email: string
) => list.some((recipient) => keyOf(recipient.email) === keyOf(email));

export function splitAddresses(text: string): string[] {
  return text
    .replace(/"[^"]*"/g, " ")
    .split(/[,;\n]+/)
    .flatMap((cell) => {
      const words = cell
        .replace(/<([^<>\s]+@[^<>\s]+)>/g, " $1 ")
        .split(/\s+/)
        .filter(Boolean);
      return /<[^<>\s]+@[^<>\s]+>/.test(cell)
        ? words.filter((word) => word.includes("@"))
        : words;
    });
}

export function addRecipients(
  list: readonly Recipient[],
  parts: ReadonlyArray<string | RecipientCandidate>,
  candidates: readonly RecipientCandidate[] = []
): Recipient[] {
  const next = [...list];
  for (const part of parts) {
    const known =
      typeof part === "string"
        ? isEmail(part)
          ? candidates.find((c) => keyOf(c.email) === keyOf(part))
          : candidates.find((c) => c.name === part.trim())
        : part;
    const email = (known?.email ?? (part as string)).trim();
    if (!email || hasRecipient(next, email)) continue;
    next.push({ email, name: known?.name, valid: isEmail(email) });
  }
  return next;
}

export const removeRecipient = (list: readonly Recipient[], email: string) =>
  list.filter((recipient) => keyOf(recipient.email) !== keyOf(email));

export type RecipientProblem =
  | { kind: "invalid"; emails: string }
  | { kind: "tooMany"; max: number; extra: number };

export function recipientProblem(
  list: readonly Recipient[]
): RecipientProblem | null {
  const invalid = list.filter((recipient) => !recipient.valid);
  if (invalid.length) {
    return {
      kind: "invalid",
      emails: invalid.map((r) => r.email).join(", "),
    };
  }
  if (list.length > MAX_RECIPIENTS) {
    return {
      kind: "tooMany",
      max: MAX_RECIPIENTS,
      extra: list.length - MAX_RECIPIENTS,
    };
  }
  return null;
}

export function matchCandidates(
  candidates: readonly RecipientCandidate[],
  list: readonly Recipient[],
  query: string
) {
  const q = query.trim().toLowerCase();
  return candidates.filter(
    (c) =>
      !hasRecipient(list, c.email) &&
      (!q ||
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q))
  );
}
