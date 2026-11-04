import { afterEach, describe, expect, it } from "vitest";

import en from "@/messages/en/errors.json";
import ko from "@/messages/ko/errors.json";

import { webMessage } from "./web-message";

afterEach(() => {
  document.documentElement.lang = "";
});

describe("webMessage", () => {
  it("화면 언어가 영어면 영어 문구다", () => {
    document.documentElement.lang = "en";
    expect(webMessage("timeout")).toBe(en.timeout);
  });

  it("한국어이거나 모르는 언어면 한국어 문구다", () => {
    document.documentElement.lang = "ko";
    expect(webMessage("timeout")).toBe(ko.timeout);
    document.documentElement.lang = "fr";
    expect(webMessage("timeout")).toBe(ko.timeout);
  });
});
