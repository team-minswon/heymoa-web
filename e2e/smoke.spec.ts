import { expect, test, type Locator, type Page } from "@playwright/test";

const MOCK_WORKSPACE_ID = "01K0000000000";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    window.localStorage.setItem("mockChatSpeed", "40")
  );
});
const STARTER_NOTE_ID = "01K0000000002";
const FOREIGN_VIEWER_NOTE_ID = "01K0000000028";
const EMPTY_WORKSPACE_ID = "01K0000000009";
const DIARIZED_NOTE_ID = "01K0000000020";
const MEMBER_NAME = "한지원";
const MEMBER_EMAIL = "jiwon@heymoa.com";

function meetingControls(page: Page) {
  return page.getByRole("group", { name: "회의 상태와 제어" });
}

function noteTopBar(page: Page) {
  return page
    .locator('[data-slot="note-top-bar"]')
    .filter({ has: page.getByRole("group", { name: "창 제어" }) });
}

function noteTitleBlock(page: Page) {
  return page.locator("header").filter({ has: page.getByRole("heading") });
}

async function cumulativeTimer(page: Page) {
  const tab = page.getByRole("tab", { name: "정보" });
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  return page.getByRole("timer", { name: "기록 길이" });
}

function recordedSeconds(value: string | null) {
  const [minutes = "0", seconds = "0"] = (value ?? "0:0").split(":");
  return Number(minutes) * 60 + Number(seconds);
}

async function createMeetingNote(page: Page) {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "새 노트" }).click();
  await page.getByLabel("회의 이름").fill("주간 제품 회의");
  await page.getByRole("button", { name: "만들기" }).click();
  await page.waitForURL(
    new RegExp(`/w/${MOCK_WORKSPACE_ID}/notes/[^?]+\\?view=full`)
  );

  const noteId = new URL(page.url()).pathname.split("/").at(-1);
  expect(noteId).toBeTruthy();
  await expect(
    noteTopBar(page).getByText("시작 전", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByLabel("녹음 제어").getByRole("button", { name: "회의 시작" })
  ).toBeVisible();
  return noteId!;
}

async function startRecording(page: Page, name: "회의 시작" | "재개") {
  const dock = page.getByLabel("녹음 제어");
  await dock.getByRole("button", { name }).click();
  await expect(
    dock.getByRole("button", { name: "일시정지", exact: true })
  ).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    noteTopBar(page).getByText("기록 중", { exact: true })
  ).toBeVisible({ timeout: 20_000 });
}

async function stopRecording(page: Page) {
  await page
    .getByLabel("녹음 제어")
    .getByRole("button", { name: "일시정지", exact: true })
    .click();
  await expect(
    noteTopBar(page).getByText("일시정지됨", { exact: true })
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByLabel("녹음 제어").getByRole("button", { name: "재개" })
  ).toBeVisible();
}

async function endMeeting(page: Page) {
  await meetingControls(page)
    .getByRole("button", { name: "회의 종료" })
    .click();
  await page
    .getByRole("dialog", { name: "회의를 종료할까요?" })
    .getByRole("button", { name: "회의 종료" })
    .click();
  await expect(
    noteTopBar(page).getByText("종료됨", { exact: true })
  ).toBeVisible({ timeout: 20_000 });
}

async function expectForeignViewerTranscript(
  page: Page,
  viewportSize: { width: number; height: number }
) {
  await page.setViewportSize(viewportSize);
  let transcriptRequestCount = 0;
  const countTranscriptRequest = (request: { url: () => string }) => {
    if (
      new URL(request.url()).pathname ===
      `/v1/notes/${FOREIGN_VIEWER_NOTE_ID}/transcript`
    ) {
      transcriptRequestCount += 1;
    }
  };
  page.on("request", countTranscriptRequest);

  try {
    await page.goto(
      `/w/${MOCK_WORKSPACE_ID}/notes/${FOREIGN_VIEWER_NOTE_ID}?view=full&tab=transcript`
    );

    const blocks = page.getByTestId("transcript-block");
    await expect(blocks.first()).toContainText(
      "파트너 요구사항을 먼저 확인하겠습니다."
    );
    await expect(page.getByLabel("녹음 제어")).toBeVisible();
    await expect(
      page.getByText("다른 탭이나 기기에서 기록 중입니다.")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "회의 종료" })).toBeVisible();
    if (viewportSize.width === 375) {
      await expect(
        noteTopBar(page).getByText("기록 중", { exact: true })
      ).toBeVisible();
      await page.getByRole("tab", { name: "정보" }).click();
      const starterName = noteTitleBlock(page).getByText("김서연님이 기록 중", {
        exact: false,
      });
      await expect(starterName).toBeVisible();
      const starterBox = await starterName.boundingBox();
      expect(starterBox).not.toBeNull();
      expect(starterBox!.x).toBeGreaterThanOrEqual(0);
      expect(starterBox!.x + starterBox!.width).toBeLessThanOrEqual(
        viewportSize.width
      );
      await page.getByRole("tab", { name: "스크립트" }).click();
      await expect(blocks.first()).toBeVisible();
    }
    expect(await blocks.count()).toBeGreaterThan(0);

    const transcriptViewport = page
      .locator('[data-slot="scroll-area"]')
      .filter({ has: page.getByRole("log", { name: "회의 스크립트" }) })
      .locator('[data-slot="scroll-area-viewport"]');
    await expect(transcriptViewport).toBeVisible();
    await expect
      .poll(() => transcriptRequestCount, { timeout: 8_000 })
      .toBeGreaterThanOrEqual(1);
    await expect(
      page.getByText("실시간 catch-up으로 도착한 추가 전사 1입니다.")
    ).toBeVisible();

    const metrics = await transcriptViewport.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(metrics.scrollHeight - metrics.clientHeight).toBeGreaterThan(0);
    await expect
      .poll(() =>
        transcriptViewport.evaluate(
          (element) =>
            element.scrollHeight - element.scrollTop - element.clientHeight
        )
      )
      .toBeLessThanOrEqual(32);
  } finally {
    page.off("request", countTranscriptRequest);
  }
}

test("기록 중 회의를 삭제하면 녹음을 종료하고 목록에서도 제거한다", async ({
  page,
}) => {
  const noteId = await createMeetingNote(page);
  await startRecording(page, "회의 시작");
  await page.getByRole("button", { name: "노트 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "삭제" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(
    "이 회의록만 물어본 에이전트 대화도 함께 삭제합니다. 같은 프로젝트의 다른 회의록과 결정 사항, 할 일, 다른 자료도 함께 물어본 대화는 그대로 남습니다."
  );
  await dialog.getByRole("button", { name: "삭제", exact: true }).click();

  await expect(
    page.getByText("회의를 삭제했습니다.", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "일시정지", exact: true })
  ).toHaveCount(0);
  await expect(page.locator(`a[href*="/notes/${noteId}"]`)).toHaveCount(0);
  await page.goto(`/w/${MOCK_WORKSPACE_ID}/notes/${noteId}?view=full`);
  await expect(
    page.getByRole("button", { name: "노트 메뉴", exact: true })
  ).toHaveCount(0);
});

test("boots with the MSW service worker registered", async ({ page }) => {
  const localSeeds: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/mock-local/")) localSeeds.push(request.url());
  });
  await page.goto("/");

  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null)
    )
    .toBe(true);
  expect(localSeeds).toEqual([]);
});

test("renders the workspace surface from mock data", async ({ page }) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);

  await expect(page.getByText("테스트 유저의 워크스페이스")).toBeVisible();
});

test("renders the foreign viewer transcript with observer controls", async ({
  page,
}) => {
  await page.addInitScript((transcriptPath) => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      const input = args[0];
      const url = input instanceof Request ? input.url : String(input);
      if (new URL(url, window.location.href).pathname !== transcriptPath) {
        return response;
      }

      if (!response.ok) return response;

      const body = await response.clone().json();
      const segments = body.data?.segments;
      if (!Array.isArray(segments) || segments.length === 0) return response;

      const last = segments.at(-1);
      const added = Array.from({ length: 12 }, (_, index) => {
        const startedAtMs = last.endedAtMs + (index + 1) * 4_000;
        return {
          ...last,
          segmentId: `01K${String(index + 100).padStart(10, "0")}`,
          sequence: last.sequence + index + 1,
          text: `실시간 catch-up으로 도착한 추가 전사 ${index + 1}입니다.`,
          startedAtMs,
          endedAtMs: startedAtMs + 1_800,
        };
      });

      return new Response(
        JSON.stringify({
          ...body,
          data: { ...body.data, segments: [...segments, ...added] },
        }),
        {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        }
      );
    };
  }, `/v1/notes/${FOREIGN_VIEWER_NOTE_ID}/transcript`);

  for (const viewportSize of [
    { width: 1280, height: 720 },
    { width: 375, height: 812 },
  ]) {
    await expectForeignViewerTranscript(page, viewportSize);
  }
});

