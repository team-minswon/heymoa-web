import { expect, test } from "@playwright/test";

/**
 * 알림 모달(PRO-67 I09). 사이드바 첫 항목과 전체 화면 노트의 헤더가 같은 모달을 연다 — 전체 화면은 사이드바를 덮는다.
 */
const WS = "/w/01K0000000000";
const NOTE = `${WS}/notes/01K0000000002?view=full&tab=details`;

test("사이드바 「알림」이 모달을 열고 초대를 거절하려면 확인 창을 거친다", async ({
  page,
}) => {
  await page.goto(WS);
  const entry = page
    .getByRole("navigation", { name: "워크스페이스" })
    .getByRole("button", { name: /^알림/ });
  await expect(entry).toBeVisible();
  // 목 시드의 안 읽은 알림은 대기 초대 둘, 검토 결과 셋, 권한 없는 결과 하나다.
  await expect(entry.getByLabel("안 읽은 알림 6개")).toBeVisible();
  await entry.click();

  const dialog = page.getByRole("dialog", { name: "알림" });
  await expect(dialog.getByText("모든 워크스페이스")).toBeVisible();
  await dialog.getByRole("button", { name: "거절" }).first().click();
  const confirm = page.getByRole("alertdialog", { name: "초대를 거절할까요?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "취소" }).click();
  await expect(confirm).toBeHidden();
  await expect(
    dialog.getByRole("button", { name: "수락" }).first()
  ).toBeVisible();

  await dialog.getByRole("tab", { name: "처리 필요" }).click();
  await expect(dialog.getByRole("button", { name: "수락" })).toHaveCount(2);
  await expect(dialog.getByText("수락함")).toBeHidden();
});

test("전체 화면 노트에서도 헤더 진입점으로 같은 모달이 열린다", async ({
  page,
}) => {
  await page.goto(NOTE);
  const open = page.getByRole("button", { name: /^알림 열기/ });
  await expect(open).toBeVisible();
  await open.click();
  await expect(page.getByRole("dialog", { name: "알림" })).toBeVisible();
});

test("검토할 결과 준비 행을 누르면 검토 화면으로 가고, 결과가 보이면 그 알림이 읽음이 된다", async ({
  page,
}) => {
  await page.goto(WS);
  const entry = page
    .getByRole("navigation", { name: "워크스페이스" })
    .getByRole("button", { name: /^알림/ });
  await expect(entry.getByLabel("안 읽은 알림 6개")).toBeVisible();
  await entry.click();
  const dialog = page.getByRole("dialog", { name: "알림" });
  await expect(
    dialog.getByText("마지막 중지 후 3영업일이 지나 자동으로 종료했습니다.")
  ).toBeVisible();
  // 검토 화면이 결과를 그리면 그 알림만 읽는다.
  const read = page.waitForRequest(
    (request) =>
      request.method() === "PUT" &&
      request.url().includes("/v1/notifications/01K0000000032/read")
  );
  await dialog
    .getByRole("button", {
      name: /정규멘토링\s?의 검토할 결과가 준비되었습니다/,
    })
    .click();
  await expect(page).toHaveURL(/tab=summary&source=notification/);
  await read;
  await page.getByRole("button", { name: "알림 목록으로 돌아가기" }).click();
  await expect(page.getByRole("dialog", { name: "알림" })).toBeVisible();
});

test("로그인한 탭에는 이벤트 스트림 연결이 하나이고, 워크스페이스를 바꿔도 다시 연결하지 않는다", async ({
  page,
}) => {
  // 개발 모드의 StrictMode 는 effect 를 두 번 돌려 첫 연결을 곧바로 끊는다 — 열려 있는 연결 수로 센다.
  let opened = 0;
  let closed = 0;
  const isEvents = (url: string) => new URL(url).pathname === "/v1/events";
  page.on("request", (request) => {
    if (isEvents(request.url())) opened += 1;
  });
  page.on("requestfailed", (request) => {
    if (isEvents(request.url())) closed += 1;
  });
  await page.goto(WS);
  await expect.poll(() => opened - closed).toBe(1);
  const before = opened;
  await page.getByRole("button", { name: "워크스페이스 전환" }).click();
  await page.getByRole("menuitem", { name: "제품 팀" }).click();
  await expect(page).toHaveURL(/\/w\/01K0000000006/);
  await expect(
    page.getByRole("navigation", { name: "워크스페이스" })
  ).toBeVisible();
  await page.waitForTimeout(500);
  expect(opened).toBe(before);
  expect(opened - closed).toBe(1);
});

for (const width of [1440, 1024]) {
  test(`${width}px 에서 탭을 바꿔도 알림 모달의 폭·높이가 그대로이고, 열자마자 포커스 링이 뜨지 않는다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(WS);
    await page
      .getByRole("navigation", { name: "워크스페이스" })
      .getByRole("button", { name: /^알림/ })
      .click();
    const dialog = page.getByRole("dialog", { name: "알림" });
    await expect(
      dialog.getByRole("button", { name: "수락" }).first()
    ).toBeVisible();
    // 포커스는 창 자체에 있다 — 첫 탭에 두면 링이 보인다(APP-1355).
    expect(
      await page.evaluate(() => document.activeElement?.getAttribute("role"))
    ).toBe("dialog");
    const size = async () => {
      await page.waitForTimeout(300); // 열림 애니메이션(zoom)과 목록 도착이 끝난 뒤에 잰다
      const box = (await dialog.boundingBox())!;
      return [Math.round(box.width), Math.round(box.height)];
    };
    const first = await size();
    for (const name of ["안 읽음", "처리 필요", "전체"]) {
      await dialog.getByRole("tab", { name }).click();
      expect(await size()).toEqual(first);
    }
  });
}

test.describe("주소 상태(APP-1361)", () => {
  const openFromSidebar = async (page: import("@playwright/test").Page) => {
    await page
      .getByRole("navigation", { name: "워크스페이스" })
      .getByRole("button", { name: /^알림/ })
      .click();
    return page.getByRole("dialog", { name: "알림" });
  };

  test("열면 주소에 남고 뒤로 가기 한 번에 닫힌다 — 라우터 왕복(RSC) 없이", async ({
    page,
  }) => {
    await page.goto(WS);
    await expect(
      page.getByRole("navigation", { name: "워크스페이스" })
    ).toBeVisible();
    let rsc = 0;
    page.on("request", (request) => {
      if (request.url().includes("_rsc=")) rsc += 1;
    });
    const dialog = await openFromSidebar(page);
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\?notifications=all$/);
    await page.goBack();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`${WS}$`));
    expect(rsc).toBe(0);
  });

  test("탭을 옮기면 뒤로 가기로 앞 탭에 돌아오고, 닫으면 지난 탭이 다시 열리지 않는다", async ({
    page,
  }) => {
    await page.goto(WS);
    const dialog = await openFromSidebar(page);
    await dialog.getByRole("tab", { name: "안 읽음" }).click();
    await expect(page).toHaveURL(/notifications=unread/);
    await dialog.getByRole("tab", { name: "처리 필요" }).click();
    await expect(page).toHaveURL(/notifications=action/);
    await page.goBack();
    await expect(dialog.getByRole("tab", { name: "안 읽음" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`${WS}$`));
    // 닫을 때 쌓은 칸을 한 번에 걷었다 — 여기서 뒤로 가면 모달이 아니라 이 화면 앞으로 간다.
    await page.goBack();
    await expect(page.getByRole("dialog", { name: "알림" })).toBeHidden();
  });

  test("새로고침하면 같은 탭으로 다시 열린다", async ({ page }) => {
    await page.goto(`${WS}?notifications=action`);
    const dialog = page.getByRole("dialog", { name: "알림" });
    await expect(
      dialog.getByRole("tab", { name: "처리 필요" })
    ).toHaveAttribute("aria-selected", "true");
    await page.reload();
    await expect(
      dialog.getByRole("tab", { name: "처리 필요" })
    ).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByRole("button", { name: "수락" })).toHaveCount(2);
  });

  test("행을 눌러 노트로 가면 모달 쿼리가 걷혀, 뒤로 가기가 모달을 다시 열지 않는다", async ({
    page,
  }) => {
    await page.goto(WS);
    const dialog = await openFromSidebar(page);
    await dialog
      .getByRole("button", {
        name: /정규멘토링\s?의 검토할 결과가 준비되었습니다/,
      })
      .click();
    await expect(page).toHaveURL(/source=notification/);
    expect(page.url()).not.toContain("notifications=");
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${WS}$`));
    await expect(page.getByRole("dialog", { name: "알림" })).toBeHidden();
  });

  // APP-1363 — 설정은 알림 위에 얹힌다. 뒤로 가기·설정 X 는 설정만 걷고 알림(같은 탭)으로 돌아온다.
  test("「알림 설정」 뒤 뒤로 가기는 알림(같은 탭)으로 돌아오고, 한 번 더 뒤로 가면 닫힌다", async ({
    page,
  }) => {
    await page.goto(WS);
    const dialog = await openFromSidebar(page);
    const settings = page.getByRole("dialog", { name: "설정" });
    await dialog.getByRole("button", { name: "알림 설정" }).click();
    await expect(settings).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/notifications=all&settings=notifications$/);
    await page.goBack();
    await expect(settings).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\?notifications=all$/);
    await page.goBack();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`${WS}$`));
  });

  test("탭을 옮긴 뒤 「알림 설정」 → 뒤로 가기는 그 탭으로 돌아오고, 닫으면 쌓은 칸이 다 걷힌다", async ({
    page,
  }) => {
    await page.goto(WS);
    const dialog = await openFromSidebar(page);
    await dialog.getByRole("tab", { name: "처리 필요" }).click();
    await dialog.getByRole("button", { name: "알림 설정" }).click();
    await expect(page.getByRole("dialog", { name: "설정" })).toBeVisible();
    await page.goBack();
    await expect(
      dialog.getByRole("tab", { name: "처리 필요" })
    ).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`${WS}$`));
    await page.goBack();
    await expect(page.getByRole("dialog", { name: "알림" })).toBeHidden();
  });

  test("설정의 X 도 뒤로 가기와 같다 — 설정만 닫고 알림으로 돌아온다", async ({
    page,
  }) => {
    await page.goto(WS);
    const dialog = await openFromSidebar(page);
    const settings = page.getByRole("dialog", { name: "설정" });
    await dialog.getByRole("button", { name: "알림 설정" }).click();
    await settings.getByRole("button", { name: "닫기" }).click();
    await expect(settings).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\?notifications=all$/);
  });

  test("딥링크로 연 알림에서도 「알림 설정」 → 뒤로 가기는 알림이다", async ({
    page,
  }) => {
    await page.goto(`${WS}?notifications=unread`);
    const dialog = page.getByRole("dialog", { name: "알림" });
    await dialog.getByRole("button", { name: "알림 설정" }).click();
    await expect(page.getByRole("dialog", { name: "설정" })).toBeVisible();
    await page.goBack();
    await expect(dialog.getByRole("tab", { name: "안 읽음" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`${WS}$`));
  });
});

