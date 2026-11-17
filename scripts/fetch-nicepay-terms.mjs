#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";

const ORIGIN = "https://sandbox-api.nicepay.co.kr";
const TYPES = [
  "ElectronicFinancialTransactions",
  "CollectPersonalInfo",
  "SharingPersonalInformation",
];

const BREAKS = [
  /(?<=^\[[^\]]*\])/g,
  /제\d+조\s*\(/g,
  /부\s*칙/g,
  /(?<=[.)])\d{1,2}[.)](?!\d)/g,
  /\d\)\t/g,
  /[가-하]\.\t/g,
  /※/g,
];

export function splitTerms(content) {
  const cuts = new Set([0]);
  for (const pattern of BREAKS)
    for (const match of content.matchAll(pattern)) cuts.add(match.index);
  const sorted = [...cuts].sort((a, b) => a - b);
  const parts = sorted
    .map((start, i) => content.slice(start, sorted[i + 1]))
    .filter((part) => part.length > 0);
  if (parts.join("") !== content)
    throw new Error("문단 나누기가 원문을 바꿨다");
  return parts;
}

async function fetchTerms(type) {
  const { NICEPAY_SANDBOX_CLIENT_KEY: id, NICEPAY_SANDBOX_SECRET_KEY: secret } =
    process.env;
  if (!id || !secret)
    throw new Error(
      "NICEPAY_SANDBOX_CLIENT_KEY·NICEPAY_SANDBOX_SECRET_KEY 가 없다"
    );
  const response = await fetch(`${ORIGIN}/v1/terms?termsType=${type}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
  });
  const body = await response.json();
  if (!response.ok || body.resultCode !== "0000" || !body.content)
    throw new Error(
      `${type}: HTTP ${response.status} ${body.resultCode} ${body.resultMsg}`
    );
  return { type, title: body.termsTitle, content: body.content };
}

async function main() {
  const terms = [];
  for (const type of TYPES) terms.push(await fetchTerms(type));
  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Seoul",
  });
  const data = terms.map(({ type, title, content }) => ({
    type,
    title,
    paragraphs: splitTerms(content),
  }));
  const source = `/**
 * 나이스페이 약관 본문(APP-1600). 주문서·카드 변경의 「내용 보기」 창이 그대로 그린다. 문구 파일(\`messages/\`)이 아니라
 * 여기 두는 까닭: 대행사가 준 약관 원문이라 화면 문구처럼 다듬지 않고 통째로 바꾼다.
 *
 * 생성 파일이다. 손으로 고치지 않고 \`scripts/fetch-nicepay-terms.mjs\` 를 돌린다.
 * 출처: 나이스페이 샌드박스 \`GET /v1/terms?termsType=\`, 받아 온 날 ${today}. 글자는 원문 그대로이고 문단만 나눴다.
 *
 * shortcut: 받아 온 날의 사본이다. 나이스페이가 약관을 바꾸면 스크립트를 다시 돌린다.
 */
export const PG_TERMS_FETCHED_AT = ${JSON.stringify(today)};

export const PG_TERMS: {
  type: string;
  title: string;
  paragraphs: string[];
}[] = ${JSON.stringify(data, null, 2)};
`;
  const target = fileURLToPath(
    new URL("../content/billing/pg-terms.ts", import.meta.url)
  );
  const options = await resolveConfig(target);
  writeFileSync(target, await format(source, { ...options, filepath: target }));
  for (const { title, content } of terms)
    console.log(`${title}: ${content.length}자`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