test("keeps the mobile recorder dock outside the transcript above a bounded chat tray", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${STARTER_NOTE_ID}?view=full&tab=transcript`
  );

  const transcriptLog = page.getByRole("log", { name: "회의 스크립트" });
  const transcriptViewport = page
    .locator('[data-slot="scroll-area"]')
    .filter({ has: transcriptLog })
    .locator('[data-slot="scroll-area-viewport"]');
  const dock = page.getByLabel("녹음 제어");
  const tray = page.getByTestId("note-agent-rail");

  await expect(page.getByTestId("transcript-block").first()).toBeVisible();
  await expect(dock).toBeVisible();
  await page.getByRole("button", { name: "내 에이전트 열기" }).click();
  await expect(tray.getByLabel("메시지")).toBeVisible();

  const [transcriptBox, dockBox, trayBox] = await Promise.all([
    transcriptViewport.boundingBox(),
    dock.boundingBox(),
    tray.boundingBox(),
  ]);
  expect(transcriptBox).not.toBeNull();
  expect(dockBox).not.toBeNull();
  expect(trayBox).not.toBeNull();

  const overlapHeight = Math.max(
    0,
    Math.min(
      transcriptBox!.y + transcriptBox!.height,
      dockBox!.y + dockBox!.height
    ) - Math.max(transcriptBox!.y, dockBox!.y)
  );
  expect(overlapHeight).toBe(0);
  expect(transcriptBox!.height).toBeGreaterThan(0);
  expect(trayBox!.height).toBeGreaterThanOrEqual(220);
  expect(trayBox!.height).toBeLessThanOrEqual(320);
});

test("keeps the recorder dock and transcript visible in mobile landscape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 812, height: 375 });
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${STARTER_NOTE_ID}?view=full&tab=transcript`
  );

  const surface = page.locator('[data-surface="full"]');
  const panel = surface
    .locator(":scope > div:not([data-slot=sheet-header])")
    .first();
  const main = panel.locator(":scope > div").first();
  const transcriptLog = page.getByRole("log", { name: "회의 스크립트" });
  const transcriptViewport = page
    .locator('[data-slot="scroll-area"]')
    .filter({ has: transcriptLog })
    .locator('[data-slot="scroll-area-viewport"]');
  const dock = page.getByLabel("녹음 제어");
  const tray = page.getByTestId("note-agent-rail");

  await expect.soft(transcriptViewport).toBeVisible();
  await expect(dock).toBeVisible();
  await page.getByRole("button", { name: "내 에이전트 열기" }).click();
  await expect(tray.getByLabel("메시지")).toBeVisible();

  const [surfaceBox, mainBox, transcriptBox, dockBox, trayBox] =
    await Promise.all([
      surface.boundingBox(),
      main.boundingBox(),
      transcriptViewport.boundingBox(),
      dock.boundingBox(),
      tray.boundingBox(),
    ]);
  expect(surfaceBox).not.toBeNull();
  expect(mainBox).not.toBeNull();
  expect(transcriptBox).not.toBeNull();
  expect(dockBox).not.toBeNull();
  expect(trayBox).not.toBeNull();

  expect(dockBox!.x).toBeGreaterThanOrEqual(mainBox!.x);
  expect(dockBox!.y).toBeGreaterThanOrEqual(mainBox!.y);
  expect(dockBox!.x + dockBox!.width).toBeLessThanOrEqual(
    mainBox!.x + mainBox!.width
  );
  expect(dockBox!.y + dockBox!.height).toBeLessThanOrEqual(
    mainBox!.y + mainBox!.height
  );
  expect(dockBox!.x).toBeGreaterThanOrEqual(surfaceBox!.x);
  expect(dockBox!.y).toBeGreaterThanOrEqual(surfaceBox!.y);
  expect(dockBox!.x + dockBox!.width).toBeLessThanOrEqual(
    surfaceBox!.x + surfaceBox!.width
  );
  expect(dockBox!.y + dockBox!.height).toBeLessThanOrEqual(
    surfaceBox!.y + surfaceBox!.height
  );

  const overlapHeight = Math.max(
    0,
    Math.min(
      transcriptBox!.y + transcriptBox!.height,
      dockBox!.y + dockBox!.height
    ) - Math.max(transcriptBox!.y, dockBox!.y)
  );
  expect(overlapHeight).toBe(0);
  expect(transcriptBox!.height).toBeGreaterThan(0);
  expect(trayBox!.height).toBeGreaterThan(0);
});

test("serves a new endpoint through the service worker", async ({ page }) => {
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null)
    )
    .toBe(true);

  const payload = await page.evaluate(async () => {
    const response = await fetch("/v1/notifications", {
      credentials: "include",
    });
    return { status: response.status, body: await response.json() };
  });

  expect(payload.status).toBe(200);
  expect(payload.body.success).toBe(true);
  expect(payload.body.data.unreadCount).toBeGreaterThanOrEqual(0);
});

test("streams chat tokens through the service worker", async ({ page }) => {
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null)
    )
    .toBe(true);

  const events = await page.evaluate(async () => {
    const created = await fetch("/v1/workspaces/01K0000000000/agent-chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    }).then((response) => response.json());

    const accepted = await fetch(
      `/v1/agent-chats/${created.data.chatId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: "요약해줘" }),
      }
    );
    const { data } = await accepted.json();
    const stream = await fetch(
      `/v1/agent-chats/${created.data.chatId}/turns/${data.turnId}/events`,
      { credentials: "include" }
    );

    const text = await stream.text();
    return {
      status: accepted.status,
      events: text
        .split("\n\n")
        .filter((block) => block.includes("event:"))
        .map((block) => {
          const lines = block.split("\n");
          const idLine = lines.find((each) => each.startsWith("id:"));
          return {
            event: lines
              .find((each) => each.startsWith("event:"))!
              .slice("event:".length)
              .trim(),
            id: idLine === undefined ? null : idLine.slice("id:".length).trim(),
            data: JSON.parse(
              lines
                .find((each) => each.startsWith("data:"))!
                .slice("data:".length)
            ) as Record<string, unknown>,
          };
        }),
    };
  });

  expect(events.status).toBe(202);
  expect(events.events[0].event).toBe("message_start");
  expect(events.events.at(-1)!.event).toBe("message_end");
  expect(events.events.every((event) => /^\d+-\d+$/.test(event.id ?? ""))).toBe(
    true
  );
  expect(events.events.every((event) => !("payload" in event.data))).toBe(true);
});

test("resumes a dropped chat stream through the service worker", async ({
  page,
}) => {
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null)
    )
    .toBe(true);

  const resumed = await page.evaluate(async () => {
    const created = await fetch("/v1/workspaces/01K0000000000/agent-chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    }).then((response) => response.json());
    const chatId = created.data.chatId as string;

    const { data } = await fetch(`/v1/agent-chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ message: "요약해줘" }),
    }).then((response) => response.json());
    const events = `/v1/agent-chats/${chatId}/turns/${data.turnId}/events`;
    const stream = await fetch(events, { credentials: "include" });

    const reader = stream.body!.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    void reader.cancel();
    const cursor = [...first.matchAll(/^id: (\S+)/gm)].at(-1)![1];

    const rest = await fetch(`${events}?after=${cursor}`, {
      credentials: "include",
    }).then((response) => response.text());

    return {
      cursor,
      events: rest
        .split("\n\n")
        .filter((block) => block.includes("event:"))
        .map((block) =>
          block
            .split("\n")
            .find((each) => each.startsWith("event:"))!
            .slice("event:".length)
            .trim()
        ),
    };
  });

  expect(resumed.cursor).toMatch(/^\d+-\d+$/);
  expect(resumed.events.at(-1)).toBe("message_end");
});

test("picks up a turn that started outside the panel", async ({ page }) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null)
    )
    .toBe(true);

  await page.evaluate(async (workspaceId) => {
    const created = await fetch(`/v1/workspaces/${workspaceId}/agent-chats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    }).then((response) => response.json());

    await fetch(`/v1/agent-chats/${created.data.chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ message: "Linear 이슈 만들어줘" }),
    });
  }, MOCK_WORKSPACE_ID);

  await page.getByRole("button", { name: "내 에이전트 열기" }).click();

  const approve = page.getByRole("button", { name: "승인", exact: true });
  await expect(approve).toBeVisible({ timeout: 20_000 });
  await approve.click();

  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 30_000 }
  );
});

test("stops a running turn and lets the next message through", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);

  await page.getByRole("button", { name: "내 에이전트 열기" }).click();
  await page.getByLabel("메시지").fill("요약해줘");
  await page.getByRole("button", { name: "보내기", exact: true }).click();

  const stop = page.getByRole("button", { name: "중지", exact: true });
  await expect(stop).toBeVisible({ timeout: 20_000 });
  await stop.click();

  await expect(
    page.getByRole("button", { name: "보내기", exact: true })
  ).toBeEnabled({ timeout: 20_000 });
});

