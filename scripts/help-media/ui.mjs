/**
 * 캡처의 언어 (APP-1511). `HELP_LOCALE=en` 이면 영어 화면(영어 계정·영어 프리셋)을 찍어 `public/help/en/` 에 쓴다.
 *
 * 장면은 화면 문구로 버튼을 찾는다. 영어 장면을 따로 쓰지 않도록, 한국어 문구를 `messages/ko/*.json` 에서 찾아
 * **같은 키의** 영어 문구(`messages/en/*.json`)로 바꾼다 — 화면 문구가 바뀌면 장면도 따라간다. 화면 문구가 아닌
 * 입력값(회의 이름, 용어)이나 같은 한국어가 여러 영어로 갈리는 곳은 영어를 직접 넘긴다.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const LOCALE = process.env.HELP_LOCALE === "en" ? "en" : "ko";
export const BROWSER_LOCALE = LOCALE === "en" ? "en-US" : "ko-KR";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function flatten(value, prefix, out) {
  if (typeof value === "string") out.set(prefix, value);
  else if (value && typeof value === "object")
    for (const [key, child] of Object.entries(value))
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
  return out;
}

function load(locale) {
  const dir = path.join(ROOT, "messages", locale);
  const out = new Map();
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".json")))
    flatten(JSON.parse(readFileSync(path.join(dir, file), "utf8")), file.replace(/\.json$/, ""), out);
  return out;
}

let cache;
const messages = () => (cache ??= { ko: load("ko"), en: load("en") });

/**
 * 화면 문구. 한국어 화면이면 그대로, 영어 화면이면 같은 키의 영어. `en` 을 주면 그것을 쓴다.
 * 같은 한국어가 서로 다른 영어로 갈리면 멈춘다 — 그 자리에 `en` 을 직접 적는다.
 */
export function L(ko, en) {
  if (LOCALE === "ko") return ko;
  if (en !== undefined) return en;
  const { ko: koMessages, en: enMessages } = messages();
  const found = new Set();
  for (const [key, value] of koMessages)
    if (value === ko && enMessages.has(key)) found.add(enMessages.get(key));
  if (found.size === 1) return [...found][0];
  if (found.size === 0) throw new Error(`ui.mjs: 「${ko}」 에 해당하는 영어 문구가 없습니다. L("${ko}", "…") 로 적어 주세요.`);
  throw new Error(`ui.mjs: 「${ko}」 의 영어가 여럿입니다(${[...found].join(" / ")}). L("${ko}", "…") 로 골라 주세요.`);
}

/** 정규식 선택자. 언어마다 직접 적는다. */
export const R = (ko, en) => (LOCALE === "en" ? en : ko);

/** 언어 파일 키로 고른 화면 문구. 문구가 바뀌어도 키가 같으면 장면이 따라간다. ICU 자리는 그대로 남는다. */
export function K(key) {
  const value = messages()[LOCALE].get(key);
  if (value === undefined) throw new Error(`ui.mjs: 언어 파일에 ${key} 가 없습니다.`);
  return value;
}
