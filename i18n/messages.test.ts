import { describe, expect, it } from "vitest";

import {
  messagesFor,
  overlay,
  PRODUCT_NAMESPACES,
  rawMessages,
  type Namespace,
} from "@/i18n/messages";

/**
 * **영어 키가 모두 있어야 하는 이름공간.** 이슈가 진행될 때마다 여기에 더한다(PRO-66 단계별 목록).
 * 목록 밖의 이름공간은 영어가 빠져도 실행 중에 한국어 원문으로 보인다.
 */
const REQUIRED_EN: readonly Namespace[] = [
  "common",
  "auth",
  "billing",
  "landing",
  "download",
  "legal",
  "help",
  "errors",
  "shell",
  "settings",
  "workspace",
  "notes",
  "chat",
  "tasks",
  "notification",
  "agents",
  "recording",
  "dates",
];

function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key)
  );
}

describe("언어 파일", () => {
  it.each(REQUIRED_EN)("%s 이름공간은 영어 키가 한국어와 같다", (namespace) => {
    const ko = keyPaths(rawMessages.ko[namespace]).sort();
    const en = keyPaths(rawMessages.en[namespace]).sort();
    expect(en).toEqual(ko);
  });

  it("영어에 없는 키는 빈칸이나 키 이름 대신 한국어 원문으로 보인다", () => {
    const ko = rawMessages.ko;
    const merged = overlay(ko, {
      common: { notFound: { title: "Page not found" } },
    });

    expect(merged.common.notFound.title).toBe("Page not found");
    expect(merged.common.notFound.description).toBe(
      ko.common.notFound.description
    );
    expect(merged.common.helpTip).toBe(ko.common.helpTip);
  });

  it("목록은 배열 그대로 통째로 바뀐다", () => {
    expect(
      overlay({ list: ["가", "나"], name: "가" }, { list: ["a"] })
    ).toEqual({
      list: ["a"],
      name: "가",
    });
  });

  it("언어마다 합친 결과를 낸다", () => {
    expect(messagesFor("ko").common.notFound.title).toBe(
      "페이지를 찾을 수 없습니다"
    );
    expect(messagesFor("en").common.notFound.title).toBe("Page not found");
  });
});

/** 제품 화면이 클라이언트에서 쓰지 않는 이름공간(마케팅·서버 렌더 전용). 새 이름공간은 이 둘 중 한 곳에 넣어야 한다. */
const NOT_PRODUCT_CLIENT: readonly Namespace[] = [
  "landing",
  "download",
  "legal",
  "help",
];

describe("제품 화면으로 보내는 이름공간", () => {
  it("모든 이름공간은 제품 목록이나 제외 목록에 있다 — 빠지면 화면에 키 이름이 그대로 보인다", () => {
    const assigned = [...PRODUCT_NAMESPACES, ...NOT_PRODUCT_CLIENT].sort();
    expect(assigned).toEqual(Object.keys(rawMessages.ko).sort());
  });
});