test("renames a chat in place from the header and from history", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "내 에이전트 열기" }).click();
  await page.getByTestId("chat-list-new").click();
  await page.getByLabel("메시지").fill("이름 바꿀 대화");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 20_000 }
  );

  await page.getByRole("button", { name: "이름 변경: 이름 바꿀 대화" }).click();
  const input = page.getByRole("textbox", { name: "대화 제목" });
  await input.fill("스프린트 회고");
  await input.press("Enter");
  const header = page.getByRole("button", {
    name: "이름 변경: 스프린트 회고",
  });
  await expect(header).toBeFocused();

  await page.getByRole("button", { name: "대화 기록" }).click();
  const history = page.getByTestId("chat-history-view");
  const menu = history.getByRole("button", { name: "스프린트 회고 메뉴" });
  await menu.click();
  await page.getByRole("menuitem", { name: "이름 변경" }).click();
  await history.getByRole("textbox", { name: "대화 제목" }).press("Escape");
  await expect(menu).toBeFocused();
  await menu.click();
  await page.getByRole("menuitem", { name: "이름 변경" }).click();
  const row = history.getByRole("textbox", { name: "대화 제목" });
  await row.fill("회고 정리");
  await row.press("Enter");
  await expect(
    history.getByRole("button", { name: /^회고 정리(?! 메뉴)/ })
  ).toBeVisible();
});

test("deletes a chat from the header and from history", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "내 에이전트 열기" }).click();

  const compose = async (text: string) => {
    await page.getByLabel("메시지").fill(text);
    await page.getByRole("button", { name: "보내기", exact: true }).click();
  };
  const history = page.getByTestId("chat-history-view");

  for (const question of ["첫째 대화 요약해줘", "둘째 대화 요약해줘"]) {
    await page.getByTestId("chat-list-new").click();
    await compose(question);
    await expect(page.getByTestId("assistant-message").last()).toContainText(
      "습니다",
      { timeout: 20_000 }
    );
  }

  await expect(
    page.getByTestId("personal-chat-panel").locator("header")
  ).toContainText("둘째 대화 정리", { timeout: 10_000 });

  await page.getByTestId("chat-menu").click();
  await page.getByRole("menuitem", { name: "삭제" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("둘째 대화 정리");
  await confirm.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByText("무엇을 도와드릴까요?")).toBeVisible();

  await page.getByRole("button", { name: "대화 기록" }).click();
  await expect(
    history.getByRole("button", {
      name: /^(둘째 대화 요약해줘|둘째 대화 정리)(?! 메뉴)/,
    })
  ).toHaveCount(0);
  const first = history.getByRole("button", {
    name: /^(첫째 대화 요약해줘|첫째 대화 정리)(?! 메뉴)/,
  });
  await first.hover();
  await history
    .getByRole("button", {
      name: /^(첫째 대화 요약해줘|첫째 대화 정리) 메뉴$/,
    })
    .click();
  await page.getByRole("menuitem", { name: "삭제" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(first).toHaveCount(0);
});

test("keeps a second chat alive while the first waits for approval", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "내 에이전트 열기" }).click();

  const compose = async (text: string) => {
    await page.getByLabel("메시지").fill(text);
    await page.getByRole("button", { name: "보내기", exact: true }).click();
  };

  await page.getByTestId("chat-list-new").click();
  await compose("Linear 이슈 만들어줘");
  await expect(
    page.getByRole("button", { name: "승인", exact: true })
  ).toBeVisible({
    timeout: 20_000,
  });

  const newChat = page.getByTestId("chat-list-new");
  await expect(newChat).toBeEnabled();
  await newChat.click();

  await expect(page.getByText("무엇을 도와드릴까요?")).toBeVisible();
  await compose("요약해줘");
  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 20_000 }
  );

  await page.getByRole("button", { name: "대화 기록" }).click();
  const history = page.getByTestId("chat-history-view");
  const waiting = history.getByRole("button", {
    name: /승인 대기/,
  });
  await expect(waiting).toContainText("승인 대기", { timeout: 20_000 });
  const finished = history.getByRole("button", {
    name: /^(요약해줘|대화 정리)(?! 메뉴)/,
  });
  await expect(finished).toBeVisible({ timeout: 20_000 });
  await expect(finished).not.toContainText("진행 중");

  await waiting.click();
  const approve = page.getByRole("button", { name: "승인", exact: true });
  await expect(approve).toBeVisible({ timeout: 20_000 });
  await approve.click();
  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 30_000 }
  );
});

async function settledScrollTop(viewport: Locator): Promise<number> {
  const read = () => viewport.evaluate((el) => el.scrollTop);
  let previous = -1;
  await expect
    .poll(
      async () => {
        const now = await read();
        const stable = now === previous;
        previous = now;
        return stable;
      },
      { timeout: 5_000, intervals: [100] }
    )
    .toBe(true);
  return read();
}

function placedIn(viewport: Locator, target: Locator) {
  return async () => {
    const box = await target.boundingBox();
    const frame = await viewport.boundingBox();
    if (!box || !frame) return Number.POSITIVE_INFINITY;
    return (box.y - frame.y) / frame.height;
  };
}

test("pins the question to the top and does not jump when the answer lands", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "내 에이전트 열기" }).click();

  const viewport = page
    .getByTestId("chat-thread-view")
    .locator('[data-slot="scroll-area-viewport"]');
  await expect(page.getByTestId("assistant-message").first()).toBeVisible({
    timeout: 20_000,
  });

  await page.getByLabel("메시지").fill("맨 위로 올라가야 합니다");
  await page.getByRole("button", { name: "보내기", exact: true }).click();

  const asked = page.getByText("맨 위로 올라가야 합니다");
  await expect(asked).toBeVisible();

  const placed = placedIn(viewport, asked);
  await expect.poll(placed, { timeout: 5_000 }).toBeLessThan(0.34);

  const scrollTop = () => viewport.evaluate((el) => el.scrollTop);
  const during = await settledScrollTop(viewport);

  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 20_000 }
  );

  expect(Math.abs((await scrollTop()) - during)).toBeLessThan(16);
  await expect.poll(placed, { timeout: 5_000 }).toBeLessThan(0.34);

  await viewport.evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.getByLabel("메시지").fill("위에서 보내도 올라가야 합니다");
  await page.getByRole("button", { name: "보내기", exact: true }).click();

  const second = page.getByText("위에서 보내도 올라가야 합니다");
  await expect(second).toBeVisible();
  await expect
    .poll(placedIn(viewport, second), { timeout: 5_000 })
    .toBeLessThan(0.34);
});

test("draws the markdown answer inside the narrow chat column", async ({
  page,
}) => {
  await page.setViewportSize({ width: 380, height: 900 });
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "내 에이전트 열기" }).click();

  await page.getByTestId("chat-list-new").click();
  await page.getByLabel("메시지").fill("마크다운으로 보여줘");
  await page.getByRole("button", { name: "보내기", exact: true }).click();

  const link = page.locator('.chat-md a[href*="analytics.example.com"]').last();
  await expect(link).toBeVisible({ timeout: 30_000 });

  const measured = await link.evaluate((el) => ({
    link: el.getBoundingClientRect().width,
    column: el.closest(".chat-md")!.getBoundingClientRect().width,
  }));
  expect(measured.column).toBeGreaterThan(0);
  expect(measured.link).toBeLessThanOrEqual(measured.column + 1);

  const markers = await page.evaluate(() => {
    const items = [...document.querySelectorAll<HTMLElement>(".chat-md li")];
    const ownsCheckbox = (li: HTMLElement) =>
      [...li.children].some((child) => child.tagName === "INPUT");
    const parent = items.find((li) =>
      li.textContent?.startsWith("설정 화면 개선")
    );
    return {
      tasks: items
        .filter(ownsCheckbox)
        .map((li) => getComputedStyle(li).listStyleType),
      parent: parent ? getComputedStyle(parent).listStyleType : null,
      parentOwnsCheckbox: parent ? ownsCheckbox(parent) : null,
    };
  });
  expect(markers.tasks.length).toBeGreaterThan(0);
  expect([...new Set(markers.tasks)]).toEqual(["none"]);
  expect(markers.parentOwnsCheckbox).toBe(false);
  expect(markers.parent).toBe("disc");
});

test("keeps the question near the top when a divider joins a multi-line send", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "내 에이전트 열기" }).click();
  await expect(page.getByTestId("assistant-message").first()).toBeVisible({
    timeout: 20_000,
  });

  await page.getByRole("button", { name: "대화 기록" }).click();
  const history = page.getByTestId("chat-history-view");
  await expect(history).toBeVisible();
  await history
    .getByRole("button", { name: /^배포 일정 확인(?! 메뉴)/ })
    .click();

  const viewport = page
    .getByTestId("chat-thread-view")
    .locator('[data-slot="scroll-area-viewport"]');
  await expect(page.getByTestId("assistant-message").first()).toBeVisible({
    timeout: 20_000,
  });
  const dividers = page.getByTestId("thread-divider");
  await expect(dividers).toHaveCount(1);

  const asked = "여러 줄로 써서 보내도 맨 위로 올라가야 합니다";
  await page
    .getByLabel("메시지")
    .fill(`${"자리를 재는 값이 낡지 않아야 합니다. ".repeat(8)}${asked}`);
  await page.getByRole("button", { name: "보내기", exact: true }).click();

  const question = page.getByText(asked);
  await expect(question).toBeVisible();
  await expect(dividers).toHaveCount(2);

  const topOffset = async () => {
    const box = await question.boundingBox();
    const frame = await viewport.boundingBox();
    return box && frame ? box.y - frame.y : Number.NaN;
  };
  await expect.poll(topOffset, { timeout: 6_000 }).toBeLessThan(80);

  const scrollTop = () => viewport.evaluate((el) => el.scrollTop);
  const during = await settledScrollTop(viewport);
  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 30_000 }
  );
  expect(Math.abs((await scrollTop()) - during)).toBeLessThan(16);
  await expect(question).toBeVisible();
  await expect.poll(topOffset, { timeout: 6_000 }).toBeLessThan(80);
});

