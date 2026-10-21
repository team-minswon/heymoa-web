import { describe, expect, it } from "vitest";

import {
  messagesFor,
  overlay,
  rawMessages,
  type Namespace,
} from "@/i18n/messages";

/**
 * **영어 키가 모두 있어야 하는 이름공간.** 이슈가 진행될 때마다 여기에 더한다(PRO-66 단계별 목록).
 * 목록 밖의 이름공간은 영어가 빠져도 실행 중에 한국어 원문으로 보인다.
 */
const REQUIRED_EN: readonly Namespace[] = ["common", "landing"];

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
    expect(merged.common.skipToContent).toBe(ko.common.skipToContent);
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
