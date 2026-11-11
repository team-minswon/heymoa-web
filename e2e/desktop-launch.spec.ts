import { expect, test } from "@playwright/test";

for (const locale of ["ko-KR", "en-US"]) {
  test(`설치 앱은 ${locale} 랜딩에서 소속 워크스페이스로 바로 진입합니다`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("heymoa:last-workspace", "not-a-member");
      Object.assign(window, {
        meetingListWorkspace: "",
        heymoaDesktop: {
          getCapabilities: async () => ({}),
          meetingTimelineVersion: 2,
          reportActiveMeetings: async () => {},
          reportMeetingList: async (snapshot: {
            workspaceId: string | null;
            status: string;
            meetings: unknown[];
          }) => {
            if (snapshot.status === "ready" && snapshot.meetings.length > 0)
              Object.assign(window, {
                meetingListWorkspace: snapshot.workspaceId,
              });
          },
        },
      });
    });
    await page.context().setExtraHTTPHeaders({ "Accept-Language": locale });
    await page.goto(locale === "en-US" ? "/en" : "/");
    await expect(page).toHaveURL(/\/w\/01K0000000000$/);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { meetingListWorkspace: string })
              .meetingListWorkspace
        )
      )
      .toBe("01K0000000000");
  });
}

for (const result of ["empty", "failed"]) {
  test(`설치 앱의 소속 조회가 ${result}이면 랜딩을 유지하고 목록 상태를 전달합니다`, async ({
    page,
  }) => {
    await page.addInitScript((result) => {
      Object.assign(window, {
        meetingListStatus: "",
        heymoaDesktop: {
          getCapabilities: async () => ({}),
          reportActiveMeetings: async () => {},
          reportMeetingList: async ({ status }: { status: string }) => {
            Object.assign(window, { meetingListStatus: status });
          },
        },
      });
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = new URL(
          input instanceof Request ? input.url : String(input),
          location.href
        );
        if (url.pathname === "/v1/workspaces")
          return result === "empty"
            ? Response.json({ success: true, data: { workspaces: [] } })
            : Response.json(
                {
                  success: false,
                  error: { code: "BAD_REQUEST", message: "조회 실패" },
                },
                { status: 400 }
              );
        return originalFetch(input, init);
      };
    }, result);
    await page.goto("/");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { meetingListStatus: string })
              .meetingListStatus
        )
      )
      .toBe(result === "empty" ? "no-workspace" : "failed");
    await expect(page).toHaveURL("/");
  });
}