test("does not add a thread divider when the answer lands", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "내 에이전트 열기" }).click();

  const dividers = page.getByTestId("thread-divider");

  await page.getByTestId("chat-list-new").click();
  await page.getByLabel("메시지").fill("Linear 이슈 만들어줘");
  await page.getByRole("button", { name: "보내기", exact: true }).click();

  const approve = page.getByRole("button", { name: "승인", exact: true });
  await expect(approve).toBeVisible({ timeout: 20_000 });
  await expect(dividers).toHaveCount(1);

  await approve.click();
  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 30_000 }
  );

  await expect(dividers).toHaveCount(1);
});

test("does not create a chat row until the first message is sent", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "내 에이전트 열기" }).click();

  await page.getByTestId("chat-list-new").click();
  await page.getByLabel("메시지").fill("요약해줘");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 20_000 }
  );

  await page.getByTestId("chat-list-new").click();
  await expect(page.getByText("무엇을 도와드릴까요?")).toBeVisible();
  await page.getByRole("button", { name: "대화 기록" }).click();

  const history = page.getByTestId("chat-history-view");
  await expect(
    history.getByRole("button", { name: /^(요약해줘|대화 정리)(?! 메뉴)/ })
  ).toBeVisible();
  await expect(
    history.getByRole("button", { name: /^새 대화(?! 메뉴)/ })
  ).toHaveCount(0);
});

test("opens a blank agent chat in the rail of a newly created note", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "내 에이전트 열기" }).click();
  await page.getByTestId("chat-list-new").click();
  await page.getByLabel("메시지").fill("요약해줘");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 20_000 }
  );
  await page.getByRole("button", { name: "닫기" }).click();

  await page.getByRole("button", { name: "새 노트" }).click();
  await page.getByLabel("회의 이름").fill("주간 제품 회의");
  await page.getByRole("button", { name: "만들기" }).click();
  await page.waitForURL(
    new RegExp(`/w/${MOCK_WORKSPACE_ID}/notes/[^?]+\\?view=full`)
  );

  const panel = page.locator("[data-testid=personal-chat-panel][data-railed]");
  await expect(panel.getByText("무엇을 도와드릴까요?")).toBeVisible();
  await expect(panel.getByTestId("assistant-message")).toHaveCount(0);
  await panel.getByRole("button", { name: "대화 기록" }).click();
  await expect(
    panel.getByTestId("chat-history-view").getByRole("button", {
      name: /^(요약해줘|대화 정리)(?! 메뉴)/,
    })
  ).toBeVisible();
});

test("swaps the chat history in and back out inside the panel", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "내 에이전트 열기" }).click();

  await page.getByTestId("chat-list-new").click();
  await page.getByLabel("메시지").fill("요약해줘");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 20_000 }
  );

  await page.getByTestId("chat-list-new").click();
  await expect(page.getByText("무엇을 도와드릴까요?")).toBeVisible();

  const thread = page.getByTestId("chat-thread-view");
  const history = page.getByTestId("chat-history-view");
  await expect(history).toBeHidden();

  await page.getByRole("button", { name: "대화 기록" }).click();
  await expect(history).toBeVisible();
  await expect(thread).toBeHidden();
  await expect(
    page.getByRole("button", { name: "대화로 돌아가기" })
  ).toBeVisible();

  await history
    .getByRole("button", { name: /^(요약해줘|대화 정리)(?! 메뉴)/ })
    .click();
  await expect(thread).toBeVisible();
  await expect(history).toBeHidden();
  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 20_000 }
  );
});

test("streams a personal chat turn from the panel", async ({ page }) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);

  await page.getByRole("button", { name: "내 에이전트 열기" }).click();
  await page.getByTestId("chat-list-new").click();
  await expect(page.getByText("무엇을 도와드릴까요?")).toBeVisible();

  await page.getByLabel("메시지").fill("요약해줘");
  await page.getByRole("button", { name: "보내기" }).click();

  const liveAnswer = page.getByTestId("assistant-message").last();
  await expect(liveAnswer).toHaveAttribute("data-streaming", "true");
  const liveNode = await liveAnswer.elementHandle();
  await expect(liveAnswer).toContainText("습니다", { timeout: 20_000 });
  expect(await liveNode?.evaluate((node) => node.isConnected)).toBe(true);
  await expect(
    page.getByRole("button", { name: "보내기", exact: true })
  ).toBeEnabled({ timeout: 20_000 });
  expect(await liveNode?.evaluate((node) => node.isConnected)).toBe(true);
  expect(
    await page.evaluate(
      (node) =>
        node === document.querySelector('[data-testid="assistant-message"]'),
      liveNode
    )
  ).toBe(true);

  await page.getByLabel("메시지").fill("한 번 더 정리해줘");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(page.getByTestId("assistant-message")).toHaveCount(2, {
    timeout: 20_000,
  });
  const thread = page.getByTestId("chat-thread-view");
  await expect(thread.getByText("요약해줘", { exact: true })).toBeVisible();
  await expect(
    thread.getByText("한 번 더 정리해줘", { exact: true })
  ).toBeVisible();
});

test("unlocks the composer after a stop so the next question goes out", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "내 에이전트 열기" }).click();

  await page.getByLabel("메시지").fill("Linear 이슈 만들어줘");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "승인", exact: true })
  ).toBeVisible({
    timeout: 20_000,
  });

  await page.getByRole("button", { name: "중지", exact: true }).click();
  await expect(page.getByRole("button", { name: "다시 보내기" })).toHaveCount(
    0
  );

  const send = page.getByRole("button", { name: "보내기", exact: true });
  await expect(send).toBeEnabled({ timeout: 20_000 });
  await page.getByLabel("메시지").fill("Linear 이슈 만들어줘");
  await send.click();

  const approve = page.getByRole("button", { name: "승인", exact: true });
  await expect(approve).toBeVisible({ timeout: 20_000 });
  await approve.click();
  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 30_000 }
  );
});

test("opens the note from a scope chip inside the sent bubble", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "내 에이전트 열기" }).click();
  await page.getByTestId("chat-list-new").click();

  const editor = page.getByLabel("메시지");
  await editor.click();
  await editor.pressSequentially("@알림 정책");
  await page.getByRole("option", { name: "알림 정책 논의 (2차)" }).click();
  await editor.pressSequentially("액션 정리해줘");
  await page.getByRole("button", { name: "보내기", exact: true }).click();

  const chip = page.getByRole("button", { name: "알림 정책 논의 (2차) 열기" });
  await expect(chip).toBeVisible({ timeout: 20_000 });
  await chip.click();

  await expect(page).toHaveURL(
    /\/notes\/01K0000000021\?view=full&tab=transcript/
  );
});

test("shows the out-of-scope note in the answer refs after widening", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "내 에이전트 열기" }).click();

  await page.getByTestId("chat-list-new").click();
  await page.getByLabel("메시지").fill("범위 밖 얘기 있어?");
  await page.getByRole("button", { name: "보내기", exact: true }).click();

  await expect(page.getByTestId("assistant-message").first()).toBeVisible({
    timeout: 20_000,
  });

  await expect(
    page.getByRole("group", { name: "참고한 회의록 2개" }).last()
  ).toBeVisible({
    timeout: 20_000,
  });
});

