import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * MSW의 브라우저 서비스 워커 경로를 덮는 스모크. vitest는 jsdom이라 이 경로를 지나지 않는데
 * Vercel `dev` 배포가 정확히 여기로 돈다.
 *
 * 시각 회귀는 넣지 않는다 — 화면 구현 이슈마다 baseline을 갱신해야 해서 내내 시끄럽다.
 */

const MOCK_WORKSPACE_ID = "01K0000000000";

/**
 * 목 스트림을 배속으로 돌린다.
 *
 * 데모 속도는 사람이 보라고 느립니다 — 생각 한 문장이 0.7초, 도구 한 번이 1.6초입니다.
 * **여기서 재는 것은 순서와 결과이지 시간이 아니라서**, 그대로 두면 네 턴을 쌓는
 * 스크롤 테스트가 시간 때문에 죽습니다. 사람이 볼 때의 값은 `sse-handler.ts`에 있습니다.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    window.localStorage.setItem("mockChatSpeed", "40")
  );
});
const STARTER_NOTE_ID = "01K0000000002";
const FOREIGN_VIEWER_NOTE_ID = "01K0000000028";
/** 프로젝트가 하나도 없는 워크스페이스. 온보딩 경로의 유일한 표본이다(`lib/mocks/db.ts`). */
const EMPTY_WORKSPACE_ID = "01K0000000009";
/** 화자 분리가 끝난 유일한 종료 노트. 화자 지정을 밟을 수 있는 자리다(`lib/mocks/db.ts`). */
const DIARIZED_NOTE_ID = "01K0000000020";
/** 시드의 MEMBER. 이 회의의 참여자이기도 하다 — 아래 테스트가 뺐다가 다시 넣는다. */
const MEMBER_NAME = "한지원";

function meetingControls(page: Page) {
  return page.getByRole("group", { name: "회의 상태 및 제어" });
}

/**
 * 노트 헤더. 상태 칩·제목·메타 두 줄이 여기 있다 — design.pen `MZRO0`/`c5cQ8n`.
 * 회의 종료는 이 안의 `meetingControls`고, 창 제어는 위 상단바(`KktRX`)에 있다.
 */
/**
 * 노트 상단바(56). **상태 칩·제목 빵조각·탭·회의 종료가 여기 있다** — 크롬은 이 한 줄이
 * 전부다. 전사·요약에서 제목 블록을 걷어냈으므로 상태를 물을 곳은 여기뿐이다.
 */
function noteTopBar(page: Page) {
  return page
    .locator("div.h-14")
    .filter({ has: page.getByRole("group", { name: "창 제어" }) });
}

/** 제목 블록. **정보 탭의 머리글이라 다른 탭에는 없다.** */
function noteTitleBlock(page: Page) {
  return page.locator("header").filter({ has: page.getByRole("heading") });
}

/**
 * 누적 기록 시간은 **정보 탭**에 있다. 헤더는 정본대로 분 단위 요약만 그린다
 * (「기록 42분 (종료 세션 누적)」) — 초 단위로 바뀌는 값은 이 탭이 맡는다.
 */
async function cumulativeTimer(page: Page) {
  const tab = page.getByRole("tab", { name: "정보" });
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  return page.getByRole("timer", { name: "누적 기록 시간" });
}

function recordedSeconds(value: string | null) {
  const [minutes = "0", seconds = "0"] = (value ?? "0:0").split(":");
  return Number(minutes) * 60 + Number(seconds);
}

async function createMeetingNote(page: Page) {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "새 노트" }).click();
  // 생성과 시작을 가른다 — 이름을 먼저 묻고, 기록은 노트 안에서 시작한다(APP-337).
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
  await expect(dock.getByRole("button", { name: "중지" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    noteTopBar(page).getByText("기록 중", { exact: true })
  ).toBeVisible({ timeout: 20_000 });
}

async function stopRecording(page: Page) {
  await page
    .getByLabel("녹음 제어")
    .getByRole("button", { name: "중지" })
    .click();
  await expect(
    noteTopBar(page).getByText("중지됨", { exact: true })
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
    .getByRole("alertdialog")
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
    // 기본 탭은 정보다 — 전사를 보려면 명시한다.
    await page.goto(
      `/w/${MOCK_WORKSPACE_ID}/notes/${FOREIGN_VIEWER_NOTE_ID}?view=full&tab=transcript`
    );

    const blocks = page.getByTestId("transcript-block");
    await expect(blocks.first()).toContainText(
      "파트너 요구사항을 먼저 확인하겠습니다."
    );
    await expect(page.getByLabel("녹음 제어")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "회의 종료" })).toHaveCount(
      0
    );
    if (viewportSize.width === 375) {
      // 상태는 상단바가, 시작자는 **정보 탭 머리글의 메타 둘째 줄**이 말한다 — 전사는 읽는
      // 면이라 제목 블록을 걷었다.
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
      // 아래에서 전사 블록을 다시 세므로 읽던 탭으로 돌아간다.
      await page.getByRole("tab", { name: "전사" }).click();
      await expect(blocks.first()).toBeVisible();
    }
    expect(await blocks.count()).toBeGreaterThan(0);

    const transcriptViewport = page
      .locator('[data-slot="scroll-area"]')
      .filter({ has: page.getByRole("log", { name: "회의 전사" }) })
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
      // 모바일 폰트가 늦게 자리 잡으면 마지막 줄 높이만큼 다시 흐른다. 한 줄 이내면
      // 하단 추적이고, 추적이 끊긴 회귀는 수백 px가 남는다.
      .toBeLessThanOrEqual(32);
  } finally {
    page.off("request", countTranscriptRequest);
  }
}

test("boots with the MSW service worker registered", async ({ page }) => {
  await page.goto("/");

  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null)
    )
    .toBe(true);
});

test("renders the workspace surface from mock data", async ({ page }) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);

  await expect(page.getByText("테스트 유저의 워크스페이스")).toBeVisible();
});

test("renders the foreign viewer transcript without recording controls", async ({
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

  const transcriptLog = page.getByRole("log", { name: "회의 전사" });
  const transcriptViewport = page
    .locator('[data-slot="scroll-area"]')
    .filter({ has: transcriptLog })
    .locator('[data-slot="scroll-area-viewport"]');
  const dock = page.getByLabel("녹음 제어");
  const tray = page.getByTestId("note-agent-rail");

  await expect(page.getByTestId("transcript-block").first()).toBeVisible();
  await expect(dock).toBeVisible();
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
  const panel = surface.locator(":scope > div").first();
  const main = panel.locator(":scope > div").first();
  const transcriptLog = page.getByRole("log", { name: "회의 전사" });
  const transcriptViewport = page
    .locator('[data-slot="scroll-area"]')
    .filter({ has: transcriptLog })
    .locator('[data-slot="scroll-area-viewport"]');
  const dock = page.getByLabel("녹음 제어");
  const tray = page.getByTestId("note-agent-rail");

  await expect.soft(transcriptViewport).toBeVisible();
  await expect(dock).toBeVisible();
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

/**
 * 이 테스트가 이 파일의 핵심이다 — 신규 목이 jsdom이 아니라 **서비스 워커 경로에서도**
 * 응답하는지의 증거다. 여기가 깨지면 Vercel 데모에서 새 화면이 전부 빈 화면이 된다.
 */
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

    const stream = await fetch(
      `/v1/agent-chats/${created.data.chatId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: "요약해줘" }),
      }
    );

    const text = await stream.text();
    // 프레임에 `id:` 줄이 붙어 `event:`가 더는 첫 줄이 아니다.
    return text
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
          // **커서는 `id:` 줄에서만 온다.** `data:`는 payload 하나뿐이다.
          seq: idLine === undefined ? null : Number(idLine.slice("id:".length)),
          data: JSON.parse(
            lines
              .find((each) => each.startsWith("data:"))!
              .slice("data:".length)
          ) as Record<string, unknown>,
        };
      });
  });

  // 턴이 릴레이보다 먼저 열리므로 `turn_started`가 사실상 첫 프레임이다.
  expect(events[0].event).toBe("turn_started");
  expect(events.at(-1)!.event).toBe("message_end");
  // 커서가 서비스 워커 경로에서도 `id:` 줄로 온다 — 봉투가 아니라 여기서 나온다.
  expect(events.every((event) => typeof event.seq === "number")).toBe(true);
  expect(events.every((event) => !("payload" in event.data))).toBe(true);
});

/**
 * ★ **연결을 끊어도 턴은 살아 있다.** 서비스 워커 경로에서만 뜻이 있는 확인이다 —
 * vitest는 jsdom이라 여기를 한 번도 안 지난다.
 *
 * 여기서 못박는 것은 아래 계층이다 — **응답을 끊어도 턴이 계속 돌고 `GET /events?after=`가
 * 나머지를 준다.** 화면이 그걸 실제로 잇는지는 아래 「새로고침해도…」가 본다.
 */
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

    const stream = await fetch(`/v1/agent-chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ message: "요약해줘" }),
    });

    // 첫 프레임만 받고 끊는다 — 새로고침·탭 닫기가 하는 것과 같다.
    const reader = stream.body!.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    void reader.cancel();
    const cursor = Number(first.match(/^id: (\d+)/m)![1]);

    const rest = await fetch(
      `/v1/agent-chats/${chatId}/events?after=${cursor}`,
      { credentials: "include" }
    ).then((response) => response.text());

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

  expect(resumed.cursor).toBeGreaterThan(0);
  expect(resumed.events.at(-1)).toBe("message_end");
});

