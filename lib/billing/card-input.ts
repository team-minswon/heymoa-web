/**
 * 카드 정보 입력 칸의 값과 검사(APP-1600, 나이스페이 카드 정기결제). 값은 입력 칸의 React 상태에만 산다 — 주소·저장소·이벤트·
 * 로그로 내보내는 함수를 여기 두지 않는다. 서버로 보낼 본문은 `cardRequestOf` 하나로만 만든다.
 */
export type CardHolder = "PERSONAL" | "CORPORATE";
export type CardForm = {
  /** 숫자만. */
  number: string;
  /** 숫자만, MMYY. */
  expiry: string;
  password: string;
  /** 숫자만. 개인 카드는 생년월일 6자리, 법인 카드는 사업자등록번호 10자리. */
  identity: string;
  holder: CardHolder;
};
export type CardField = "number" | "expiry" | "password" | "identity";
export type CardError =
  | "number"
  | "expiryFormat"
  | "expired"
  | "password"
  | "birth"
  | "business";

export const EMPTY_CARD: CardForm = {
  number: "",
  expiry: "",
  password: "",
  identity: "",
  holder: "PERSONAL",
};

export const CARD_NUMBER_MAX = 16;
export const IDENTITY_LENGTH: Record<CardHolder, number> = {
  PERSONAL: 6,
  CORPORATE: 10,
};

export const digitsOf = (value: string, max: number) =>
  value.replace(/\D/g, "").slice(0, max);

/** 4자리마다 띄어 보인다. */
export const formatCardNumber = (digits: string) =>
  digits.replace(/(\d{4})(?=\d)/g, "$1 ");

/** 셋째 자리부터 `/` 를 넣는다 — 두 자리에서 넣으면 지울 때 `/` 에 걸린다. */
export const formatExpiry = (digits: string) =>
  digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;

export function luhnValid(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return digits.length > 0 && sum % 10 === 0;
}

function birthValid(digits: string) {
  if (digits.length !== 6) return false;
  const month = Number(digits.slice(2, 4));
  const day = Number(digits.slice(4, 6));
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

/** 칸마다 틀린 까닭. 맞으면 그 칸이 없다. 카드 번호는 국내 카드의 14~16자리와 Luhn 을 본다. */
export function cardErrors(
  form: CardForm,
  now: Date
): Partial<Record<CardField, CardError>> {
  const errors: Partial<Record<CardField, CardError>> = {};
  if (form.number.length < 14 || !luhnValid(form.number))
    errors.number = "number";
  const month = Number(form.expiry.slice(0, 2));
  if (form.expiry.length !== 4 || month < 1 || month > 12)
    errors.expiry = "expiryFormat";
  else {
    const year = 2000 + Number(form.expiry.slice(2));
    // 유효기간은 그 달 말일까지 쓸 수 있다.
    if (year * 12 + month < now.getFullYear() * 12 + now.getMonth() + 1)
      errors.expiry = "expired";
  }
  if (!/^\d{2}$/.test(form.password)) errors.password = "password";
  if (form.holder === "PERSONAL" && !birthValid(form.identity))
    errors.identity = "birth";
  if (form.holder === "CORPORATE" && !/^\d{10}$/.test(form.identity))
    errors.identity = "business";
  return errors;
}

/** 서버 카드 제출 본문. */
export const cardRequestOf = (form: CardForm) => ({
  cardNumber: form.number,
  expiryMonth: form.expiry.slice(0, 2),
  expiryYear: form.expiry.slice(2, 4),
  identity: form.identity,
  passwordPrefix: form.password,
});