test("shows a persistent explanation for a remotely active starter note", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}/notes/01K0000000002?view=full`);

  await expect(page.getByRole("button", { name: "회의 종료" })).toBeVisible();
  await expect(
    page.getByText("다른 탭이나 기기에서 기록 중입니다.", { exact: true })
  ).toBeVisible();
  await expect(
    page
      .getByLabel("녹음 제어")
      .getByRole("button", { name: /회의 시작|재개|일시정지/ })
  ).toHaveCount(0);
});

test("creates a NOT_STARTED note without requesting the microphone", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices
    );
    const state = window as typeof window & { app288GetUserMediaCalls: number };
    state.app288GetUserMediaCalls = 0;
    navigator.mediaDevices.getUserMedia = (...args) => {
      state.app288GetUserMediaCalls += 1;
      return original(...args);
    };
  });

  await createMeetingNote(page);

  await expect(await cumulativeTimer(page)).toHaveText("00:00");
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { app288GetUserMediaCalls: number })
          .app288GetUserMediaCalls
    )
  ).toBe(0);
});

test("starts, stops, and ends a meeting through one confirmation", async ({
  page,
}) => {
  const frameWarnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().startsWith("mock transcription:")) {
      frameWarnings.push(message.text());
    }
  });

  await createMeetingNote(page);
  await startRecording(page, "회의 시작");
  expect(
    recordedSeconds(await (await cumulativeTimer(page)).textContent())
  ).toBeLessThan(60);

  await expect(
    meetingControls(page).getByRole("button", { name: "회의 종료" })
  ).toBeDisabled();
  await stopRecording(page);
  await endMeeting(page);

  expect(frameWarnings).toEqual([]);

  await expect(page.getByLabel("녹음 제어")).toHaveCount(0);
  await expect(page.getByText("회의를 분석하는 중입니다")).toBeVisible({
    timeout: 20_000,
  });
});

test("freezes cumulative time across stop and end", async ({ page }) => {
  await createMeetingNote(page);
  await startRecording(page, "회의 시작");
  await stopRecording(page);

  const timer = await cumulativeTimer(page);
  const stopped = recordedSeconds(await timer.textContent());
  expect(stopped).toBeGreaterThan(0);
  await page.waitForTimeout(1_100);
  expect(recordedSeconds(await timer.textContent())).toBe(stopped);

  await endMeeting(page);

  expect(
    recordedSeconds(await (await cumulativeTimer(page)).textContent())
  ).toBe(stopped);
});

test("continues cumulative time across stop, resume, and stop", async ({
  page,
}) => {
  await createMeetingNote(page);
  await startRecording(page, "회의 시작");
  await stopRecording(page);

  const timer = await cumulativeTimer(page);
  const firstStop = recordedSeconds(await timer.textContent());
  expect(firstStop).toBeGreaterThan(0);

  await startRecording(page, "재개");
  await stopRecording(page);

  const resumedTimer = await cumulativeTimer(page);
  const secondStop = recordedSeconds(await resumedTimer.textContent());
  expect(secondStop).toBeGreaterThan(firstStop);
  await page.waitForTimeout(1_100);
  expect(recordedSeconds(await resumedTimer.textContent())).toBe(secondStop);
});

test("walks a project-less workspace from project to first meeting", async ({
  page,
}) => {
  await page.goto(`/w/${EMPTY_WORKSPACE_ID}`);

  const onboarding = page.getByTestId("workspace-onboarding");
  await expect(onboarding).toHaveAttribute("data-stage", "no-project");
  await expect(page.getByText(/개의 회의 기록/)).toHaveCount(0);

  await page.getByRole("button", { name: "새 노트" }).click();
  await expect(
    page.getByRole("dialog", { name: "첫 프로젝트 만들기" })
  ).toBeVisible();
  await page.getByLabel("프로젝트 이름").fill("고객");
  await page.getByRole("button", { name: "만들기" }).click();

  await expect(page.getByLabel("회의 이름")).toBeVisible();
  await page.getByLabel("회의 이름").fill("첫 고객 인터뷰");
  await page.getByRole("button", { name: "만들기" }).click();

  await expect(page).toHaveURL(
    new RegExp(`/w/${EMPTY_WORKSPACE_ID}/notes/[^?]+\\?view=full`)
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "첫 고객 인터뷰" })
  ).toBeVisible();
});

test("shows the NOT_STARTED recorder dock in the side panel", async ({
  page,
}) => {
  const noteId = await createMeetingNote(page);
  await page.getByRole("button", { name: "목록으로" }).click();
  await page.locator(`a[href*="/notes/${noteId}"]`).first().click();
  await expect(page).toHaveURL(
    `/w/${MOCK_WORKSPACE_ID}/notes/${noteId}?view=side&tab=details`
  );

  await expect(
    page.getByLabel("녹음 제어").getByRole("button", { name: "회의 시작" })
  ).toBeVisible();
  await expect(
    noteTopBar(page).getByText("시작 전", { exact: true })
  ).toBeVisible();
});

test("locks ending a remotely recorded meeting in the side panel", async ({
  page,
}) => {
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${STARTER_NOTE_ID}?view=side&tab=transcript`
  );

  const noteSurface = page.getByLabel("노트", { exact: true });
  await expect(noteSurface.getByText("기록 중", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "정보" }).click();
  await expect(
    noteTitleBlock(page).getByText("워크스페이스 멤버에게 공개", {
      exact: true,
    })
  ).toBeVisible();
  await page.getByRole("tab", { name: "스크립트" }).click();
  await expect(
    page.getByText("다른 탭이나 기기에서 기록 중입니다.", { exact: true })
  ).toBeVisible();

  const end = meetingControls(page).getByRole("button", { name: "회의 종료" });
  await expect(end).toBeDisabled();
  await end.locator("..").hover();
  await expect(page.locator('[data-slot="tooltip-content"]')).toHaveText(
    /님이 기록 중입니다\. 일시정지한 뒤 종료할 수 있습니다/
  );
});

for (const view of ["full", "side"] as const) {
  test(`ends from the stop tooltip and opens the summary in ${view} view`, async ({
    page,
  }) => {
    await createMeetingNote(page);
    if (view === "side")
      await page.getByRole("button", { name: "사이드 뷰로 보기" }).click();
    await startRecording(page, "회의 시작");
    await stopRecording(page);
    await page.getByRole("button", { name: "지금 종료", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "회의를 종료할까요?" });
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("button", { name: "회의 종료", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`view=${view}&tab=summary`));
    await expect(
      page.getByRole("tab", { name: "요약", exact: true })
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("회의를 분석하는 중입니다")).toBeVisible();
  });
}

test("ends a stopped meeting from the side panel and opens the ended summary", async ({
  page,
}) => {
  await createMeetingNote(page);
  await startRecording(page, "회의 시작");
  await stopRecording(page);
  await page.getByRole("button", { name: "사이드 뷰로 보기" }).click();
  await expect(page).toHaveURL(/view=side/);

  await meetingControls(page)
    .getByRole("button", { name: "회의 종료" })
    .click();
  const dialog = page.getByRole("dialog", { name: "회의를 종료할까요?" });
  await expect(dialog.getByText("녹음 상태 · 일시정지됨")).toBeVisible();
  await dialog.getByRole("button", { name: "회의 종료" }).click();

  await expect(page.getByText("회의를 분석하는 중입니다")).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    noteTopBar(page).getByText("종료됨", { exact: true })
  ).toBeVisible();
  await expect(page.getByRole("tab")).toHaveText([
    "정보",
    "스크립트",
    /^타임라인/,
    "요약",
  ]);
  await expect(page.getByRole("tab", { name: "챗봇" })).toHaveCount(0);
  await expect(page).toHaveURL(/view=side&tab=summary/);
});

test("fills the composer from an empty-chat example and sends on demand", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);

  await page.getByRole("button", { name: "내 에이전트 열기" }).click();
  await page.getByTestId("chat-list-new").click();
  await page.getByRole("button", { name: "최근 결정" }).click();
  await expect(page.getByLabel("메시지")).toHaveText(
    "최근 2주간 회의에서 정한 것을 근거와 함께 정리해줘"
  );
  await expect(page.getByText("무엇을 도와드릴까요?")).toBeVisible();

  await page.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(page.getByTestId("assistant-message").last()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText("무엇을 도와드릴까요?")).toBeHidden();
});

test("approves a write tool from the chat card", async ({ page }) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);

  await page.getByRole("button", { name: "내 에이전트 열기" }).click();
  await page.getByTestId("chat-list-new").click();
  await page.getByLabel("메시지").fill("논의된 이슈를 Linear 이슈로 만들어줘");
  await page.getByRole("button", { name: "보내기" }).click();

  await expect(
    page.getByText(/승인하거나 거절할 때까지 기다립니다/)
  ).toBeVisible({
    timeout: 20_000,
  });

  const card = page.getByTestId("approval-card");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Linear 이슈 만들기");
  await expect(card).toContainText("APP 버그 수정");
  await expect(card).not.toContainText("projectId");
  await expect(card).not.toContainText("0HZX2K7M9Q4AE");

  await page.getByRole("button", { name: "승인", exact: true }).click();

  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "APP-12",
    { timeout: 20_000 }
  );

  await expect(card).toHaveAttribute("data-approval", "done");
  await expect(card.getByRole("link", { name: "열기" })).toHaveAttribute(
    "href",
    "https://linear.app/heymoa/issue/APP-12"
  );
});

test("completes the mocked OAuth round trip", async ({ page }) => {
  await page.goto(
    `/mock-oauth?workspaceId=${MOCK_WORKSPACE_ID}&provider=LINEAR`
  );
  await expect(
    page.getByRole("button", { name: "허용하고 돌아가기" })
  ).toBeVisible();

  await page.getByRole("button", { name: "허용하고 돌아가기" }).click();

  await page.waitForURL(`**/w/${MOCK_WORKSPACE_ID}`);
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null)
    )
    .toBe(true);

  await expect
    .poll(async () =>
      page.evaluate(async (workspaceId) => {
        const response = await fetch(
          `/v1/workspaces/${workspaceId}/integrations`,
          { credentials: "include" }
        );
        const body = await response.json();
        return body.data.integrations.find(
          (item: { provider: string }) => item.provider === "LINEAR"
        ).connected;
      }, MOCK_WORKSPACE_ID)
    )
    .toBe(true);
});

