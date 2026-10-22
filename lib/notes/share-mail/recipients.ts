/**
 * 받는 사람 입력의 순수 규칙. 화면(`EmailRecipientsInput`)은 이 함수들로만 목록을 바꾼다.
 *
 * 상한은 서버의 공유 메일 도메인 상수가 정본이다 — 서버가 같은 값으로 다시 거절하고(400
 * `SHARE_MAIL_TOO_MANY_RECIPIENTS`), 여기 값은 보내기 전에 미리 알리는 용도다.
 */
export const MAX_RECIPIENTS = 10;

export type Recipient = {
  email: string;
  /** 후보에서 고른 사람이면 이름. 직접 친 주소는 없다 */
  name?: string;
  valid: boolean;
};

export type RecipientCandidate = { name: string; email: string };

/**
 * 형식만 본다. 도메인이 실제로 받는지는 발송이 알려 준다. **서버(`NoteShareMail.isValidEmail`)와 같은 규칙이다** —
 * 로컬 부분은 점으로 이은 atom(연속 · 앞뒤 점 금지), 도메인은 하이픈이 앞뒤에 없는 라벨과 영문 최상위 도메인, ASCII 만,
 * 254자까지. 화면이 더 너그러우면 `a..b@x.com` 이 맞는 칩으로 섰다가 보낼 때 서버가 거절했다.
 */
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

/**
 * 붙여 넣은 글이나 쳐 둔 글을 주소 조각으로 나눈다. 메일 앱에서 복사한 `이름 <a@b.com>` 모양은 꺾쇠 안의
 * 주소만 쓴다 — 이름 조각이 틀린 주소 칩으로 남지 않게.
 *
 * 쉼표 · 세미콜론 · 줄바꿈으로 먼저 나누고, 꺾쇠 주소가 든 칸에서만 이름을 걷는다(`@` 가 든 낱말만 남긴다).
 * 글 전체에서 꺾쇠 주소만 골라 내면 같이 붙여 넣은 맨 주소가 말없이 빠졌다. 꺾쇠가 없는 칸은 낱말을 다 두어
 * 잘못 친 주소가 오류 칩으로 보이게 한다.
 */
export function splitAddresses(text: string): string[] {
  return (
    text
      // 따옴표 안은 늘 이름이다(`"Kim, Minsu" <kim@a.com>`) — 그 안의 쉼표로 나누지 않게 먼저 걷는다
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
      })
  );
}

/**
 * 조각을 목록에 더한다. 대소문자만 다른 주소는 같은 사람이다. 후보 이름이나 주소와 정확히
 * 맞는 조각은 그 사람으로 넣는다 — 「강성재」를 치고 Enter 를 눌러도 이름 칩이 선다.
 */
export function addRecipients(
  list: readonly Recipient[],
  parts: ReadonlyArray<string | RecipientCandidate>,
  candidates: readonly RecipientCandidate[] = []
): Recipient[] {
  const next = [...list];
  for (const part of parts) {
    // 주소를 쳤으면 주소로만 찾는다 — 이름으로도 찾으면 이름이 그 주소인 다른 후보(「client@x.com」이라는 이름의
    // other@x.com)로 바뀌어 엉뚱한 사람에게 갔다. 이름으로 찾는 것은 주소가 아닌 입력(「강성재」)뿐이다
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

/** 보내기를 막는 사유. 없으면 null. 틀린 주소가 먼저다 — 고칠 칩을 짚어 준다 */
export function recipientProblem(list: readonly Recipient[]): string | null {
  const invalid = list.filter((recipient) => !recipient.valid);
  if (invalid.length) {
    return `${invalid.map((r) => r.email).join(", ")}: 이메일 주소 형식이 아닙니다. 빼고 다시 입력해 주세요.`;
  }
  if (list.length > MAX_RECIPIENTS) {
    return `한 번에 ${MAX_RECIPIENTS}명까지 보낼 수 있습니다. ${list.length - MAX_RECIPIENTS}명을 빼 주세요.`;
  }
  return null;
}

/** 아직 안 넣은 후보 중 이름이나 주소에 [query] 가 들어간 사람 */
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