/**
 * ★★ **이 작업 전체의 인수 조건 — 돌아오면 이어받는다.**
 *
 * 패널 밖에서 턴을 시작하고 응답을 끊는다. 그러면 화면은 그 턴을 **모른 채** 열리고,
 * 이을 수 있는 근거는 `GET /messages`가 주는 `activeTurn`·`cursor`뿐이다. 그 뒤는
 * `GET /events?after=`가 서비스 워커 경로로 흐른다.
 *
 * **새로고침으로는 못 잰다.** MSW 목의 상태가 페이지 힙에 살아서 새 문서면 대화 자체가
 * 사라진다 — 다른 탭·다른 세션에서 시작된 턴으로 같은 경로를 밟는다.
 *
 * 승인 대기로 붙잡아 두는 것은 두 가지를 한 번에 재기 위해서다 — 이어받았는가, 그리고
 * **승인 카드가 다시 서는가**(`pendingApproval`). 그 카드가 재진입에서 안 서면 사용자는
 * 워치독 10분까지 스피너만 본다.
 */
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

    const stream = await fetch(
      `/v1/agent-chats/${created.data.chatId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: "Linear 이슈 만들어줘" }),
      }
    );
    // 첫 프레임만 받고 끊는다. 턴은 응답과 무관하게 계속 돈다.
    const reader = stream.body!.getReader();
    await reader.read();
    void reader.cancel();
  }, MOCK_WORKSPACE_ID);

  await page.getByRole("button", { name: "개인 챗봇 열기" }).click();

  const approve = page.getByRole("button", { name: "승인", exact: true });
  await expect(approve).toBeVisible({ timeout: 20_000 });
  await approve.click();

  // 이어받은 스트림이 그대로 끝까지 온다.
  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 30_000 }
  );
});

/**
 * ★ **중지가 턴을 멈춘다.** 끊기만 하면 서버에서는 계속 돌아 다음 전송이 409를 받는다.
 * 취소가 실제로 나갔는지는 「멈춘 뒤 다시 보낼 수 있는가」로 잰다.
 */
test("stops a running turn and lets the next message through", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);

  await page.getByRole("button", { name: "개인 챗봇 열기" }).click();
  await page.getByLabel("메시지").fill("요약해줘");
  await page.getByRole("button", { name: "보내기", exact: true }).click();

  const stop = page.getByRole("button", { name: "중지" });
  await expect(stop).toBeVisible({ timeout: 20_000 });
  await stop.click();

  // 턴이 굳었으니 컴포저가 다시 열린다. 안 굳었으면 잠금이 안 풀린다.
  await expect(
    page.getByRole("button", { name: "보내기", exact: true })
  ).toBeEnabled({ timeout: 20_000 });
});

/**
 * ★★ **I08 의 인수 조건 — 대화가 여럿 산다.**
 *
 * A를 승인 대기로 세워 둔다. 승인은 사람이 답할 때까지 살아 있어서(만료가 없다)
 * **시간에 안 매인 「도는 대화」**를 만드는 유일한 방법이다. 그 상태로
 *
 * 1. 「새 대화」가 A를 안 죽인다 — 목록에 한 줄이 늘 뿐이다
 * 2. B의 전송이 안 잠긴다 — A가 도는 것이 B를 막으면 대화는 여전히 하나다
 * 3. 목록 배지가 폴링으로 A의 승인 대기를 말한다 — 열려 있지 않은 대화의 유일한 소식이다
 * 4. A로 돌아가면 승인 카드가 다시 서고 답이 끝까지 온다 — A가 정말 살아 있었다
 *
 * 넷 중 하나라도 빠지면 「대화가 여럿 산다」가 화면에서 거짓이 된다.
 */
test("keeps a second chat alive while the first waits for approval", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "개인 챗봇 열기" }).click();

  const compose = async (text: string) => {
    await page.getByLabel("메시지").fill(text);
    await page.getByRole("button", { name: "보내기", exact: true }).click();
  };

  // A — 승인 카드에서 멈춰 선다. 1차 스트림은 여기서 정상 종료한다.
  await page.getByTestId("chat-list-new").click();
  await compose("Linear 이슈 만들어줘");
  await expect(
    page.getByRole("button", { name: "승인", exact: true })
  ).toBeVisible({
    timeout: 20_000,
  });

  // B — **A가 승인 대기인 채로** 연다. 여기가 잠기면 I08 이 아니다.
  const newChat = page.getByTestId("chat-list-new");
  await expect(newChat).toBeEnabled();
  await newChat.click();

  await expect(page.getByText("아직 시작된 대화가 없습니다.")).toBeVisible();
  await compose("요약해줘");
  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 20_000 }
  );

  // 목록이 둘을 말한다. 제목은 첫 USER 메시지가 채웠고, 열려 있지 않은 A의 배지는
  // 폴링이 유일한 출처다.
  await page.getByRole("button", { name: "기록" }).click();
  const history = page.getByTestId("chat-history-view");
  const waiting = history.getByRole("button", {
    name: /Linear 이슈 만들어줘/,
  });
  await expect(waiting).toContainText("승인 대기", { timeout: 20_000 });
  // 방금 끝난 B에는 배지가 없다 — 목록이 늦어도 열린 대화는 SSE 가 이긴다.
  const finished = history.getByRole("button", { name: /요약해줘/ });
  await expect(finished).toBeVisible({ timeout: 20_000 });
  await expect(finished).not.toContainText("진행 중");

  // A로 돌아간다. 서버의 턴이 살아 있었으므로 승인 카드가 다시 서고, 누르면 2차
  // 스트림이 나머지를 흘린다.
  await waiting.click();
  const approve = page.getByRole("button", { name: "승인", exact: true });
  await expect(approve).toBeVisible({ timeout: 20_000 });
  await approve.click();
  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 30_000 }
  );
});

/**
 * ★ **부드러운 이동이 멎은 뒤의 스크롤 위치.**
 *
 * 「질문이 위쪽 1/3 에 들어왔나」는 **애니메이션 중간에도 참**이 된다. 거기서 기준을 잡으면
 * 남은 거리(실측 32px)가 나중에 「답이 끝날 때의 튐」으로 계산돼, **느린 실행일수록
 * 빨개진다** — 답이 늦게 올수록 그 사이 이동이 멎어 남은 거리가 그대로 드러나기 때문이다.
 *
 * 허용치를 넓히면 [W-12] 를 붙드는 힘이 같이 풀린다. 넓히는 대신 **언제 재는지**를 고친다.
 */
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

/**
 * 뷰포트 안에서 요소가 위에서 몇 할쯤에 앉아 있나. `0`이 맨 위, `1`이 맨 아래다.
 *
 * ★ **못 잰 회차는 값이 아니라 「아직」이다.** 말풍선은 보내는 동안 `pendingUserMessage`가
 * 그리다가 턴이 반영되면 히스토리가 그린다 — 같은 커밋에서 같은 자리로 갈아끼우니 사람
 * 눈에는 안 보이지만, 그 사이에 재면 `boundingBox()`가 null 이다. `!`로 뚫으면 폴링이
 * **재시도 못 하고 그 자리에서 죽는다**(스위트를 통째로 돌릴 때 실제로 났다). 기준을 절대
 * 못 넘는 값을 돌려 다음 회차에 다시 재게 한다.
 */
function placedIn(viewport: Locator, target: Locator) {
  return async () => {
    const box = await target.boundingBox();
    const frame = await viewport.boundingBox();
    if (!box || !frame) return Number.POSITIVE_INFINITY;
    return (box.y - frame.y) / frame.height;
  };
}

/**
 * ★ **보낸 질문이 스크롤 맨 위로 간다.** 답이 그 아래 빈 화면에서 흐른다.
 *
 * 두 가지를 잰다. 보낸 직후 질문이 뷰포트 위쪽에 있는 것과, **답이 끝날 때 스크롤이 안
 * 튀는 것** — 질문 아래의 자리를 답이 끝나며 한 번에 걷으면 그만큼 화면이 올라온다([W-12]).
 */
test("pins the question to the top and does not jump when the answer lands", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "개인 챗봇 열기" }).click();

  // 시드된 대화를 그대로 쓴다 — 위에 옛 대화가 쌓여 있어야 「맨 위로 간다」가 뜻이 있다.
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

  // 질문이 뷰포트 위쪽 1/3 안에 있다. 예전에는 아래에 남고 답이 밑에서 자랐다.
  // **부드럽게 옮기므로 중간 프레임은 안 붙든다** — 멎은 자리만 본다.
  const placed = placedIn(viewport, asked);
  await expect.poll(placed, { timeout: 5_000 }).toBeLessThan(0.34);

  const scrollTop = () => viewport.evaluate((el) => el.scrollTop);
  const during = await settledScrollTop(viewport);

  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 20_000 }
  );

  // 답이 히스토리로 넘어가도 스크롤이 거의 그 자리다. 질문 아래 자리를 안 걷기 때문이다.
  // **몇 px 은 남는다**(실측 8px) — 흐르던 본문이 히스토리 본문으로 갈리며 줄바꿈이 한 칸
  // 달라지고, 과정 묶음이 접힌다. 자리를 걷었다면 여기서 수백 px 이 움직인다.
  expect(Math.abs((await scrollTop()) - during)).toBeLessThan(16);
  // 답이 히스토리로 넘어가는 순간이 곧 말풍선을 갈아끼우는 순간이라 여기서도 폴링한다.
  await expect.poll(placed, { timeout: 5_000 }).toBeLessThan(0.34);

  // ★ **위를 읽고 있었어도 보내면 옮긴다.** 「답을 따라 내려가기」와 다른 일이다 —
  // 보내기는 사용자가 지금 한 행동이라 「아까 위로 올렸었다」가 막을 이유가 안 된다.
  await viewport.evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.getByLabel("메시지").fill("위에서 보내도 올라가야 합니다");
  await page.getByRole("button", { name: "보내기", exact: true }).click();

  const second = page.getByText("위에서 보내도 올라가야 합니다");
  await expect(second).toBeVisible();
  // 부드럽게 옮기므로 중간 프레임은 안 붙든다 — 멎은 자리만 본다.
  await expect
    .poll(placedIn(viewport, second), { timeout: 5_000 })
    .toBeLessThan(0.34);
});

/**
 * ★ **좁은 패널에서 마크다운이 넘치지도, 표식을 잃지도 않는다.**
 *
 * 둘 다 **jsdom 으로 못 잰다** — 레이아웃도 CSS 도 없어서 넘쳤는지도, 불릿이 섰는지도
 * 알 방법이 없다. 그래서 둘 다 검사 없이 들어와 있었다. 클래스 이름을 짚는 검사는
 * 「무엇이 보이나」를 안 재므로 여기서 폭과 계산된 스타일을 직접 잰다.
 *
 * 목의 「마크다운」 시나리오가 표·긴 코드 줄·아주 긴 URL·중첩 체크박스를 한 답에 흘린다.
 * 한 답에 다 있어서 검사 하나가 두 자리를 같이 본다.
 */
test("draws the markdown answer inside the narrow chat column", async ({
  page,
}) => {
  await page.setViewportSize({ width: 380, height: 900 });
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "개인 챗봇 열기" }).click();

  await page.getByTestId("chat-list-new").click();
  await page.getByLabel("메시지").fill("마크다운으로 보여줘");
  await page.getByRole("button", { name: "보내기", exact: true }).click();

  const link = page.locator('.chat-md a[href*="analytics.example.com"]').last();
  await expect(link).toBeVisible({ timeout: 30_000 });

  const measured = await link.evaluate((el) => ({
    link: el.getBoundingClientRect().width,
    column: el.closest(".chat-md")!.getBoundingClientRect().width,
  }));
  // 실측: 안 막혀 있을 때 본문 열 398px 에 링크 541px 이었다.
  expect(measured.column).toBeGreaterThan(0);
  expect(measured.link).toBeLessThanOrEqual(measured.column + 1);

  /**
   * ★ **표식을 떼는 것은 체크박스 줄뿐이다.**
   *
   * gfm 이 체크박스 `li` 에 `<input>` 을 넣으므로 불릿까지 서면 표식이 둘이다. 한때
   * `li:has(input)` 으로 뗐는데 `:has()` 가 **자손**을 보는 탓에, 체크박스를 품은 위
   * 단계 `li` 의 불릿까지 같이 사라졌다. 목의 「설정 화면 개선」이 그 모양이다.
   *
   * 이것도 jsdom 으로는 못 잰다 — CSS 가 안 걸려서 `list-style-type` 이 늘 기본값이다.
   */
  const markers = await page.evaluate(() => {
    const items = [...document.querySelectorAll<HTMLElement>(".chat-md li")];
    // **우리가 쓰는 class 로 안 고른다** — 그러면 규칙과 검사가 같은 것을 보게 된다.
    // 체크박스를 자기 자식으로 든 줄인지로 고른다.
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
  // 체크박스를 든 줄은 전부 표식이 없다.
  expect(markers.tasks.length).toBeGreaterThan(0);
  expect([...new Set(markers.tasks)]).toEqual(["none"]);
  // 그것을 **품기만 한** 위 단계는 불릿을 그대로 갖는다.
  expect(markers.parentOwnsCheckbox).toBe(false);
  expect(markers.parent).toBe("disc");
});

/**
 * ★ **날짜가 바뀌는 대화에서, 여러 줄을 쓰고 보내도 질문이 뷰포트 위쪽에 선다.**
 *
 * 위 테스트는 「보내면 맨 위로」를 **한 줄짜리 초안**으로만 쟀다. 실제로 깨진 자리는 그
 * 바깥이었다 — 보내는 순간 `clear()` 가 컴포저를 한 줄로 접으면 스크롤 뷰포트가 그만큼
 * (실측 131px) 커지는데, 그 높이는 `ResizeObserver` 가 **한 렌더 늦게** 날라서 질문 아래
 * 자리가 낡은 높이로 잡힌다. 자리가 모자라니 바닥까지 내려도 질문이 위에 못 붙고, 늦게
 * 온 값이 자리를 늘려도 부드러운 이동의 700ms 창이 그 사이 따라가기를 건너뛰어 **아무도
 * 다시 안 옮긴다.** 그래서 창이 닫힌 뒤 토큰 하나에 한 프레임으로 131px 이 튀었다.
 *
 * **px 로 잰다.** 위쪽 자리는 뷰포트 크기가 아니라 구조가 정한다 — 구분선이 없으면 0,
 * 있으면 구분선(16)과 `gap-4`(16)로 32px 이다. 깨졌을 때의 188px 도 컴포저 높이 차이라
 * 뷰포트와 무관하다. 비율로 재면 이 셋이 다 뭉갠다.
 *
 * 시드된 「배포 일정 확인」은 마지막 메시지가 **어제**라 보내면 구분선이 새로 선다 —
 * 구분선이 끼어드는 쪽과 여러 줄 초안을 한 번에 지난다.
 */
test("keeps the question near the top when a divider joins a multi-line send", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "개인 챗봇 열기" }).click();
  await expect(page.getByTestId("assistant-message").first()).toBeVisible({
    timeout: 20_000,
  });

  await page.getByRole("button", { name: "기록" }).click();
  const history = page.getByTestId("chat-history-view");
  await expect(history).toBeVisible();
  await history.getByRole("button", { name: /배포 일정 확인/ }).click();

  const viewport = page
    .getByTestId("chat-thread-view")
    .locator('[data-slot="scroll-area-viewport"]');
  await expect(page.getByTestId("assistant-message").first()).toBeVisible({
    timeout: 20_000,
  });
  const dividers = page.getByTestId("thread-divider");
  await expect(dividers).toHaveCount(1);

  // 컴포저를 여러 줄로 부풀린다. 보내면 한 줄로 접히면서 뷰포트가 그만큼 커진다.
  const asked = "여러 줄로 써서 보내도 맨 위로 올라가야 합니다";
  await page
    .getByLabel("메시지")
    .fill(`${"자리를 재는 값이 낡지 않아야 합니다. ".repeat(8)}${asked}`);
  await page.getByRole("button", { name: "보내기", exact: true }).click();

  const question = page.getByText(asked);
  await expect(question).toBeVisible();
  // 날짜가 바뀌었으니 구분선이 하나 더 선다 — 그 줄이 질문 위에 끼어드는 쪽이다.
  await expect(dividers).toHaveCount(2);

  /**
   * **없으면 잰 값을 안 지어낸다.** 답이 히스토리로 넘어가는 순간 이 말풍선은 한 번
   * 갈아 끼워지고, 그 틈에 재면 상자가 없다. `NaN` 을 돌려주면 아래 `poll` 이 다음
   * 프레임에 다시 잰다 — 여기서 `null.y` 로 터지면 검사가 병렬 실행에서만 빨개진다.
   */
  const topOffset = async () => {
    const box = await question.boundingBox();
    const frame = await viewport.boundingBox();
    return box && frame ? box.y - frame.y : Number.NaN;
  };
  // 부드럽게 옮기므로 중간 프레임은 안 붙든다 — 멎은 자리만 본다.
  await expect.poll(topOffset, { timeout: 6_000 }).toBeLessThan(80);

  /**
   * ★ **뒤늦게 안 튄다.** 낡은 값이 늦게 도착해 자리를 늘리면 여기서 131px 이 움직였다.
   *
   * 튐은 **뷰포트의 `scrollTop`** 으로 잰다. 말풍선은 히스토리로 넘어가며 갈아 끼워져
   * 잠깐 사라지지만 뷰포트는 늘 거기 있다 — [W-12] 를 붙드는 위 검사가 같은 이유로
   * 같은 값을 쓴다. 질문이 여전히 위쪽인지는 갈아 끼우기가 끝난 뒤 한 번 더 본다.
   */
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

/**
 * ★★ **[W-12] 답이 끝나도 구분선이 안 늘어난다.**
 *
 * 구분선이 히스토리에서만 생기면 이렇게 된다 — 보낼 때는 없다가 답이 끝나 히스토리로
 * 넘어가는 순간 없던 줄이 끼어들어 읽던 자리가 밀린다. 보내는 순간부터 서 있어야 한다.
 *
 * **승인 대기를 앵커로 쓴다.** 승인은 사람이 답할 때까지 살아 있어서(만료가 없다) 「아직
 * 히스토리 전」인 상태를 **시간에 안 매인 채로** 붙들 수 있는 유일한 자리다. 「끝난 뒤 1개」만
 * 재면 보내는 중에 0개였어도 그냥 통과한다.
 *
 * 히스토리가 빈 새 대화에서 잰다 — 목의 시계가 고정(2026-07-11)이라 이미 쌓인 대화에서는
 * 「보낸 시각(지금)」과 서버가 적는 `createdAt` 이 44일 벌어진다. 첫 메시지는 앞이 없어
 * 어느 시계에서도 구분선이 하나다.
 */
test("does not add a thread divider when the answer lands", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "개인 챗봇 열기" }).click();

  const dividers = page.getByTestId("thread-divider");

  // 히스토리가 빈 새 대화에서 잰다 — 시드된 대화에는 이미 구분선이 서 있다.
  await page.getByTestId("chat-list-new").click();
  await page.getByLabel("메시지").fill("Linear 이슈 만들어줘");
  await page.getByRole("button", { name: "보내기", exact: true }).click();

  // 승인 카드에서 멈춰 선다 — 아직 히스토리로 안 넘어갔다.
  const approve = page.getByRole("button", { name: "승인", exact: true });
  await expect(approve).toBeVisible({ timeout: 20_000 });
  await expect(dividers).toHaveCount(1);

  await approve.click();
  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 30_000 }
  );

  // 히스토리로 넘어갔다. 한 줄도 안 늘었다.
  await expect(dividers).toHaveCount(1);
});

/**
 * ★ **＋ 는 서버에 행을 안 만든다.** 아무 말도 안 하고 나간 새 대화는 **존재한 적이 없어야**
 * 한다 — 누르는 즉시 만들면 기록에 빈 「새 대화」 줄이 쌓인다. 대화는 첫 전송이 만든다.
 */
test("does not create a chat row until the first message is sent", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "개인 챗봇 열기" }).click();

  // 하나는 실제로 쓴다 — 비교 대상이 있어야 「빈 줄이 안 생겼다」가 말이 된다.
  await page.getByTestId("chat-list-new").click();
  await page.getByLabel("메시지").fill("요약해줘");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 20_000 }
  );

  // ＋ 를 누르고 아무 말도 안 한 채 기록으로 간다.
  await page.getByTestId("chat-list-new").click();
  await expect(page.getByText("아직 시작된 대화가 없습니다.")).toBeVisible();
  await page.getByRole("button", { name: "기록" }).click();

  const history = page.getByTestId("chat-history-view");
  await expect(history.getByRole("button", { name: /요약해줘/ })).toBeVisible();
  // 빈 줄이 없다. 기본 제목이 「새 대화」라 만들어졌다면 여기 섰을 것이다.
  await expect(history.getByRole("button", { name: /새 대화/ })).toHaveCount(0);
});

/**
 * ★ **기록이 패널 안에서 스레드와 겹쳐 교대한다.** 뜨는 레이어였을 때는 패널 밖에 그려져
 * 좁은 폭에서 잘렸다. 지금은 스레드와 같은 자리를 나눠 쓰므로, 목록이 서 있는 동안
 * 스레드는 **가려질 뿐 살아 있어야** 한다 — 언마운트하면 흐르던 답이 통째로 사라진다.
 */
test("swaps the chat history in and back out inside the panel", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "개인 챗봇 열기" }).click();

  // A — 제목이 첫 질문으로 저절로 붙는다. 목록에서 고를 이름이 생긴다.
  await page.getByTestId("chat-list-new").click();
  await page.getByLabel("메시지").fill("요약해줘");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 20_000 }
  );

  // B — ＋ 로 하나 더. 헤더 첫 줄이 지금 보는 대화를 말한다.
  await page.getByTestId("chat-list-new").click();
  await expect(page.getByText("아직 시작된 대화가 없습니다.")).toBeVisible();

  const thread = page.getByTestId("chat-thread-view");
  const history = page.getByTestId("chat-history-view");
  await expect(history).toBeHidden();

  // ⟲ — 목록이 스레드 자리에 선다. 스레드는 가려질 뿐 DOM 에 남는다.
  await page.getByRole("button", { name: "기록" }).click();
  await expect(history).toBeVisible();
  await expect(thread).toBeHidden();
  await expect(history.getByRole("button", { name: "뒤로가기" })).toBeVisible();

  // 다른 대화를 고르면 곧바로 스레드로 돌아오고, 그 대화가 열려 있다.
  await history.getByRole("button", { name: /요약해줘/ }).click();
  await expect(thread).toBeVisible();
  await expect(history).toBeHidden();
  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 20_000 }
  );
});

/**
 * 개인 챗봇 한 턴을 화면에서 끝까지 굴린다. 위 테스트가 목의 스트림을 확인한다면 이건
 * `useChatStream`이 실제 브라우저에서 그 스트림을 읽어 그리는지의 증거다.
 */
test("streams a personal chat turn from the panel", async ({ page }) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);

  await page.getByRole("button", { name: "개인 챗봇 열기" }).click();
  // 목에 나이 든 대화가 시드돼 있다(날짜 묶음·구분선을 목에서 보려고). 빈 대화에서
  // 시작하는 검사는 ＋ 로 새 대화를 연다 — ＋ 는 서버를 안 부르므로 줄이 안 생긴다.
  await page.getByTestId("chat-list-new").click();
  await expect(page.getByText("아직 시작된 대화가 없습니다.")).toBeVisible();

  await page.getByLabel("메시지").fill("요약해줘");
  await page.getByRole("button", { name: "보내기" }).click();

  // MSW 응답은 시드 기반 풀에서 뽑혀 문장이 매번 다를 수 있다 — 어시스턴트 답변이 스트리밍돼
  // 실제 문장(모든 후보가 "습니다."로 끝남)으로 채워지는지만 확인한다.
  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 20_000 }
  );
});

/**
 * ★ **중지가 잠금을 풀어 다음 질문이 나간다.**
 *
 * 중지는 서버의 턴을 취소하고 화면의 잠금을 푼다. 그 둘 중 하나라도 어긋나면 —
 * 취소가 `activeTurn` 을 안 비우거나 `isBusy` 가 안 풀리면 — 컴포저는 보이는데 보내도
 * 아무 일이 안 난다. 오류도 로그도 없이 제자리를 돈다.
 *
 * **「다시 보내기」 버튼은 없다.** 그 버튼이 할 수 있던 일은 같은 문장을 한 글자도 못
 * 고치고 보내는 것 하나였다 — 중지한 질문은 이미 원하는 만큼 답을 받은 것이고, 다시
 * 묻고 싶으면 고쳐서 묻는다.
 */
test("unlocks the composer after a stop so the next question goes out", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "개인 챗봇 열기" }).click();

  await page.getByLabel("메시지").fill("Linear 이슈 만들어줘");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "승인", exact: true })
  ).toBeVisible({
    timeout: 20_000,
  });

  // 승인을 안 누른 채 접는다 — 만료가 없어진 지금 「중지」가 유일한 탈출구다.
  await page.getByRole("button", { name: "중지" }).click();
  await expect(page.getByRole("button", { name: "다시 보내기" })).toHaveCount(
    0
  );

  // 잠금이 풀렸다 — 다음 질문이 새 턴을 연다.
  const send = page.getByRole("button", { name: "보내기", exact: true });
  await expect(send).toBeEnabled({ timeout: 20_000 });
  await page.getByLabel("메시지").fill("Linear 이슈 만들어줘");
  await send.click();

  // 새 턴이므로 승인 카드가 다시 서고, 승인하면 답이 끝까지 온다.
  const approve = page.getByRole("button", { name: "승인", exact: true });
  await expect(approve).toBeVisible({ timeout: 20_000 });
  await approve.click();
  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 30_000 }
  );
});

/**
 * ★ **문장에 박은 칩이 말풍선에서도 칩으로 서고, 누르면 그 회의록으로 간다.**
 *
 * 제목만 나가던 시절에는 말풍선이 정규식으로 문장을 뒤져 칩을 다시 그렸고, 그렇게 그린
 * 칩에는 id 가 없어 **누를 수가 없었다.** 지금은 문장이 마커를 싣는다.
 *
 * **괄호가 든 제목으로 밟는다** — 이스케이프 규칙이 어긋나면 여기서만 깨진다.
 */
test("opens the note from a scope chip inside the sent bubble", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "개인 챗봇 열기" }).click();
  await page.getByTestId("chat-list-new").click();

  const editor = page.getByLabel("메시지");
  await editor.click();
  await editor.pressSequentially("@알림 정책");
  await page.getByRole("option", { name: "알림 정책 논의 (2차)" }).click();
  await editor.pressSequentially("액션 정리해줘");
  await page.getByRole("button", { name: "보내기", exact: true }).click();

  // 말풍선 안의 칩이다 — 문장 밖 태그 줄이 아니라 보낸 그 자리에 앉는다.
  const chip = page.getByRole("button", { name: "알림 정책 논의 (2차) 열기" });
  await expect(chip).toBeVisible({ timeout: 20_000 });
  await chip.click();

  await expect(page).toHaveURL(/\/notes\/01K0000000021\?view=side/);
});

/**
 * ★ **넓혔다는 사실이 화면에 남는다.**
 *
 * 범위는 담장이 아니라 먼저 볼 곳이라, 붙인 회의록에 답이 없으면 에이전트가 워크스페이스
 * 안에서 더 찾는다. **넓혔다고 묻는 카드가 없으므로** — 물을 시점에는 이미 넘어가 본
 * 뒤다 — 알리는 자리는 근거 줄 하나뿐이다. 거기 안 서면 사용자는 자기가 붙인 것만
 * 봤다고 믿는다.
 */
test("shows the out-of-scope note in the answer refs after widening", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "개인 챗봇 열기" }).click();

  await page.getByTestId("chat-list-new").click();
  await page.getByLabel("메시지").fill("범위 밖 얘기 있어?");
  await page.getByRole("button", { name: "보내기", exact: true }).click();

  // 답이 히스토리로 넘어간 뒤다 — 그 뒤에도 남아 있어야 알림이 된다.
  await expect(page.getByTestId("assistant-message").first()).toBeVisible({
    timeout: 20_000,
  });

  // 둘을 봤다 — 붙인 회의록 하나와 넓혀서 본 하나.
  await expect(page.getByText("참고한 회의록 2개")).toBeVisible({
    timeout: 20_000,
  });
});

/**
 * 회의 종료 → 분석 대기 흐름을 화면에서 굴린다. 시작자 조작(회의 종료)·확인 다이얼로그·
 * 종료 후 요약 탭이 분석 진행으로 넘어가는지 서비스 워커 경로로 확인한다.
 * `01K0000000002`는 시작자가 목 유저라 조작 버튼이 뜬다.
 */
test("shows a persistent explanation for a remotely active starter note", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}/notes/01K0000000002?view=full`);

  await expect(page.getByRole("button", { name: "회의 종료" })).toBeVisible();
  await expect(
    page.getByText("다른 탭·기기에서 기록 중입니다.", { exact: true })
  ).toBeVisible();
  await expect(
    page
      .getByLabel("녹음 제어")
      .getByRole("button", { name: /회의 시작|재개|중지/ })
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

test("starts and ends a meeting through one confirmation", async ({ page }) => {
  // 목이 조각마다 chunkSeq·captureSamples 헤더를 검사하고 어긋나면 경고를 남긴다.
  // 여기서 잡히는 것이 서버를 짜기 전에 잡히는 것이다.
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

  await endMeeting(page);

  expect(frameWarnings).toEqual([]);

  await expect(page.getByLabel("녹음 제어")).toHaveCount(0);
  await expect(page.getByText("회의를 정리하고 있습니다")).toBeVisible({
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

  // 종료는 요약 탭으로 넘긴다 — 누적 시간은 정보 탭이 들고 있으니 다시 열어서 읽는다.
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

  const secondStop = recordedSeconds(await timer.textContent());
  expect(secondStop).toBeGreaterThan(firstStop);
  await page.waitForTimeout(1_100);
  expect(recordedSeconds(await timer.textContent())).toBe(secondStop);
});

/**
 * 프로젝트가 없는 워크스페이스가 실제 온보딩 경로다 — 새로 만든 워크스페이스는 항상 이
 * 상태로 시작한다. 예전에는 상단바 「새 노트」가 비활성이었고 빈 상태가 그 버튼을 가리켰다.
 *
 * MSW 목이 아니라 서비스 워커를 지나는 경로에서 본다 — 프로젝트 생성 → 목록 재조회 →
 * 회의 생성이 이어지는 흐름이라 캐시 무효화 타이밍이 실제로 걸리는 자리다.
 */
test("walks a project-less workspace from project to first meeting", async ({
  page,
}) => {
  await page.goto(`/w/${EMPTY_WORKSPACE_ID}`);

  const onboarding = page.getByTestId("workspace-onboarding");
  await expect(onboarding).toHaveAttribute("data-stage", "no-project");
  // 셀 것이 없으니 제목도 개수도 없다.
  await expect(page.getByText(/개의 회의 기록/)).toHaveCount(0);

  // 「새 노트」는 비활성이 아니다 — 누르면 프로젝트를 먼저 묻는다.
  await page.getByRole("button", { name: "새 노트" }).click();
  await expect(
    page.getByRole("dialog", { name: "첫 프로젝트 만들기" })
  ).toBeVisible();
  await page.getByLabel("프로젝트 이름").fill("고객");
  await page.getByRole("button", { name: "만들기" }).click();

  // 절차가 끊기지 않는다 — 프로젝트를 만들면 회의 창이 바로 이어진다.
  await expect(page.getByLabel("회의 이름")).toBeVisible();
  await page.getByLabel("회의 이름").fill("첫 고객 인터뷰");
  await page.getByRole("button", { name: "만들기" }).click();

  await expect(page).toHaveURL(
    new RegExp(`/w/${EMPTY_WORKSPACE_ID}/notes/[^?]+\\?view=full`)
  );
  // 목록 행의 제목(h3)도 같은 이름이라 노트 헤더의 큰 제목(h1)으로 짚는다.
  await expect(
    page.getByRole("heading", { level: 1, name: "첫 고객 인터뷰" })
  ).toBeVisible();
});

test("shows the NOT_STARTED recorder dock in the side panel", async ({
  page,
}) => {
  const noteId = await createMeetingNote(page);
  await page.getByRole("button", { name: "목록으로" }).click();
  await page
    .getByRole("link", { name: "주간 제품 회의 노트 열기" })
    .first()
    .click();
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

test("ends a meeting from the side panel and opens the ended summary", async ({
  page,
}) => {
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${STARTER_NOTE_ID}?view=side&tab=transcript`
  );

  const noteSurface = page.getByLabel("노트", { exact: true });
  // 상태는 상단바가, 공개 범위는 정보 탭 머리글이 말한다.
  await expect(noteSurface.getByText("기록 중", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "정보" }).click();
  // 제목 블록으로 좁힌다 — 정보 탭의 「회의 정보」 표도 같은 문구를 공유 범위로 적는다.
  await expect(
    noteTitleBlock(page).getByText("워크스페이스 멤버에게 공개", {
      exact: true,
    })
  ).toBeVisible();
  await page.getByRole("tab", { name: "전사" }).click();
  // 회의 종료는 상단바에 있으니 어느 탭에서든 닿는다.
  await expect(page.getByRole("button", { name: "회의 종료" })).toBeVisible();
  await expect(
    page.getByText("다른 탭·기기에서 기록 중입니다.", { exact: true })
  ).toBeVisible();

  await page.getByRole("button", { name: "회의 종료" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "회의 종료" }).click();

  await expect(page.getByText("회의를 정리하고 있습니다")).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    noteTopBar(page).getByText("종료됨", { exact: true })
  ).toBeVisible();
  await expect(page.getByRole("tab")).toHaveText(["정보", "전사", "요약"]);
  await expect(page.getByRole("tab", { name: "챗봇" })).toHaveCount(0);
  await expect(page).toHaveURL(/view=side&tab=summary/);
});

test("ends a meeting and shows the analysis in progress", async ({ page }) => {
  // 기본 전사 탭에서 종료해도 요약 탭으로 넘어가 분석 진행을 보여야 한다.
  await page.goto(`/w/${MOCK_WORKSPACE_ID}/notes/01K0000000002?view=full`);

  await page.getByRole("button", { name: "회의 종료" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByText(/녹음 상태/)).toBeVisible();
  await dialog.getByRole("button", { name: "회의 종료" }).click();

  // 종료 → 분석 PENDING → 요약 탭이 분석 진행으로.
  await expect(page.getByText("회의를 정리하고 있습니다")).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    noteTopBar(page).getByText("종료됨", { exact: true })
  ).toBeVisible();
});

/**
 * 쓰기 도구 승인 한 흐름을 화면에서 굴린다 — 목은 "이슈"가 든 메시지에서 실제로 멈춰
 * 승인을 기다린다(sse-handler). 승인 카드 → 승인 → 승인·실행 기록까지 서비스 워커 경로로 확인.
 */
test("approves a write tool from the chat card", async ({ page }) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);

  await page.getByRole("button", { name: "개인 챗봇 열기" }).click();
  // 예시 질문은 빈 상태에만 있다 — 시드된 대화가 열리므로 ＋ 로 빈 대화를 연다.
  await page.getByTestId("chat-list-new").click();
  await page
    .getByRole("button", { name: "논의된 이슈를 Linear 이슈로 만들어줘" })
    .click();
  // 예시 질문은 **컴포저에 넣기만 한다.** 붙여 둔 칩이 그대로 딸려 나가는 것이 뜻밖이라
  // 보낼지는 사용자가 정한다(`personal-chat.tsx`). 그래서 여기서 한 번 더 누른다.
  await page.getByRole("button", { name: "보내기" }).click();

  // 승인 카드가 뜨고 만료가 없다는 문구가 있다.
  await expect(page.getByText(/답할 때까지 기다립니다/)).toBeVisible({
    timeout: 20_000,
  });

  // ★ **무엇을 승인하는지가 카드에 있다.** 인자는 `tool_call_start`가 나르고 승인 요청은
  // `toolCallId`로 그것을 이어받는데, 그 이음은 **서비스 워커를 지나는 실제 프레임**에서만
  // 밟힌다 — jsdom 은 그 경로를 안 지난다. 여기가 유일한 감지기다.
  const args = page.getByTestId("approval-args");
  await expect(args).toBeVisible();
  await expect(args).toContainText("title");
  await expect(args).toContainText("APP 버그 수정");

  await page.getByRole("button", { name: "승인", exact: true }).click();

  // **끝나면 과정은 접힌다** — 답변이 주인공이고 과정은 곁가지라서다. 다만 **줄이 하나뿐인
  // 묶음은 편 채로 둔다**: 머리글 한 줄로 본문 한 줄을 가리면 아끼는 자리가 없다.
  //
  // 그래서 여기서는 **접힌 것만 편다.** 개수로 갈리는 상태를 검사가 미리 알고 있으면, 목의
  // 프레임이 하나 늘고 주는 것만으로 빨개진다 — 그건 이 검사가 볼 일이 아니다.
  //
  // ★ **답이 끝난 뒤에 편다.** 재개가 도는 동안에는 묶음이 이미 펴져 있어 누를 것이 없는데,
  // 턴이 끝나면 그때 접힌다 — 먼저 누르면 「누른 적 없음」인 채로 접혀 버린다.
  await expect(page.getByTestId("assistant-message").last()).toContainText(
    "APP-12",
    { timeout: 20_000 }
  );
  const steps = page.getByRole("button", { name: /생각 과정/ });
  await expect(steps.first()).toBeVisible({ timeout: 20_000 });
  for (const each of await steps.all()) {
    if ((await each.getAttribute("aria-expanded")) === "false") await each.click();
  }

  // 승인 → 실행 기록(외부 링크 포함)이 남는다. **2차에는 `tool_call_start`가 없어서**
  // 합칠 시작 요약이 없다(계약) — 무엇을 하려던 것인지는 그 위의 승인 기록이 말한다.
  await expect(page.getByText("APP-12 생성됨")).toBeVisible();
  await expect(page.getByRole("link", { name: "열어 보기" })).toBeVisible();
});

/**
 * OAuth는 authorize가 외부로 리다이렉트하는 흐름이라 서비스 워커가 가로챌 수 없다.
 * 목에서는 `/mock-oauth`가 그 자리를 대신하므로, 왕복이 실제로 닫히는지 확인한다.
 */
test("completes the mocked OAuth round trip", async ({ page }) => {
  await page.goto(
    `/mock-oauth?workspaceId=${MOCK_WORKSPACE_ID}&provider=LINEAR`
  );
  await expect(
    page.getByRole("button", { name: "허용하고 돌아가기" })
  ).toBeVisible();

  await page.getByRole("button", { name: "허용하고 돌아가기" }).click();

  // 이동이 끝난 뒤 확인한다 — 이동 중에 평가하면 아직 워커가 붙지 않은 페이지에서 돈다.
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

/**
 * 스크롤 여백이 실제로 생기는지 본다.
 *
 * jsdom은 레이아웃을 계산하지 않아 단위 테스트로는 못 잡는다. `min-h-0`이 빠지면 flex 아이템의
 * 기본 `min-height: auto` 때문에 뷰포트가 콘텐츠만큼 커져 `scrollHeight === clientHeight`가
 * 되고, 스크롤과 자동 하단 이동이 함께 죽는다.
 */
test("keeps the personal chat scrollable when the thread grows", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "개인 챗봇 열기" }).click();

  const panel = page.getByTestId("personal-chat-panel");
  await expect(panel).toBeVisible();

  // 스크롤할 여백이 생길 만큼 대화를 쌓는다.
  for (let turn = 0; turn < 4; turn += 1) {
    await page.getByLabel("메시지").fill(`스크롤을 만드는 메시지 ${turn}`);
    await page.getByRole("button", { name: "보내기" }).click();
    await expect(page.getByTestId("assistant-message").nth(turn)).toContainText(
      "습니다",
      { timeout: 20_000 }
    );
  }

  // 패널 안에는 스크롤 영역이 둘이다 — 스레드와 기록. 재는 것은 스레드 쪽이다.
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

  // 새 출력은 하단으로 따라간다. 바닥까지의 거리가 1px 안이면 따라간 것으로 본다
  // (분수 픽셀 때문에 정확히 0이 아닐 수 있다).
  expect(
    grown.scrollHeight - grown.scrollTop - grown.clientHeight
  ).toBeLessThanOrEqual(1);

  // 위를 읽는 중에는 끌려 내려가지 않는다. 이 분기는 min-h-0 전에는 아예 돌지 못했다 —
  // scrollHeight === clientHeight라 언제나 '바닥'이었기 때문이다.
  //
  // ★ **올라가는 시점이 「보낸 뒤」다.** 보내기는 사용자가 지금 한 행동이라 그때는 무조건
  // 옮긴다 — 예전에는 여기서 먼저 올리고 보내며 「안 따라간다」를 쟀는데, 그 검사는 이제
  // 옛 동작을 붙들고 있는 것이다. 붙들어야 하는 것은 **답이 자라는 동안** 안 끌려가는 것이다.
  await page.getByLabel("메시지").fill("위를 읽는 중에 오는 메시지");
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.getByRole("button", { name: "중지" })).toBeVisible({
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

/**
 * 노트가 열린 상태에서 프로젝트를 고르면 목록으로 돌아가는지 본다.
 *
 * 노트 표면이 본문 컬럼을 덮어서(full은 항상, side는 모바일에서 inset-0) 필터만 바꾸면
 * 화면이 반응하지 않는 것처럼 보였다.
 */
/**
 * 전체 화면은 **사이드바까지 덮는다** (design.pen `XtEMZ`: 1420 = 1440 − 좌우 10, 사이드바
 * 없음). 그래서 목록으로 돌아가는 길은 사이드바가 아니라 노트 상단바의 ← 목록으로다 — 예전에는
 * 사이드바의 프로젝트를 눌러 나갔다.
 */
test("covers the sidebar in full view and leaves the note's own close as the way back", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}/notes/01K0000000002?view=full`);
  await expect(page).toHaveURL(/notes/);

  // 사이드바는 뒤에 남지만 `inert`라 포커스도 클릭도 안 들어간다. **좌표로 검사하지 않는다** —
  // `fixed` 면이 위에 떠도 뒤 요소의 좌표는 그대로라 `toBeInViewport`는 가림을 못 본다.
  await expect(page.locator('[data-slot="sidebar-container"]')).toHaveAttribute(
    "inert",
    /.*/
  );

  await page.getByRole("button", { name: "목록으로" }).click();
  await expect(page).toHaveURL(new RegExp(`/w/${MOCK_WORKSPACE_ID}$`));
});

/**
 * 진행자 아바타가 **참여자 명단에 없는 진행자**에게도 자기 이미지를 그리는지 본다.
 *
 * 예전 계약은 `meetingStartedBy`가 `userId`·`name`뿐이라 화면이 같은 userId를 participants에서
 * 찾아 이미지를 빌려 왔고, 회의 뒤 워크스페이스를 떠난 진행자는 빌릴 데가 없어 이름 첫 글자로
 * 떨어졌다. 계약이 email·image를 실으면서 그 우회가 사라졌다.
 *
 * **vitest로는 못 본다** — base-ui `Avatar.Image`는 브라우저가 로드를 알려야 `<img>`를 붙이는데
 * jsdom은 그 신호를 안 준다. 목 시드에서 이 조건을 만드는 노트는 「파트너 검토 회의」 하나다.
 */
test("draws the starter avatar image even when the starter is not a participant", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);

  const starter = page.getByLabel("진행자 김서연 (seoyeon@heymoa.com)");
  await expect(starter).toBeVisible();
  await expect(starter.locator("img")).toBeVisible();
  // 이니셜 fallback이 남아 있으면 이미지를 못 그린 것이다.
  await expect(starter).not.toHaveText("김");
});

/**
 * 셸 프레임이 design.pen 정본 기하와 맞는지 잰다 (뷰포트 1440×900).
 *
 * | 화면 | 정본 |
 * |---|---|
 * | 워크스페이스 | 사이드바 `232 · left 0` → 틈 `10` → 패널 `1188 × 880 · left 242 · top 10` |
 * | 노트 사이드 뷰 | 시트 `860 × 884 · left 572 · top 8` |
 * | 노트 전체 뷰 | 본문 패널 + 틈 `10` + 레일 `440` |
 *
 * **jsdom으로는 못 본다** — 레이아웃을 안 하므로 폭·틈이 전부 0이다. 클래스 문자열만 보는
 * 단위 테스트는 `p-2.5`가 실제로 10px 틈을 만드는지, 사이드바 테두리가 특이도에 져서 살아
 * 있는지를 구분하지 못한다(실제로 primitive에서 빼야 했다).
 */
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
  // 사이드바는 캔버스 위에 그냥 앉는다 — 선이 있으면 패널과 한 셸처럼 붙어 보인다.
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
  // 시트는 오른쪽에서 밀려 들어온다 — 애니메이션이 끝나기 전에 재면 x가 2px쯤 남는다.
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

  // 전체 화면은 **뷰포트를 통째로** 쓴다 — 사이드바도 워크스페이스 상단바도 덮는다.
  // 안에서 노트(왼쪽) + 에이전트 레일 440(오른쪽 고정)이 캔버스 10px로 갈린다.
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${FOREIGN_VIEWER_NOTE_ID}?view=full&tab=transcript`
  );
  const surface = page.locator('[data-surface="full"]');
  await expect(surface).toBeVisible();
  // 시트와 같은 이유로 기다린다 — 이 면은 오른쪽에서 `scale(0.98)`로 자라며 들어오고,
  // 그 사이에 재면 사방이 1px씩 안쪽으로 들어온 값이 나온다. 애니메이션 중에 잰 수치를
  // 정본으로 굳힌 적이 있다.
  await surface.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished))
  );
  const rail = page.getByTestId("note-agent-rail");
  await expect(rail).toBeVisible();

  const full = await page.evaluate(() => {
    const element = document.querySelector('[data-surface="full"]')!;
    const rect = element.getBoundingClientRect();
    // 440을 갖는 것은 레일 상자다.
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

  // 뷰포트 사방 10px 거터. 사이드바(232) 위를 덮으므로 x는 0에서 시작한다.
  expect(full.surface.x).toBe(0);
  expect(full.surface.y).toBe(0);
  expect(full.viewport.width - full.surface.right).toBe(0);
  expect(full.railWidth).toBe(440);
  expect(full.gap).toBe(10);
});

/**
 * 노트 full 면이 뷰포트를 남김없이 덮는지 본다.
 *
 * 셸 컨테이너가 뒤에 깔린 목록을 따라 늘어나면 문서가 스크롤되고, 그 위에 앉는 노트 면이
 * 컨테이너를 다 못 덮어 아래로 목록이 비쳤다(405px 실측 · APP-252). 목록이 화면보다 길어야
 * 재현되므로 목 시드 10개가 조건을 만든다. jsdom은 레이아웃을 안 해 e2e여야 한다.
 *
 * 이제 이 면은 셸 안이 아니라 **뷰포트에 `fixed`**라 바닥이 곧 화면 바닥이다 — 사이드바까지
 * 덮기 때문이다(design.pen `XtEMZ`). 막는 회귀는 같고 재는 대상만 달라졌다.
 */
test("covers the viewport with the full note surface", async ({ page }) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}/notes/01K0000000002?view=full`);

  await expect(page.locator('[data-surface="full"]')).toBeVisible();
  // 뒤 목록이 실제로 그려질 때까지 기다린다. skeleton은 6행이라 뷰포트를 안 넘어서, 로드 전에
  // 재면 수정을 되돌려도 통과한다 — 재현 조건 자체가 "목록이 화면보다 길다"이다.
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

  // 문서가 스크롤되면 그 자체가 셸이 뷰포트를 넘었다는 뜻이다.
  expect(geometry.documentScrollHeight).toBe(geometry.viewportHeight);
  // 면이 뷰포트를 남김없이 덮는다 — 어긋나면 그 틈으로 뒤 목록·사이드바가 비친다.
  expect(geometry.top).toBe(0);
  expect(geometry.left).toBe(0);
  expect(geometry.bottom).toBe(geometry.viewportHeight);
  expect(geometry.right).toBe(geometry.viewportWidth);
});