test("keeps the personal chat scrollable when the thread grows", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "내 에이전트 열기" }).click();

  const panel = page.getByTestId("personal-chat-panel");
  await expect(panel).toBeVisible();

  for (let turn = 0; turn < 4; turn += 1) {
    await page.getByLabel("메시지").fill(`스크롤을 만드는 메시지 ${turn}`);
    await page.getByRole("button", { name: "보내기" }).click();
    await expect(page.getByTestId("assistant-message").nth(turn)).toContainText(
      "습니다",
      { timeout: 20_000 }
    );
  }

  const viewport = panel
    .getByTestId("chat-thread-view")
    .locator('[data-slot="scroll-area-viewport"]');
  const metrics = () =>
    viewport.evaluate((el) => ({
      scrollTop: el.scrollTop,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
    }));

  const grown = await metrics();
  expect(grown.scrollHeight - grown.clientHeight).toBeGreaterThan(0);

  expect(
    grown.scrollHeight - grown.scrollTop - grown.clientHeight
  ).toBeLessThanOrEqual(1);

  await page.getByLabel("메시지").fill("위를 읽는 중에 오는 메시지");
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(
    page.getByRole("button", { name: "중지", exact: true })
  ).toBeVisible({
    timeout: 20_000,
  });
  await viewport.evaluate((el) => {
    el.scrollTop = 0;
    el.dispatchEvent(new Event("scroll"));
  });

  await expect(page.getByTestId("assistant-message").nth(4)).toContainText(
    "습니다",
    { timeout: 20_000 }
  );

  expect((await metrics()).scrollTop).toBe(0);
});

test("covers the sidebar in full view and leaves the note's own close as the way back", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}/notes/01K0000000002?view=full`);
  await expect(page).toHaveURL(/notes/);

  await expect(page.locator('[data-slot="sidebar-container"]')).toHaveAttribute(
    "inert",
    /.*/
  );

  await page.getByRole("button", { name: "목록으로" }).click();
  await expect(page).toHaveURL(new RegExp(`/w/${MOCK_WORKSPACE_ID}$`));
});

test("draws the starter avatar image even when the starter is not a participant", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);

  const starter = page.getByLabel("진행자 김서연 (seoyeon@heymoa.com)");
  await expect(starter).toBeVisible();
  await expect(starter.locator("img")).toBeVisible();
  await expect(starter).not.toHaveText("김");
});

test("keeps the shell frame geometry from design.pen", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await expect(page.getByTestId("workspace-note-list")).toBeAttached();

  const workspace = await page.evaluate(() => {
    const box = (selector: string) => {
      const element = document.querySelector(selector)!;
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        width: Math.round(rect.width),
        right: Math.round(rect.right),
        y: Math.round(rect.y),
        bottom: Math.round(rect.bottom),
      };
    };
    const sidebar = document.querySelector('[data-slot="sidebar-container"]')!;
    return {
      sidebar: box('[data-slot="sidebar-container"]'),
      panel: box('[data-slot="sidebar-inset"] .rounded-panel'),
      sidebarBorderRight: getComputedStyle(sidebar).borderRightWidth,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  });

  expect(workspace.sidebar.width).toBe(232);
  expect(workspace.sidebar.x).toBe(0);
  expect(workspace.sidebarBorderRight).toBe("0px");
  expect(workspace.panel.x).toBe(242);
  expect(workspace.panel.y).toBe(10);
  expect(workspace.panel.width).toBe(1188);
  expect(workspace.panel.x - workspace.sidebar.right).toBe(10);
  expect(workspace.viewport.width - workspace.panel.right).toBe(10);
  expect(workspace.viewport.height - workspace.panel.bottom).toBe(10);

  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${STARTER_NOTE_ID}?view=side&tab=details`
  );
  const sheetLocator = page.locator('[data-surface="sheet"]');
  await expect(sheetLocator).toBeVisible();
  await expect
    .poll(() =>
      sheetLocator.evaluate((el) => Math.round(el.getBoundingClientRect().x))
    )
    .toBe(572);
  const sheet = await sheetLocator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  });
  expect(sheet).toEqual({ y: 8, width: 860, height: 884 });

  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${FOREIGN_VIEWER_NOTE_ID}?view=full&tab=transcript`
  );
  const surface = page.locator('[data-surface="full"]');
  await expect(surface).toBeVisible();
  await surface.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished))
  );
  const rail = page.getByTestId("note-agent-rail");
  await expect(rail).toBeVisible();

  const full = await page.evaluate(() => {
    const element = document.querySelector('[data-surface="full"]')!;
    const rect = element.getBoundingClientRect();
    const column = document.querySelector(
      '[data-testid="note-agent-rail"]'
    )! as HTMLElement;
    const body = column.previousElementSibling!;
    const columnRect = column.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    return {
      surface: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      railWidth: Math.round(columnRect.width),
      gap: Math.round(columnRect.x - bodyRect.right),
    };
  });

  expect(full.surface.x).toBe(0);
  expect(full.surface.y).toBe(0);
  expect(full.viewport.width - full.surface.right).toBe(0);
  expect(full.railWidth).toBe(440);
  expect(full.gap).toBe(10);
});

test("covers the viewport with the full note surface", async ({ page }) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}/notes/01K0000000002?view=full`);

  await expect(page.locator('[data-surface="full"]')).toBeVisible();
  await expect(page.getByTestId("workspace-note-list")).toBeAttached();

  const geometry = await page.evaluate(() => {
    const rect = document
      .querySelector('[data-surface="full"]')!
      .getBoundingClientRect();
    return {
      documentScrollHeight: document.documentElement.scrollHeight,
      viewportHeight: document.documentElement.clientHeight,
      viewportWidth: document.documentElement.clientWidth,
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      bottom: Math.round(rect.bottom),
      right: Math.round(rect.right),
    };
  });

  expect(geometry.documentScrollHeight).toBe(geometry.viewportHeight);
  expect(geometry.top).toBe(0);
  expect(geometry.left).toBe(0);
  expect(geometry.bottom).toBe(geometry.viewportHeight);
  expect(geometry.right).toBe(geometry.viewportWidth);
});

test("clears the note row spinner after the full-view note is closed", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);

  const row = page.locator("article", { hasText: "주간 제품 회의" }).first();
  await row.hover();
  await row.getByRole("button", { name: "주간 제품 회의 노트 메뉴" }).click();
  await page.getByRole("menuitem", { name: "전체 화면" }).click();
  await expect(page).toHaveURL(/view=full/);

  await page.getByRole("button", { name: "목록으로" }).click();
  await expect(page).toHaveURL(new RegExp(`/w/${MOCK_WORKSPACE_ID}$`));

  await expect(row.locator(".animate-spin")).toHaveCount(0);
});

test("switches side and full without reloading note data or remounting the transcript", async ({
  page,
}) => {
  const reads: string[] = [];
  const notePath = `/v1/notes/${DIARIZED_NOTE_ID}`;
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (
      request.url().includes("_rsc=") ||
      [notePath, `${notePath}/transcript`, `${notePath}/proposals`].includes(
        path
      )
    ) {
      reads.push(request.url());
    }
  });
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${DIARIZED_NOTE_ID}?view=side&tab=transcript`
  );
  const block = page.getByTestId("archive-transcript-block").first();
  await expect(block).toBeVisible();
  await expect(
    page.getByRole("button", { name: "복사", exact: true }).first()
  ).toBeEnabled();
  for (const suffix of ["", "/transcript", "/proposals"]) {
    await expect
      .poll(() =>
        reads.some((url) => new URL(url).pathname === `${notePath}${suffix}`)
      )
      .toBe(true);
  }
  const original = await block.elementHandle();
  reads.length = 0;
  await page
    .getByRole("button", { name: "전체 화면으로 보기", exact: true })
    .click();
  await expect(page.locator('[data-surface="full"]')).toBeVisible();
  await expect(
    page.getByRole("button", { name: "사이드 뷰로 보기", exact: true })
  ).toBeVisible();
  expect(await original!.evaluate((element) => element.isConnected)).toBe(true);
  await page
    .getByRole("button", { name: "사이드 뷰로 보기", exact: true })
    .click();
  await expect(page.locator('[data-surface="sheet"]')).toBeVisible();
  await expect(block).toBeVisible();
  expect(await original!.evaluate((element) => element.isConnected)).toBe(true);
  expect(reads).toEqual([]);
});

test("switches note tabs without an RSC round trip", async ({ page }) => {
  const rscRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.pathname === `/w/${MOCK_WORKSPACE_ID}/notes/${STARTER_NOTE_ID}` &&
      url.searchParams.has("_rsc") &&
      request.headers()["next-router-prefetch"] !== "1"
    )
      rscRequests.push(request.url());
  });

  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${STARTER_NOTE_ID}?view=side&tab=details`
  );
  await expect(page.getByRole("tab", { name: "정보" })).toHaveAttribute(
    "aria-selected",
    "true"
  );

  rscRequests.length = 0;

  await page.getByRole("tab", { name: "스크립트" }).click();
  await expect(page.getByRole("tab", { name: "스크립트" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(page).toHaveURL(/tab=transcript/);

  await page.getByRole("tab", { name: "정보" }).click();
  await expect(page.getByRole("tab", { name: "정보" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(page).toHaveURL(/tab=details/);

  expect(rscRequests).toEqual([]);
});

test("draws the thinking rail from history alone", async ({ page }) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "내 에이전트 열기" }).click();
  await page.getByRole("button", { name: "대화 기록" }).click();

  const history = page.getByTestId("chat-history-view");
  await history
    .getByRole("button", { name: /^생각이 남은 대화(?! 메뉴)/ })
    .click();

  const thread = page.getByTestId("chat-thread-view");
  await expect(thread).toBeVisible();
  await expect(thread.getByTestId("assistant-message").last()).toBeVisible({
    timeout: 20_000,
  });

  const rail = thread.getByRole("button", { name: /초 동안 생각/ }).last();
  await expect(rail).toBeVisible();
  await rail.click();
  await expect(thread.locator('[data-step="tool"]').first()).toBeVisible();

  await expect(
    page.getByRole("button", { name: "중지", exact: true })
  ).toBeHidden();
});

test("creates a guest participant from the attendee field and keeps members untouched", async ({
  page,
}) => {
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${STARTER_NOTE_ID}?view=side&tab=details`
  );

  const existingGuest = page.getByLabel("박서준 (외부)");
  await expect(existingGuest.first()).toBeVisible();

  await page.getByRole("combobox", { name: "참여자 추가" }).click();
  const search = page.getByRole("combobox", { name: /참여자 검색/ });

  await search.fill("박서준");
  await expect(page.getByRole("button", { name: /"박서준" 추가/ })).toHaveCount(
    0
  );

  await search.fill("이도현");
  await page.getByRole("button", { name: /"이도현" 추가/ }).click();

  await expect(page.getByLabel("이도현 (외부)").first()).toBeVisible();
});

test("opens guest settings from the participants popup", async ({ page }) => {
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${STARTER_NOTE_ID}?view=side&tab=details`
  );

  await page.getByRole("combobox", { name: "참여자 추가" }).click();
  await page.getByRole("button", { name: "임시 참여자 관리" }).click();

  await expect(page.getByRole("option").first()).toBeHidden();
  await expect(page.getByRole("dialog", { name: /설정/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "임시 참여자", level: 2 })
  ).toBeVisible();
});

