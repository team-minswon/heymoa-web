import { expect, test, type Page } from "@playwright/test";

/**
 * MSW의 브라우저 서비스 워커 경로를 덮는 스모크. vitest는 jsdom이라 이 경로를 지나지 않는데
 * Vercel `dev` 배포가 정확히 여기로 돈다.
 *
 * 시각 회귀는 넣지 않는다 — 화면 구현 이슈마다 baseline을 갱신해야 해서 내내 시끄럽다.
 */

const MOCK_WORKSPACE_ID = "01K0000000000";
const STARTER_NOTE_ID = "01K0000000002";
const FOREIGN_VIEWER_NOTE_ID = "01K0000000028";
/** 프로젝트가 하나도 없는 워크스페이스. 온보딩 경로의 유일한 표본이다(`lib/mocks/db.ts`). */
const EMPTY_WORKSPACE_ID = "01K0000000009";

function meetingControls(page: Page) {
  return page.getByRole("group", { name: "회의 상태 및 제어" });
}

/**
 * 노트 헤더. 상태 칩·제목·메타 두 줄이 여기 있다 — design.pen `MZRO0`/`c5cQ8n`.
 * 회의 종료는 이 안의 `meetingControls`고, 창 제어는 위 상단바(`KktRX`)에 있다.
 */
function noteHeader(page: Page) {
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
    noteHeader(page).getByText("시작 전", { exact: true })
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
    noteHeader(page).getByText("기록 중", { exact: true })
  ).toBeVisible({ timeout: 20_000 });
}

async function stopRecording(page: Page) {
  await page
    .getByLabel("녹음 제어")
    .getByRole("button", { name: "중지" })
    .click();
  await expect(
    noteHeader(page).getByText("중지됨", { exact: true })
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
    noteHeader(page).getByText("종료됨", { exact: true })
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
      // 상태·진행자는 이제 **노트 헤더**가 그린다 — 전체 화면이 워크스페이스 상단바를 덮으면서
      // 그 바의 노트 액션 슬롯이 사라졌다.
      const header = noteHeader(page);
      const status = header.getByText("기록 중", { exact: true });
      // 시작자 이름은 참관자에게만, 메타 둘째 줄에서 말한다.
      const starterName = header.getByText("김서연님이 기록 중", {
        exact: false,
      });
      await expect(status).toBeVisible();
      await expect(starterName).toBeVisible();
      const starterBox = await starterName.boundingBox();
      expect(starterBox).not.toBeNull();
      expect(starterBox!.x).toBeGreaterThanOrEqual(0);
      expect(starterBox!.x + starterBox!.width).toBeLessThanOrEqual(
        viewportSize.width
      );
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
  const tray = page.getByTestId("shared-chat-panel");

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
  const tray = page.getByTestId("shared-chat-panel");

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
    const created = await fetch("/v1/agent-chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        scope: "workspace",
        workspaceId: "01K0000000000",
      }),
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
    return text
      .split("\n\n")
      .filter((block) => block.startsWith("event:"))
      .map((block) => block.split("\n")[0].slice("event:".length).trim());
  });

  expect(events[0]).toBe("message_start");
  expect(events.at(-1)).toBe("message_end");
});

/**
 * 개인 챗봇 한 턴을 화면에서 끝까지 굴린다. 위 테스트가 목의 스트림을 확인한다면 이건
 * `useChatStream`이 실제 브라우저에서 그 스트림을 읽어 그리는지의 증거다.
 */
test("streams a personal chat turn from the panel", async ({ page }) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);

  await page.getByRole("button", { name: "개인 챗봇 열기" }).click();
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
  await createMeetingNote(page);
  await startRecording(page, "회의 시작");
  expect(
    recordedSeconds(await (await cumulativeTimer(page)).textContent())
  ).toBeLessThan(60);

  await endMeeting(page);

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
  // 걸러 볼 것이 없으니 필터도 개수도 없다.
  await expect(page.getByRole("group", { name: "노트 필터" })).toHaveCount(0);

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
    noteHeader(page).getByText("시작 전", { exact: true })
  ).toBeVisible();
});