/**
 * 메뉴로 노트를 전체 화면으로 열고 닫으면 그 목록 행이 영원히 돌았다.
 *
 * 누른 위치를 기억만 하고 버리지 않아서, **그 위치로 돌아왔을 때 다시 같아져** 스피너가
 * 켜졌다. 노트를 닫는 것이 바로 그 위치로 돌아오는 동작이다. 이 경로는 Link의
 * `onNavigate`가 실제 라우터에서만 돌아 jsdom으로는 못 밟는다 — 그래서 e2e다. (APP-243)
 */
test("clears the note row spinner after the full-view note is closed", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);

  const row = page.locator("article", { hasText: "주간 제품 회의" }).first();
  await row.getByRole("button", { name: "주간 제품 회의 노트 메뉴" }).click();
  await page.getByRole("menuitem", { name: "전체 화면" }).click();
  await expect(page).toHaveURL(/view=full/);

  // 전체 화면이 사이드바를 덮으므로 되돌아가는 길은 노트 상단바의 ← 목록으로다.
  await page.getByRole("button", { name: "목록으로" }).click();
  await expect(page).toHaveURL(new RegExp(`/w/${MOCK_WORKSPACE_ID}$`));

  await expect(row.locator(".animate-spin")).toHaveCount(0);
});

/**
 * 노트 탭은 라우터를 안 탄다.
 *
 * `router.replace`로 URL을 쓰던 동안, `page.tsx`가 `searchParams`를 읽는 async Server
 * Component라 Next가 탭 클릭을 진짜 내비게이션으로 취급했다 — 누를 때마다 `_rsc=` 왕복이
 * 돌고 그게 끝나야 탭이 움직였다(prod·localhost 실측 100~140ms, 실서버는 RTT만큼 더).
 * `window.history.replaceState`는 그 왕복 없이 `useSearchParams`를 갱신한다.
 *
 * 왕복이 있는지 없는지는 실제 라우터에서만 드러난다 — jsdom에는 RSC 요청 자체가 없다.
 */
