import { expect, test } from "@playwright/test";

const WORKSPACE_ID = "01K0000000000";

test("할 일 조회가 늦어도 화면이 먼저 열리고 키보드로 노트 목록에 돌아온다", async ({ page }) => {
  await page.addInitScript((workspaceId) => {
    const originalFetch = window.fetch.bind(window);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    Object.assign(window, { releaseTasksFetch: release });
    window.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), location.href);
      if (url.pathname === `/v1/workspaces/${workspaceId}/tasks`) await pending;
      return originalFetch(input, init);
    };
  }, WORKSPACE_ID);

  await page.goto(`/w/${WORKSPACE_ID}`);
  await page.getByRole("link", { name: "할 일", exact: true }).click();
  await expect(page.getByRole("heading", { name: "할 일", exact: true })).toBeVisible();
  await expect(page.getByLabel("할 일 불러오는 중")).toBeVisible();
  await expect(page.getByText("할 일이 없습니다.", { exact: true })).toHaveCount(0);

  await page.evaluate(() => (window as unknown as { releaseTasksFetch: () => void }).releaseTasksFetch());
  await expect(page.getByLabel("할 일 불러오는 중")).toHaveCount(0);
  await expect(page.getByText("할 일이 없습니다.", { exact: true })).toHaveCount(0);
  const allNotes = page.getByRole("link", { name: "모든 노트", exact: true });
  await allNotes.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/w/${WORKSPACE_ID}$`));
  await expect(page.getByRole("button", { name: "모든 노트", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "할 일", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "주간", exact: true }).click();
  await expect(page.getByRole("heading", { name: "주간", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "할 일", exact: true }).click();
  const project = page.getByRole("link", { name: "주간", exact: true });
  await project.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "주간", exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/w/${WORKSPACE_ID}$`));
});

test("화면 응답을 기다리는 동안 누른 링크에 진행 상태가 보인다", async ({ page }) => {
  await page.addInitScript((workspaceId) => {
    const originalFetch = window.fetch.bind(window);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    Object.assign(window, { releaseRouteFetch: release });
    window.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), location.href);
      if (url.pathname === `/w/${workspaceId}/tasks` && url.searchParams.has("_rsc")) await pending;
      return originalFetch(input, init);
    };
  }, WORKSPACE_ID);
  await page.goto(`/w/${WORKSPACE_ID}`);
  await expect(page.getByRole("heading", { name: "모든 노트", exact: true })).toBeVisible();
  const tasks = page.locator(`a[href="/w/${WORKSPACE_ID}/tasks"]`);
  const click = tasks.click();
  try {
    await expect(tasks.getByRole("status", { name: "화면 이동 중" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "모든 노트", exact: true })).toBeVisible();
  } finally {
    await page.evaluate(() => (window as unknown as { releaseRouteFetch: () => void }).releaseRouteFetch());
  }
  await click;
  await expect(page.getByRole("heading", { name: "할 일", exact: true })).toBeVisible();
  await expect(tasks.getByRole("status", { name: "화면 이동 중" })).toHaveCount(0);
});

test("할 일 조회 실패를 빈 목록으로 접지 않고 다시 읽을 수 있다", async ({ page }) => {
  await page.addInitScript((workspaceId) => {
    const originalFetch = window.fetch.bind(window);
    let fail = true;
    Object.assign(window, { allowTasksFetch: () => { fail = false; } });
    window.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), location.href);
      if (fail && url.pathname === `/v1/workspaces/${workspaceId}/tasks`) {
        return Response.json({ success: false, data: null, error: { code: "BAD_REQUEST", message: "조회 실패" } }, { status: 400 });
      }
      return originalFetch(input, init);
    };
  }, WORKSPACE_ID);
  await page.goto(`/w/${WORKSPACE_ID}/tasks`);
  await expect(page.getByText("할 일을 불러오지 못했습니다.")).toBeVisible();
  await expect(page.getByText("할 일이 없습니다.", { exact: true })).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { allowTasksFetch: () => void }).allowTasksFetch());
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.getByText("할 일을 불러오지 못했습니다.")).toHaveCount(0);
  await expect(page.getByLabel("할 일 불러오는 중")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "인터뷰 녹음 동의서를 받는다", exact: true })).toBeVisible();
});
