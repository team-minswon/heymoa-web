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

export const R = (ko, en) => (LOCALE === "en" ? en : ko);

export function K(key) {
  const value = messages()[LOCALE].get(key);
  if (value === undefined) throw new Error(`ui.mjs: 언어 파일에 ${key} 가 없습니다.`);
  return value;
}