test("switches note tabs without an RSC round trip", async ({ page }) => {
  const rscRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("_rsc=")) rscRequests.push(request.url());
  });

  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${STARTER_NOTE_ID}?view=side&tab=details`
  );
  await expect(page.getByRole("tab", { name: "정보" })).toHaveAttribute(
    "aria-selected",
    "true"
  );

  // 진입 자체의 prefetch·내비게이션은 정당하다. 세는 것은 **탭을 누른 뒤**의 요청뿐이다.
  rscRequests.length = 0;

  await page.getByRole("tab", { name: "전사" }).click();
  await expect(page.getByRole("tab", { name: "전사" })).toHaveAttribute(
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

/**
 * ★ **흐를 때와 끝난 뒤가 같은 모양이다.**
 *
 * 생각은 이제 계약이 저장한다(`THINKING` 행). 새로고침 한 번에 방금 읽은 문장이
 * 사라지면 「과정을 보여준다」가 반쪽이 된다 — 스트림에만 있고 히스토리에는 없는
 * 상태가 그것이다. vitest 는 jsdom 이라 서비스 워커 경로를 안 지난다.
 */
/**
 * ★ **흐를 때와 끝난 뒤가 같은 모양이다.**
 *
 * 생각은 이제 계약이 저장한다(`THINKING` 행). 그 자리가 히스토리에 없으면 새로고침
 * 한 번에 방금 읽은 문장이 사라져 「과정을 보여준다」가 반쪽이 된다.
 *
 * **스트림을 한 번도 안 여는 것이 요점이다.** 새 문서로 들어가 옛 대화를 그냥 열면
 * 화면이 가진 것은 `GET …/messages` 하나뿐이고, 레일이 서면 그 응답만으로 섰다는 뜻이다.
 * (목 DB 는 문서마다 다시 시드되므로 방금 보낸 턴을 새로고침 너머로 못 끌고 간다 —
 * 대신 생각이 든 시드 대화로 같은 것을 본다.)
 */
test("draws the thinking rail from history alone", async ({ page }) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "개인 챗봇 열기" }).click();
  await page.getByRole("button", { name: "기록" }).click();

  const history = page.getByTestId("chat-history-view");
  await history.getByRole("button", { name: /생각이 남은 대화/ }).click();

  const thread = page.getByTestId("chat-thread-view");
  await expect(thread).toBeVisible();
  await expect(thread.getByTestId("assistant-message").last()).toBeVisible({
    timeout: 20_000,
  });

  // 과정 레일이 답변과 함께 서 있다. **확정 전 승인은 안 그린다** — 헤더가 화면에
  // 실제로 그려진 줄 수와 같아야 한다.
  const rail = thread.getByText(/생각 과정/).last();
  await expect(rail).toBeVisible();
  await expect(rail).toContainText("생각 과정");

  // 흐르는 중이 아니다 — 스트림을 한 번도 안 열었다.
  await expect(page.getByRole("button", { name: "중지" })).toBeHidden();
});

/**
 * 계정 없는 참여자를 만들고 고르는 왕복 (APP-490 · 493).
 *
 * **vitest로는 못 본다.** 후보 목록은 워크스페이스 임시 참여자 조회와 멤버 조회를 합쳐
 * 세우고, 만들기는 서비스 워커를 지나 목 DB를 바꾼 뒤 두 조회를 다시 읽는다 — jsdom은
 * 그 경로를 지나지 않아 훅을 목으로 갈아끼워야 하고, 그러면 정작 왕복이 검증되지 않는다.
 */
test("creates a guest participant from the attendee field and keeps members untouched", async ({
  page,
}) => {
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${STARTER_NOTE_ID}?view=side&tab=details`
  );

  // 시드에 임시 참여자가 하나 있다 — 계정 없는 사람이 계정 참여자와 나란히 선다.
  const existingGuest = page.getByLabel("박서준 (외부)");
  await expect(existingGuest.first()).toBeVisible();

  await page.getByRole("combobox", { name: "참여자 선택" }).click();
  const search = page.getByRole("combobox", { name: /참여자 검색/ });

  // 정확히 같은 이름이면 추가가 안 뜬다 — 실수로 동명이인을 만드는 것을 막는다.
  await search.fill("박서준");
  await expect(page.getByRole("button", { name: /"박서준" 추가/ })).toHaveCount(
    0
  );

  await search.fill("이도현");
  await page.getByRole("button", { name: /"이도현" 추가/ }).click();

  // 만든 사람이 곧바로 아바타에 나타난다.
  await expect(page.getByLabel("이도현 (외부)").first()).toBeVisible();
});

