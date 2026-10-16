import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

/**
 * 회의록 PDF 를 서비스 워커 목으로 끝까지 만든다. vitest 는 jsdom 이라 워커 · 글꼴 내려받기 · 실제 react-pdf 브라우저
 * 빌드를 지나지 않는다 — 그 길을 여기서 본다. 실제 멘토링 회의(63분 · 494발화)라 녹취록을 켜면 쪽 나누기도 길게 돈다.
 */
const WORKSPACE_ID = "01K0000000000";
const MENTORING_NOTE = "01K0000000920";

test("공유하기에서 녹취록을 붙여 회의록 PDF를 내려받는다", async ({ page }) => {
  await page.goto(`/w/${WORKSPACE_ID}/notes/${MENTORING_NOTE}?view=full&tab=summary`);
  await expect(page.getByText("검토 중", { exact: true })).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "내보내기·공유" }).click();
  await page.getByRole("menuitem", { name: /PDF로 내보내기/ }).click();
  const transcript = page.getByRole("switch", { name: "녹취록" });
  await expect(transcript).not.toBeChecked();
  await transcript.click();

  const downloading = page.waitForEvent("download", { timeout: 90_000 });
  await page.getByRole("button", { name: "PDF 받기" }).click();
  const download = await downloading;

  expect(download.suggestedFilename()).toBe("회의록_9 11 팀 이동준 멘토님 - 정규멘토링_20260911.pdf");
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(50_000);
  await expect(page.getByRole("dialog", { name: "회의록 PDF로 내보내기" })).toBeHidden();
});

test("타임라인 탭에서 타임라인을 복사한다 — 머리말 아래 안건마다 정해진 것 · 남은 것이 선다", async ({ page, context }) => {
  // 멘토링 회의는 타임라인 항목이 없다. 후보를 흘리는 맥락 데모 노트를 쓴다(`proposals.spec` 과 같다)
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`/w/${WORKSPACE_ID}/notes/01K0000000005?view=full&tab=context`);
  await expect(page.getByText("경로 데이터 저장소는 MongoDB를 사용한다")).toBeVisible({ timeout: 20_000 });

  // 거르기와 상관없이 전부 복사한다 — 「할 일」만 보이게 거른 뒤 눌러도 결정이 실린다
  await page.getByRole("button", { name: /^할 일 \d+$/ }).click();
  await page.getByRole("button", { name: "타임라인 복사" }).click();
  await expect(page.getByText("타임라인 내용이 클립보드에 복사되었습니다.")).toBeVisible();

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/^# .+ — 타임라인\n/);
  expect(copied).toContain("**결정** 경로 데이터 저장소는 MongoDB를 사용한다");
});