test("renames a guest in settings and the attendee field follows", async ({
  page,
}) => {
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${STARTER_NOTE_ID}?view=side&tab=details`
  );
  await expect(page.getByLabel("박서준 (외부)").first()).toBeVisible();

  await page.getByRole("combobox", { name: "참여자 추가" }).click();
  await page.getByRole("button", { name: "임시 참여자 관리" }).click();
  const dialog = page.getByRole("dialog", { name: /설정/ });
  await expect(dialog).toBeVisible();

  const row = dialog
    .getByRole("listitem")
    .filter({ hasText: "박서준" })
    .first();
  await row.getByRole("button", { name: "박서준 관리" }).click();
  await page.getByRole("menuitem", { name: "이름 변경" }).click();
  const input = page.getByRole("textbox", { name: "이름" });
  await input.fill("박서준2");
  await input.press("Enter");
  await expect(input).toHaveCount(0);

  await expect(dialog.getByText("박서준2")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("박서준2 (외부)").first()).toBeVisible();
});

test("keeps guest participants when an account member is removed", async ({
  page,
}) => {
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${STARTER_NOTE_ID}?view=side&tab=details`
  );
  await expect(page.getByLabel("박서준 (외부)").first()).toBeVisible();

  await page.getByRole("combobox", { name: "참여자 추가" }).click();
  const options = page.getByRole("option");
  const selectedAccount = options
    .filter({ hasText: "@" })
    .and(page.locator('[aria-selected="true"]'))
    .first();
  await selectedAccount.click();
  await page.keyboard.press("Escape");

  await expect(page.getByLabel("박서준 (외부)").first()).toBeVisible();
});

test("assigns a workspace member who is not yet a participant and checks them in", async ({
  page,
}) => {
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${DIARIZED_NOTE_ID}?view=side&tab=details`
  );

  const field = page.getByRole("combobox", { name: "참여자 추가" });
  const memberOption = () =>
    page.getByRole("option", { name: new RegExp(MEMBER_EMAIL) });

  await field.click();
  await expect(memberOption()).toHaveAttribute("aria-selected", "true");
  await memberOption().click();
  await expect(memberOption()).toHaveAttribute("aria-selected", "false");
  await page.keyboard.press("Escape");

  await page.getByRole("tab", { name: "스크립트" }).click();
  await page.getByLabel("화자 B 화자 지정").first().click();
  await expect(memberOption()).toHaveCount(0);
  await page.getByRole("combobox", { name: /참석자 검색/ }).fill(MEMBER_NAME);

  await memberOption().click();

  await expect(
    page.getByLabel(`${MEMBER_NAME} 화자 지정`).first()
  ).toBeVisible();

  await page.getByRole("tab", { name: "정보" }).click();
  await field.click();
  await expect(memberOption()).toHaveAttribute("aria-selected", "true");
});

test("offers an existing workspace guest instead of creating a duplicate name", async ({
  page,
}) => {
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${DIARIZED_NOTE_ID}?view=side&tab=transcript`
  );

  await page.getByLabel("화자 B 화자 지정").first().click();
  const search = page.getByRole("combobox", { name: /참석자 검색/ });

  await expect(page.getByRole("option", { name: /박서준/ })).toHaveCount(0);

  await search.fill("박서준");

  await expect(page.getByRole("button", { name: /"박서준" 추가/ })).toHaveCount(
    0
  );
  await page.getByRole("option", { name: /박서준/ }).click();

  await expect(page.getByLabel("박서준 화자 지정").first()).toBeVisible();

  await page.getByRole("tab", { name: "정보" }).click();
  await expect(page.getByLabel("박서준 (외부)").first()).toBeVisible();
});

test("creates a guest from the transcript and assigns the speaker in place", async ({
  page,
}) => {
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${DIARIZED_NOTE_ID}?view=side&tab=transcript`
  );

  await page.getByLabel("화자 B 화자 지정").first().click();

  const search = page.getByRole("combobox", { name: /참석자 검색/ });
  await search.fill("이도현");
  await page.getByRole("button", { name: /"이도현" 추가/ }).click();

  await expect(page.getByLabel("이도현 화자 지정").first()).toBeVisible();

  await page.getByRole("tab", { name: "정보" }).click();
  await expect(page.getByLabel("이도현 (외부)").first()).toBeVisible();
});

test("confirms a speaker as unnamed without clearing the human answer", async ({
  page,
}) => {
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${DIARIZED_NOTE_ID}?view=side&tab=transcript`
  );

  const trigger = page.getByLabel("화자 B 화자 지정").first();
  await expect(trigger.locator("[data-unassigned]")).toHaveCount(1);

  await trigger.click();
  await page.getByRole("button", { name: "이름 없이 두기" }).click();

  await expect(trigger).toBeVisible();
  await expect(trigger.locator("[data-unassigned]")).toHaveCount(0);
});