/**
 * **멤버를 빼도 임시 참여자가 남는다.** 이 이슈의 핵심 완료 기준이고, 저장 요청을 계정과
 * 임시 둘로 가른 이유다 — 한 요청에 섞어 보내면 멤버 하나를 바꿀 때마다 임시 참여자가
 * 함께 지워지고 그 화자 연결이 CASCADE 로 날아간다.
 */
test("keeps guest participants when an account member is removed", async ({
  page,
}) => {
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${STARTER_NOTE_ID}?view=side&tab=details`
  );
  await expect(page.getByLabel("박서준 (외부)").first()).toBeVisible();

  await page.getByRole("combobox", { name: "참여자 선택" }).click();
  const options = page.getByRole("option");
  // 계정 참여자 하나를 뺀다. 이름이 아니라 선택 상태로 고른다 — 시드 순서에 안 묶인다.
  const selectedAccount = options
    .filter({ hasText: "@" })
    .and(page.locator('[aria-selected="true"]'))
    .first();
  await selectedAccount.click();
  await page.keyboard.press("Escape");

  // 저장이 돌아온 뒤에도 임시 참여자는 그대로다.
  await expect(page.getByLabel("박서준 (외부)").first()).toBeVisible();
});

/**
 * 화자 후보가 **이 회의의 참여자를 넘어** 워크스페이스 멤버 전원이다. 참여자로 안 찍힌
 * 사람을 화자로 못 고르면, 회의록을 정리하는 사람이 먼저 정보 화면에 가서 체크하고
 * 돌아와야 한다. 고르면 **서버가 같은 요청 안에서 참여자로 넣는다.**
 *
 * **vitest로는 못 본다** — 두 화면(정보·전사)과 두 요청(참여자 교체·화자 지정)을 가로지르고,
 * 「참여자가 다시 체크된다」는 결과가 서버가 만든 참여 기록을 화면이 다시 읽어야 나온다.
 */
test("assigns a workspace member who is not yet a participant and checks them in", async ({
  page,
}) => {
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${DIARIZED_NOTE_ID}?view=side&tab=details`
  );

  // 시드는 멤버 전원이 이미 참여자다. 한 명을 빼서 「멤버인데 참여자는 아닌」 상태를 만든다.
  const field = page.getByRole("combobox", { name: "참여자 선택" });
  const memberOption = () =>
    page.getByRole("option", { name: new RegExp(MEMBER_NAME) });

  await field.click();
  await expect(memberOption()).toHaveAttribute("aria-selected", "true");
  await memberOption().click();
  await expect(memberOption()).toHaveAttribute("aria-selected", "false");
  await page.keyboard.press("Escape");

  // 전사에서 그 사람을 화자로 고른다 — 참여자가 아닌데도 후보에 있어야 한다.
  await page.getByRole("tab", { name: "전사" }).click();
  await page.getByLabel("화자 B 화자 지정").first().click();
  await memberOption().click();

  await expect(page.getByLabel(`${MEMBER_NAME} 화자 지정`).first()).toBeVisible();

  // **정보 화면에서도 참여자로 다시 체크돼 있다.** 서버가 지정과 함께 넣은 것이다.
  await page.getByRole("tab", { name: "정보" }).click();
  await field.click();
  await expect(memberOption()).toHaveAttribute("aria-selected", "true");
});