test("목에서 초대를 수락하면 다시 열어도 결과가 남고, 새 알림 도착 힌트로 개수가 오른다", async ({
  page,
}) => {
  await page.goto(WS);
  const entry = page
    .getByRole("navigation", { name: "워크스페이스" })
    .getByRole("button", { name: /^알림/ });
  await expect(entry.getByLabel("안 읽은 알림 6개")).toBeVisible();
  await entry.click();
  const dialog = page.getByRole("dialog", { name: "알림" });
  await dialog.getByRole("button", { name: "수락" }).first().click();
  await expect(dialog.getByText("수락함").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  // 수락한 초대는 읽음이 된다(모달이 덮는 동안 사이드바는 접근성 트리에서 빠져 닫은 뒤에 본다).
  await expect(entry.getByLabel("안 읽은 알림 5개")).toBeVisible();

  // 이벤트 스트림 목이 `notifications.changed` 를 내면 폴링(60초)을 기다리지 않고 개수가 따라온다.
  await page.evaluate(() => window.heymoaMock!.notify());
  await expect(entry.getByLabel("안 읽은 알림 6개")).toBeVisible();

  await entry.click();
  await dialog.getByRole("tab", { name: "처리 필요" }).click();
  await expect(dialog.getByRole("button", { name: "수락" })).toHaveCount(1);
});

for (const width of [1440, 1024]) {
  test(`${width}px 에서 글 기준선이 모달 제목과 같은 24px 선이고, 날짜 머리글은 흰 카드 밖 회색 띠다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${WS}?notifications=all`);
    const dialog = page.getByRole("dialog", { name: "알림" });
    await expect(
      dialog.getByRole("button", { name: "수락" }).first()
    ).toBeVisible();
    await page.waitForTimeout(300);
    const geometry = await dialog.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const left = (selector: string) =>
        Math.round(node.querySelector(selector)!.getBoundingClientRect().left);
      const row = node.querySelector("[data-notification-id]")!;
      const text = row.querySelector("p, button:not([aria-label])")!;
      const aside = row.lastElementChild!.getBoundingClientRect();
      const day = node.querySelector("h3")!;
      return {
        dialogLeft: Math.round(box.left),
        dialogRight: Math.round(box.right),
        title: left("h2"),
        day: Math.round(
          day.getBoundingClientRect().left +
            parseFloat(getComputedStyle(day).paddingLeft)
        ),
        text: Math.round(text.getBoundingClientRect().left),
        asideRight: Math.round(aside.right),
        dayBg: getComputedStyle(day).backgroundColor,
        cardBg: getComputedStyle(row.parentElement!).backgroundColor,
        dayPosition: getComputedStyle(day).position,
      };
    });
    const base = geometry.dialogLeft + 24;
    expect(geometry.title).toBe(base);
    expect(geometry.day).toBe(base);
    expect(geometry.text).toBe(base);
    expect(geometry.asideRight).toBe(geometry.dialogRight - 24);
    if (width === 1440) {
      // APP-1355 기준선 — 왼쪽 글 474, 오른쪽 열 끝 966
      expect([geometry.text, geometry.asideRight]).toEqual([474, 966]);
    }
    expect(geometry.dayPosition).toBe("sticky");
    expect(geometry.dayBg).not.toBe(geometry.cardBg);
  });
}