test("links a guest to an account and keeps the speaker assignment", async ({
  page,
}) => {
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${DIARIZED_NOTE_ID}?view=side&tab=transcript`
  );

  await page.getByLabel("화자 B 화자 지정").first().click();
  await page.getByRole("combobox", { name: /참석자 검색/ }).fill("최유진");
  await page.getByRole("button", { name: /"최유진" 추가/ }).click();
  await expect(page.getByLabel("최유진 화자 지정").first()).toBeVisible();

  await page.getByRole("button", { name: "목록으로" }).click();
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "워크스페이스 전환" }).click();
  await page.getByRole("menuitem", { name: "워크스페이스 설정" }).click();
  await page.getByRole("button", { name: "임시 참여자" }).click();

  const guestRow = page.getByRole("listitem").filter({ hasText: "최유진" });
  await expect(guestRow).toBeVisible();
  await guestRow.getByRole("button", { name: "최유진 관리" }).click();
  await page.getByRole("menuitem", { name: "계정과 연동" }).click();
  await page.getByRole("button", { name: /한지원/ }).click();

  await expect(page.getByText("되돌릴 수 없습니다.")).toBeVisible();
  await page.getByRole("button", { name: "연동", exact: true }).click();
  await page.getByRole("button", { name: "확인" }).click();

  await expect(
    page.getByRole("listitem").filter({ hasText: "최유진" })
  ).toHaveCount(0);
  await page.keyboard.press("Escape");

  await expect(page).not.toHaveURL(/[?&]settings=/);
  await page
    .getByRole("link", { name: "온보딩 이탈 구간 리뷰 노트 열기", exact: true })
    .click();
  await page.getByRole("tab", { name: "스크립트" }).click();

  await expect(page.getByLabel("한지원 화자 지정").first()).toBeVisible();
  await expect(page.getByLabel("최유진 화자 지정")).toHaveCount(0);
});

const TRANSCRIPT_URL = `/w/${MOCK_WORKSPACE_ID}/notes/${DIARIZED_NOTE_ID}?view=side&tab=transcript`;
const PLAIN_LINE = "가입 후 첫 회의를 만들기까지";
const OVERRIDDEN_LINE = "그럼 첫 화면에 회의 만들기를";

function transcriptLine(page: Page, text: string) {
  return page.locator('[data-testid="archive-transcript-block"]', {
    hasText: text,
  });
}

async function revealTranscriptLine(page: Page, text: string) {
  const input = page.getByRole("textbox", { name: "스크립트 검색어" });
  if (!(await input.count()))
    await page.getByRole("button", { name: "검색", exact: true }).click();
  await input.fill(text);
  await input.press("Enter");
  await expect(transcriptLine(page, text)).toBeInViewport();
}

test("assigns one person to two speakers without losing the first", async ({
  page,
}) => {
  await page.goto(TRANSCRIPT_URL);

  await expect(page.getByLabel("테스트 유저 화자 지정").first()).toBeVisible();

  await page.getByLabel("화자 B 화자 지정").first().click();
  await page.getByRole("option", { name: /테스트 유저/ }).click();

  await expect(page.getByLabel("화자 B 화자 지정")).toHaveCount(0);
  await expect(page.getByLabel("화자 A 화자 지정")).toHaveCount(0);
  await expect(
    transcriptLine(page, PLAIN_LINE).getByTestId("speaker-chip")
  ).toContainText("테스트 유저");
});

test("reassigns a single utterance without touching the rest of the speaker", async ({
  page,
}) => {
  await page.goto(TRANSCRIPT_URL);

  await expect(
    page.getByTestId("archive-transcript-block").first()
  ).toBeVisible();
  const plain = transcriptLine(page, PLAIN_LINE);
  const overridden = transcriptLine(page, OVERRIDDEN_LINE);

  await revealTranscriptLine(page, PLAIN_LINE);
  await expect(plain.getByTestId("speaker-chip")).toContainText("테스트 유저");
  await revealTranscriptLine(page, OVERRIDDEN_LINE);
  await expect(overridden.getByTestId("speaker-chip")).toContainText("한지원");

  await revealTranscriptLine(page, PLAIN_LINE);
  await plain.getByTestId("speaker-assign-trigger").click();
  await page.getByRole("radio", { name: "현재 발화에만 적용" }).check();
  await page.getByRole("option", { name: /한지원/ }).click();
  await revealTranscriptLine(page, PLAIN_LINE);
  await expect(plain.getByTestId("speaker-chip")).toContainText("한지원");

  await revealTranscriptLine(page, PLAIN_LINE);
  await plain.getByTestId("speaker-assign-trigger").click();
  await page.getByRole("radio", { name: "현재 발화에만 적용" }).check();
  await page.getByRole("button", { name: "개별 지정 해제" }).click();

  await revealTranscriptLine(page, PLAIN_LINE);
  await expect(plain.getByTestId("speaker-chip")).toContainText("테스트 유저");
  await revealTranscriptLine(page, OVERRIDDEN_LINE);
  await expect(overridden.getByTestId("speaker-chip")).toContainText("한지원");
});

test("warns before a label-wide assign wipes per-utterance fixes", async ({
  page,
}) => {
  await page.goto(TRANSCRIPT_URL);

  await expect(
    page.getByTestId("archive-transcript-block").first()
  ).toBeVisible();
  const plain = transcriptLine(page, PLAIN_LINE);
  const overridden = transcriptLine(page, OVERRIDDEN_LINE);
  await revealTranscriptLine(page, OVERRIDDEN_LINE);
  await expect(overridden.getByTestId("speaker-chip")).toContainText("한지원");

  await page.getByLabel("테스트 유저 화자 지정").first().click();
  await page.getByRole("option", { name: /한지원/ }).click();
  await expect(page.getByText(/개별로 지정한 발화가 1개/)).toBeVisible();

  await page.getByRole("button", { name: "취소" }).click();
  await revealTranscriptLine(page, PLAIN_LINE);
  await expect(plain.getByTestId("speaker-chip")).toContainText("테스트 유저");

  await page.getByLabel("테스트 유저 화자 지정").first().click();
  await page.getByRole("option", { name: /한지원/ }).click();
  await page.getByRole("button", { name: "모든 발화에 적용" }).click();

  await revealTranscriptLine(page, PLAIN_LINE);
  await expect(plain.getByTestId("speaker-chip")).toContainText("한지원");
  await revealTranscriptLine(page, OVERRIDDEN_LINE);
  await expect(overridden.getByTestId("speaker-chip")).toContainText("한지원");
  await expect(page.getByLabel("테스트 유저 화자 지정")).toHaveCount(0);
});

test("changes note display mode without remounting or refetching the transcript", async ({
  page,
}) => {
  let transcriptRequests = 0;
  let rscRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes(`/v1/notes/${STARTER_NOTE_ID}/transcript`))
      transcriptRequests += 1;
    if (request.url().includes("_rsc=")) rscRequests += 1;
  });
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${STARTER_NOTE_ID}?view=side&tab=transcript`
  );
  await expect(page.getByTestId("transcript-block").first()).toBeVisible();
  const original = await page
    .getByRole("log", { name: "회의 스크립트" })
    .elementHandle();
  const requestsBefore = transcriptRequests;
  const rscBefore = rscRequests;
  await page.getByRole("button", { name: "전체 화면으로 보기" }).click();
  await expect(page.locator('[data-surface="full"]')).toBeVisible();
  expect(await original!.evaluate((node) => node.isConnected)).toBe(true);
  await page.getByRole("button", { name: "사이드 뷰로 보기" }).click();
  await expect(page.locator('[data-surface="sheet"]')).toBeVisible();
  expect(await original!.evaluate((node) => node.isConnected)).toBe(true);
  expect(transcriptRequests).toBe(requestsBefore);
  expect(rscRequests).toBe(rscBefore);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(new RegExp(`/w/${MOCK_WORKSPACE_ID}$`));
});

test("keeps confirmation shading and cancellation in both note display modes", async ({
  page,
}) => {
  await createMeetingNote(page);
  await startRecording(page, "회의 시작");
  await stopRecording(page);
  for (const view of ["full", "side"] as const) {
    if (view === "side")
      await page.getByRole("button", { name: "사이드 뷰로 보기" }).click();
    await meetingControls(page)
      .getByRole("button", { name: "회의 종료" })
      .click();
    const dialog = page.getByRole("dialog", { name: "회의를 종료할까요?" });
    await expect(dialog).toBeVisible();
    await expect(page.locator('[data-slot="dialog-overlay"]')).toBeVisible();
    await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCSS(
      "opacity",
      "1"
    );
    await dialog.getByRole("button", { name: "취소" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.locator(`[data-surface="${view === "side" ? "sheet" : "full"}"]`)
    ).toBeVisible();
  }
});

test("keeps the speaker sheet shaded in both note display modes", async ({
  page,
}) => {
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${DIARIZED_NOTE_ID}?view=full&tab=transcript`
  );
  for (const view of ["full", "side"] as const) {
    if (view === "side")
      await page.getByRole("button", { name: "사이드 뷰로 보기" }).click();
    await page.getByRole("button", { name: "화자", exact: true }).click();
    const panel = page.getByRole("dialog", { name: "화자", exact: true });
    await expect(panel).toBeVisible();
    const backdrop = page.locator('[data-slot="sheet-overlay"]').last();
    await expect(backdrop).toBeVisible();
    await expect(backdrop).toHaveCSS("opacity", "1");
    await panel.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(panel).not.toBeVisible();
    await expect(
      page.locator(`[data-surface="${view === "full" ? "full" : "sheet"}"]`)
    ).toBeVisible();
  }
});

test("searches the full transcript locally without stealing input focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(TRANSCRIPT_URL);
  await expect(
    page.getByTestId("archive-transcript-block").first()
  ).toBeVisible();
  let requests = 0;
  page.on("request", (request) => {
    if (request.url().includes(`/v1/notes/${DIARIZED_NOTE_ID}/transcript`))
      requests++;
  });
  await page.getByRole("button", { name: "검색", exact: true }).click();
  const input = page.getByRole("textbox", { name: "스크립트 검색어" });
  await input.fill(OVERRIDDEN_LINE);
  await input.press("Enter");
  await expect(transcriptLine(page, OVERRIDDEN_LINE)).toBeInViewport();
  await expect(input).toBeFocused();
  await expect(
    page.getByRole("search", { name: "스크립트 검색" })
  ).toContainText("1/1");
  await input.press("Shift+Enter");
  await expect(input).toBeFocused();
  expect(
    await page
      .getByRole("search")
      .evaluate((e) => e.scrollWidth <= e.clientWidth)
  ).toBe(true);
  await input.fill("없는 발화 검색어 987654321");
  await expect(
    page.getByRole("button", { name: "다음 검색 결과" })
  ).toBeDisabled();
  await input.press("Escape");
  await expect(input).toBeHidden();
  await expect(
    page.getByRole("tab", { name: "스크립트", exact: true })
  ).toBeVisible();
  expect(requests).toBe(0);
});

test("녹음 컨트롤은 전체·사이드 보기와 좁은 화면에서 영역 안에 머뭅니다", async ({
  page,
}) => {
  await createMeetingNote(page);
  await startRecording(page, "회의 시작");
  const dock = page.getByRole("group", { name: "녹음 제어" });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const label of ["사이드 뷰로 보기", "전체 화면으로 보기"]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await expect(
        dock.getByRole("button", { name: "일시정지", exact: true })
      ).toBeVisible();
      await expect
        .poll(() =>
          dock.evaluate((node) => {
            const rect = node.getBoundingClientRect();
            const button = node
              .querySelector('button[aria-label="일시정지"]')!
              .getBoundingClientRect();
            return (
              rect.left >= 0 &&
              rect.right <= window.innerWidth &&
              button.left >= rect.left &&
              button.right <= rect.right &&
              node.scrollWidth <= node.clientWidth
            );
          })
        )
        .toBe(true);
      await expect(dock).toHaveCSS("transform", "none");
    }
  }
  await stopRecording(page);
});