/**
 * **같은 이름이 하나 더 만들어지던 자리다.**
 *
 * 박서준은 워크스페이스의 임시 참여자인데 이 회의의 참여자는 아니다. 전사 드롭다운의 후보가
 * 이 회의 사람뿐이라 「＋ "박서준" 추가」가 떴고, 누르면 **같은 이름의 임시 참여자가 하나 더**
 * 생겼다. 정보 화면에서는 후보에 있어서 안 그랬다 — 두 화면이 서로 다르게 굴었다.
 *
 * **vitest로는 못 본다** — 후보를 합치는 곳(note-archive)과 ＋를 감추는 곳(메뉴)이 다른
 * 컴포넌트이고, 목 서버의 임시 참여자 목록까지 세 조각이 이어져야 드러난다.
 */
test("offers an existing workspace guest instead of creating a duplicate name", async ({
  page,
}) => {
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${DIARIZED_NOTE_ID}?view=side&tab=transcript`
  );

  await page.getByLabel("화자 B 화자 지정").first().click();
  const search = page.getByRole("combobox", { name: /참석자 검색/ });

  // 이 회의 사람이 아니라 검색 전에는 안 보인다 — 회의와 무관한 이름으로 목록이 안 불어난다.
  await expect(page.getByRole("option", { name: /박서준/ })).toHaveCount(0);

  await search.fill("박서준");

  // **＋ 추가가 아니라 그 사람이 뜬다.**
  await expect(page.getByRole("button", { name: /"박서준" 추가/ })).toHaveCount(0);
  await page.getByRole("option", { name: /박서준/ }).click();

  await expect(page.getByLabel("박서준 화자 지정").first()).toBeVisible();

  // 고르면 이 회의의 참여자가 된다. 임시 참여자는 여전히 하나뿐이다.
  await page.getByRole("tab", { name: "정보" }).click();
  await expect(page.getByLabel("박서준 (외부)").first()).toBeVisible();
});

/**
 * 읽던 자리에서 이름을 만들어 화자에 붙인다 (APP-494).
 *
 * **vitest로는 못 본다** — 만들기 응답에서 새 참여 기록을 집어 곧바로 화자 지정을 부르는
 * 두 요청의 왕복이고, 그 사이를 서비스 워커가 지난다. 훅을 목으로 갈아끼우면 정작 그
 * 이어짐이 검증되지 않는다.
 */
test("creates a guest from the transcript and assigns the speaker in place", async ({
  page,
}) => {
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${DIARIZED_NOTE_ID}?view=side&tab=transcript`
  );

  // 아직 아무도 안 붙은 화자를 연다. 같은 화자가 전사 여러 줄에 서므로 첫 칩을 쓴다.
  await page.getByLabel("화자 B 화자 지정").first().click();

  const search = page.getByRole("combobox", { name: /참석자 검색/ });
  await search.fill("이도현");
  await page.getByRole("button", { name: /"이도현" 추가/ }).click();

  // 만든 사람이 그 화자에 붙어 칩이 이름으로 바뀐다.
  await expect(page.getByLabel("이도현 화자 지정").first()).toBeVisible();

  // **참석자 목록에도 곧바로 나타난다** — 만든 사람은 이 회의의 참여자이기도 하다.
  await page.getByRole("tab", { name: "정보" }).click();
  await expect(page.getByLabel("이도현 (외부)").first()).toBeVisible();
});