test("shows meeting context and shared chat inside the viewer side panel", async ({
  page,
}) => {
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${FOREIGN_VIEWER_NOTE_ID}?view=side&tab=transcript`
  );

  const noteSurface = page.getByLabel("노트", { exact: true });
  await expect(noteSurface.getByText("기록 중", { exact: true })).toBeVisible();
  await expect(
    noteSurface.getByText("김서연님이 기록 중 · 워크스페이스 멤버에게 공개")
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "회의 종료" })).toHaveCount(0);
  await expect(page.getByLabel("녹음 제어")).toHaveCount(0);
  await expect(page.getByRole("tab")).toHaveText(["정보", "전사", "챗봇"]);

  await page.getByRole("tab", { name: "챗봇" }).click();

  const panel = page.getByRole("complementary", { name: "회의 챗봇" });
  await expect(panel.getByLabel("메시지")).toBeVisible();
  await expect(page).toHaveURL(/view=side&tab=chat/);
});

test("ends a meeting from the side panel and opens the ended summary", async ({
  page,
}) => {
  await page.goto(
    `/w/${MOCK_WORKSPACE_ID}/notes/${STARTER_NOTE_ID}?view=side&tab=transcript`
  );

  const noteSurface = page.getByLabel("노트", { exact: true });
  await expect(noteSurface.getByText("기록 중", { exact: true })).toBeVisible();
  await expect(
    noteSurface.getByText("워크스페이스 멤버에게 공개", { exact: true })
  ).toBeVisible();
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
    noteHeader(page).getByText("종료됨", { exact: true })
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
    noteHeader(page).getByText("종료됨", { exact: true })
  ).toBeVisible();
});

/**
 * 쓰기 도구 승인 한 흐름을 화면에서 굴린다 — 목은 "이슈"가 든 메시지에서 실제로 멈춰
 * 승인을 기다린다(sse-handler). 승인 카드 → 승인 → 승인·실행 기록까지 서비스 워커 경로로 확인.
 */
test("approves a write tool from the chat card", async ({ page }) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);

  await page.getByRole("button", { name: "개인 챗봇 열기" }).click();
  await page
    .getByRole("button", { name: "논의된 이슈를 Linear 이슈로 만들어줘" })
    .click();

  // 승인 카드가 뜨고 300초 상한 문구가 있다.
  await expect(page.getByText(/5분 뒤 자동으로 거절/)).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "승인" }).click();

  // 승인 → 실행 기록(외부 링크 포함)이 남는다.
  await expect(page.getByText("APP-12 생성됨")).toBeVisible({
    timeout: 20_000,
  });
});

/**
 * 노트 full 모드 우측의 공유 챗봇 한 턴을 화면에서 굴린다. 개인 챗봇과 같은 SSE 레이어를
 * 쓰지만 진입점(노트 스코프)과 게이트(회의 ACTIVE)가 달라 별도 증거가 필요하다.
 * `01K0000000002`는 목 기본 시드에서 IN_PROGRESS + 시작자 있음(=ACTIVE)이다.
 */
test("streams a shared chat turn inside a note", async ({ page }) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}/notes/01K0000000002?view=full`);

  const panel = page.getByRole("complementary", { name: "회의 챗봇" });
  await panel.getByLabel("메시지").fill("이번 회의에서 정한 것만 정리해줘");
  await panel.getByRole("button", { name: "보내기" }).click();

  // 공유 챗봇도 같은 SSE·풀을 쓴다 — 어시스턴트 답변이 실제 문장으로 채워지는지 확인.
  await expect(panel.getByTestId("assistant-message").last()).toContainText(
    "습니다",
    { timeout: 20_000 }
  );
});

/**
 * 관전자(다른 멤버가 입력 중)는 스트림을 받지 않고 `lock`을 폴링해서만 안다. 목에 남의
 * 잠금을 심고, 폴링이 그것을 잡아 컴포저를 잠그는지 확인한다. 폴링은 문서가 보일 때만 도는데
 * (TanStack 기본) Playwright 탭은 visible이라 도는 게 정상이다.
 */
test("locks the composer when another member is typing", async ({ page }) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}/notes/01K0000000002?view=full`);

  const panel = page.getByRole("complementary", { name: "회의 챗봇" });
  await panel.getByLabel("메시지").waitFor();

  // 로드 뒤에 심는다 — 새로고침은 목 상태를 초기화하므로 폴링이 잡아야 한다.
  await page.evaluate(() =>
    fetch("/v1/notes/01K0000000002/_mock/foreign-lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ lockedBy: "김민수" }),
    })
  );

  await expect(page.getByText(/김민수님이 입력 중/).first()).toBeVisible({
    timeout: 35_000,
  });
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

  const viewport = panel.locator('[data-slot="scroll-area-viewport"]');
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
  await viewport.evaluate((el) => {
    el.scrollTop = 0;
    el.dispatchEvent(new Event("scroll"));
  });

  await page.getByLabel("메시지").fill("위를 읽는 중에 오는 메시지");
  await page.getByRole("button", { name: "보내기" }).click();
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
  await expect(
    page.locator('[data-slot="sidebar-container"]')
  ).toHaveAttribute("inert", /.*/);

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
      return { x: Math.round(rect.x), width: Math.round(rect.width), right: Math.round(rect.right), y: Math.round(rect.y), bottom: Math.round(rect.bottom) };
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
    .poll(() => sheetLocator.evaluate((el) => Math.round(el.getBoundingClientRect().x)))
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
  const rail = page.getByTestId("shared-chat-panel");
  await expect(rail).toBeVisible();

  const full = await page.evaluate(() => {
    const element = document.querySelector('[data-surface="full"]')!;
    const rect = element.getBoundingClientRect();
    // 레일에 「이 회의 / 내 에이전트」 탭이 생기면서 공유 패널은 두 겹 안으로 들어갔다.
    // 440을 실제로 갖는 것은 레일 상자다.
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
