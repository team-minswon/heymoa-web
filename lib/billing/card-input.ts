export type CardHolder = "PERSONAL" | "CORPORATE";
export type CardForm = {
  number: string;
  expiry: string;
  password: string;
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

export const formatCardNumber = (digits: string) =>
  digits.replace(/(\d{4})(?=\d)/g, "$1 ");

/** 셋째 자리부터 `/` 를 넣습니다 — 두 자리에서 넣으면 지울 때 `/` 에 걸립니다. */
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
    // 유효기간은 그 달 말일까지 쓸 수 있습니다.
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

export const cardRequestOf = (form: CardForm) => ({
  cardNumber: form.number,
  expiryMonth: form.expiry.slice(0, 2),
  expiryYear: form.expiry.slice(2, 4),
  identity: form.identity,
  passwordPrefix: form.password,
});