/**
 * 「이름 안 붙임」은 사람이 확정한 답이라 미결정과 다른 값이다. 문구만 바뀌고 저장하는
 * 값은 그대로 `null`이다.
 */
test("confirms a speaker as unnamed without clearing the human answer", async ({
  page,
}) => {
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${DIARIZED_NOTE_ID}?view=side&tab=transcript`
  );

  const trigger = page.getByLabel("화자 B 화자 지정").first();
  // 아직 아무도 안 본 화자에는 점이 붙어 있다.
  await expect(trigger.locator("[data-unassigned]")).toHaveCount(1);

  await trigger.click();
  await page.getByRole("button", { name: "이름 안 붙임" }).click();

  // 이름은 여전히 `화자 B`다 — 그 사람이 누구인지 우리가 모른다는 것이 사실이다.
  await expect(trigger).toBeVisible();
  // 사람이 답했으므로 점이 사라진다. 미결정과 갈리는 유일한 신호다.
  await expect(trigger.locator("[data-unassigned]")).toHaveCount(0);
});

/**
 * **이 프로젝트가 존재하는 이유를 한 번에 밟는다** (PRO-41).
 *
 * 계정 없는 사람을 만들어 화자에 붙이고 → 계정과 이으면 → 그 회의록이 전부 그 계정으로
 * 이어지는데 **화자 연결은 하나도 안 풀린다.** 참여 기록의 식별자를 유지하기로 한 판단이
 * 값을 하는 자리가 여기다 — 지우고 새로 만들었으면 CASCADE 로 전부 날아갔다.
 */
test("links a guest to an account and keeps the speaker assignment", async ({
  page,
}) => {
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${DIARIZED_NOTE_ID}?view=side&tab=transcript`
  );

  // ① 읽던 자리에서 이름을 만들어 화자 B 에 붙인다.
  await page.getByLabel("화자 B 화자 지정").first().click();
  await page
    .getByRole("combobox", { name: /참석자 검색/ })
    .fill("최유진");
  await page.getByRole("button", { name: /"최유진" 추가/ }).click();
  await expect(page.getByLabel("최유진 화자 지정").first()).toBeVisible();

  // ② 설정 › 멤버에서 그 사람을 계정과 잇는다.
  //
  // **문서를 다시 로드하지 않는다.** 목 DB 가 페이지 모듈 상태라 새로고침하면 방금 만든
  // 임시 참여자가 사라진다 — 노트를 닫고 사이드바로 가는 클라이언트 이동만 한다.
  await page.getByRole("button", { name: "목록으로" }).click();
  await page.getByRole("button", { name: "워크스페이스 전환" }).click();
  await page.getByRole("menuitem", { name: "워크스페이스 설정" }).click();
  await page.getByRole("button", { name: "멤버" }).click();

  const guestRow = page.getByRole("listitem").filter({ hasText: "최유진" });
  await expect(guestRow).toBeVisible();
  await guestRow.getByRole("button", { name: "연동" }).click();
  await page.getByRole("button", { name: /한지원/ }).click();

  // ③ 되돌릴 수 없다는 사실이 실행 전에 보인다.
  await expect(page.getByText("되돌릴 수 없습니다.")).toBeVisible();
  await page.getByRole("button", { name: "연동", exact: true }).click();
  await page.getByRole("button", { name: "확인" }).click();

  // ④ 연동한 사람은 임시 참여자 목록에서 사라진다.
  await expect(
    page.getByRole("listitem").filter({ hasText: "최유진" })
  ).toHaveCount(0);
  await page.keyboard.press("Escape");

  // ⑤ 그 회의록을 다시 연다. **여기서도 새로고침하지 않는다** — 목록에서 클라이언트 이동이다.
  await page
    .locator("article", { hasText: "온보딩 이탈 구간 리뷰" })
    .first()
    .click();
  await page.getByRole("tab", { name: "전사" }).click();

  // **화자 연결이 안 풀렸다.** 화자 B 가 이제 그 계정 이름으로 선다.
  await expect(page.getByLabel("한지원 화자 지정").first()).toBeVisible();
  await expect(page.getByLabel("최유진 화자 지정")).toHaveCount(0);
});

