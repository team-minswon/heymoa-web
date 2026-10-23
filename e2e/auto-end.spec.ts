import { expect, test } from "@playwright/test";

/**
 * 일시정지 회의의 자동 종료 예고와 자동 종료된 노트의 고정 안내(APP-1319, PRO-67 userflow). 목 시드:
 * `01K0000000040` 은 예고된 일시정지 회의, `01K0000000026` 은 자동 종료된 뒤 분석이 실패한 회의다.
 */
const WORKSPACE = "/w/01K0000000000/notes";

test("예고된 일시정지 회의는 상단 띠에 자동 종료 예정 시각을 말한다", async ({
  page,
}) => {
  await page.goto(`${WORKSPACE}/01K0000000040`);
  await expect(page.getByTestId("note-status-band")).toHaveText(
    /^계속 일시정지 상태라면 \d+월 \d+일\(.\) 오후 4시 20분 이후 자동 종료될 예정입니다\.$/
  );
});

test("자동 종료된 노트는 탭을 바꿔도 안내가 남고, 접어도 사유와 시각은 회의 정보에 있다", async ({
  page,
}) => {
  await page.goto(`${WORKSPACE}/01K0000000026?view=full`);
  const band = page.getByTestId("note-status-band");
  await expect(band).toContainText(
    "회의를 자동으로 종료했습니다. 마지막 일시정지 후 3영업일이 지나 종료했습니다. 이 회의에는 이어서 녹음할 수 없습니다."
  );
  await expect(band).toContainText("분석하지 못했습니다.");

  await page.getByRole("tab", { name: "스크립트" }).click();
  await expect(band).toContainText("회의를 자동으로 종료했습니다.");

  await band.getByRole("button", { name: "접기" }).click();
  await expect(band).not.toContainText("영업일");
  await page.getByRole("tab", { name: "정보" }).click();
  await expect(page.getByRole("region", { name: "회의 정보" })).toContainText(
    "자동 종료(마지막 일시정지 후 3영업일)"
  );
});

test("메일 링크로 연 자동 종료 노트는 요약 탭에서 자동 종료 안내를 보인다", async ({
  page,
}) => {
  await page.goto(
    `${WORKSPACE}/01K0000000026?utm_source=heymoa&utm_medium=email&utm_campaign=meeting_auto_end_notice`
  );
  await expect(page.getByRole("tab", { name: "요약" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(page.getByTestId("note-status-band")).toContainText(
    "회의를 자동으로 종료했습니다."
  );
});