/**
 * 화자 A 는 시드가 「테스트 유저」로 지정해 둔다. 화자 B 는 아직 아무도 아니고, 화자 A 의
 * 발화 중 한 줄(`01K0000000063`)만 「한지원」으로 개별 지정돼 있다.
 */
const TRANSCRIPT_URL = `/w/${MOCK_WORKSPACE_ID}/notes/${DIARIZED_NOTE_ID}?view=side&tab=transcript`;
/** 화자 A 의 발화 둘. 앞 줄은 라벨을 따르고, 뒤 줄에만 개별 지정이 걸려 있다. */
const PLAIN_LINE = "가입 후 첫 회의를 만들기까지";
const OVERRIDDEN_LINE = "그럼 첫 화면에 회의 만들기를";

function transcriptLine(page: Page, text: string) {
  return page.locator('[data-testid="archive-transcript-block"]', {
    hasText: text,
  });
}

/**
 * **이 기능이 존재하는 이유** — pyannote 가 3명 회의를 4명으로 쪼개면 「화자 1과 2는 같은
 * 사람」이 사람이 할 수 있는 유일한 정정인데, 예전에는 두 번째를 붙이는 순간 첫 번째가
 * 비어 고칠수록 나빠졌다.
 */
test("assigns one person to two speakers without losing the first", async ({
  page,
}) => {
  await page.goto(TRANSCRIPT_URL);

  await expect(page.getByLabel("테스트 유저 화자 지정").first()).toBeVisible();

  // 화자 A 에 이미 붙어 있는 사람을 화자 B 에도 붙인다.
  await page.getByLabel("화자 B 화자 지정").first().click();
  await page.getByRole("option", { name: /테스트 유저/ }).click();

  // **앞 화자가 그대로 남는다.** 예전에는 여기서 화자 A 가 이름을 잃었다.
  await expect(page.getByLabel("화자 B 화자 지정")).toHaveCount(0);
  await expect(page.getByLabel("화자 A 화자 지정")).toHaveCount(0);
  await expect(
    transcriptLine(page, PLAIN_LINE).getByTestId("speaker-chip")
  ).toContainText("테스트 유저");
});

/** 라벨은 맞는데 그 줄 하나만 남의 말로 붙은 경우. */
test("reassigns a single utterance without touching the rest of the speaker", async ({
  page,
}) => {
  await page.goto(TRANSCRIPT_URL);

  const plain = transcriptLine(page, PLAIN_LINE);
  const overridden = transcriptLine(page, OVERRIDDEN_LINE);

  // 같은 화자 A 인데 이름이 다르다 — 뒤 줄에만 개별 지정이 걸려 있다.
  await expect(plain.getByTestId("speaker-chip")).toContainText("테스트 유저");
  await expect(overridden.getByTestId("speaker-chip")).toContainText("한지원");

  // 앞 줄만 한지원으로 옮긴다.
  await plain.getByTestId("speaker-assign-trigger").click();
  await page.getByRole("radio", { name: "현재 발화에만 적용" }).check();
  await page.getByRole("option", { name: /한지원/ }).click();
  await expect(plain.getByTestId("speaker-chip")).toContainText("한지원");

  // 되돌린다 — **그 줄만** 다시 라벨을 따르고 뒤 줄은 그대로다.
  await plain.getByTestId("speaker-assign-trigger").click();
  await page.getByRole("radio", { name: "현재 발화에만 적용" }).check();
  await page.getByRole("button", { name: "개별 지정 해제" }).click();

  await expect(plain.getByTestId("speaker-chip")).toContainText("테스트 유저");
  await expect(overridden.getByTestId("speaker-chip")).toContainText("한지원");
});

/**
 * **말없이 사라지면 「분명 고쳤는데」가 된다.** 「모든 발화에 적용」은 그 화자의 개별
 * 지정을 지우므로, 누르기 전에 몇 건인지 말하고 취소할 길을 준다.
 */
test("warns before a label-wide assign wipes per-utterance fixes", async ({
  page,
}) => {
  await page.goto(TRANSCRIPT_URL);

  const plain = transcriptLine(page, PLAIN_LINE);
  const overridden = transcriptLine(page, OVERRIDDEN_LINE);
  await expect(overridden.getByTestId("speaker-chip")).toContainText("한지원");

  // 화자 A 전체를 한지원으로 옮긴다 — 그 화자에 개별 지정이 하나 남아 있다.
  await page.getByLabel("테스트 유저 화자 지정").first().click();
  await page.getByRole("option", { name: /한지원/ }).click();
  await expect(page.getByText(/개별로 지정한 발화가 1개/)).toBeVisible();

  // 취소하면 아무것도 안 바뀐다.
  await page.getByRole("button", { name: "취소" }).click();
  await expect(plain.getByTestId("speaker-chip")).toContainText("테스트 유저");

  // 확인하면 그 화자의 모든 줄이 같은 사람이 된다.
  await page.getByLabel("테스트 유저 화자 지정").first().click();
  await page.getByRole("option", { name: /한지원/ }).click();
  await page.getByRole("button", { name: "모든 발화에 적용" }).click();

  await expect(plain.getByTestId("speaker-chip")).toContainText("한지원");
  await expect(overridden.getByTestId("speaker-chip")).toContainText("한지원");
  await expect(page.getByLabel("테스트 유저 화자 지정")).toHaveCount(0);
});
