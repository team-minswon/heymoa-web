import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  NotificationSettings,
  NotificationSettingsSkeleton,
} from "@/components/settings/notification-settings";
import { intlWrapper } from "@/components/help/test-intl";
import { DataBoundary } from "@/components/ui/data-boundary";
import { onTrack } from "@/lib/analytics/track";
import {
  resetMarketingConsentMock,
  resetNotificationSettingsMock,
  restHandlers,
} from "@/lib/mocks/rest-handlers";

/** 실제 계약 경로를 지난다 — 확인 창에서 취소하면 요청이 안 나갔는지를 요청 기록으로 본다. */
const server = setupServer(...restHandlers);
const writes: string[] = [];
server.events.on("request:start", async ({ request }) => {
  if (request.method === "GET") return;
  const { pathname } = new URL(request.url);
  const body = await request.clone().text();
  writes.push(`${request.method} ${pathname}${body ? ` ${body}` : ""}`);
});

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  cleanup();
  resetNotificationSettingsMock();
  resetMarketingConsentMock();
  server.resetHandlers();
  writes.length = 0;
});
afterAll(() => server.close());

function renderSettings() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Intl = intlWrapper();
  return render(
    <Intl>
      <QueryClientProvider client={client}>
        <DataBoundary
          fallback={<NotificationSettingsSkeleton />}
          errorLabel="알림 설정을 불러오지 못했습니다"
        >
          <NotificationSettings workspaceId="W1" />
        </DataBoundary>
      </QueryClientProvider>
    </Intl>
  );
}

const switchOf = (name: string) => screen.getByRole("switch", { name });

describe("NotificationSettings", () => {
  it("검토할 결과 준비는 일시정지된 회의 다음, 문의 답변은 마지막에 이름과 함께 서고, 이름을 모르는 종류는 숨긴다", async () => {
    const channels = [
      { channel: "WEB", provided: true, enabled: true, effective: true },
      { channel: "EMAIL", provided: false, enabled: false, effective: false },
    ];
    server.use(
      http.get("*/v1/notification-settings", () =>
        HttpResponse.json({
          success: true,
          data: {
            marketingEmail: { agreed: false, changedAt: null },
            muteAll: false,
            muteEmail: false,
            // 서버 순서는 시안과 다르다 — 화면이 순서를 맞춘다.
            items: [
              { type: "INQUIRY_ANSWERED", required: false, channels },
              { type: "ANALYSIS_READY", required: false, channels },
              { type: "SOMETHING_NEW", required: false, channels },
              { type: "MEETING_PAUSED_REMINDER", required: false, channels },
            ],
          },
          error: null,
        })
      )
    );
    renderSettings();
    const rows = await screen.findAllByRole("rowheader");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent(/^일시정지된 회의/);
    expect(rows[1]).toHaveTextContent(
      "검토할 결과 준비회의 분석이 끝나 결과를 검토할 수 있을 때"
    );
    expect(rows[2]).toHaveTextContent(
      "문의 답변보낸 문의에 HeyMoa 팀이 답했을 때"
    );
  });

  it("선택 알림만 줄로 그리고 필수 알림은 안내 없이 뺀다", async () => {
    renderSettings();
    expect(await screen.findByText("일시정지된 회의")).toBeInTheDocument();
    expect(screen.queryByText("워크스페이스 초대")).toBeNull();
    // 필수 알림 안내 문장은 두지 않는다(APP-1348).
    expect(screen.queryByText(/필수 알림/)).toBeNull();
    // 보내지 않는 채널은 「—」이고 이유를 읽힌다
    expect(
      screen.getByLabelText("이 알림은 인앱으로 보내지 않습니다")
    ).toHaveTextContent("—");
    // 기본값은 서버가 정한다 — 일시정지된 회의 메일은 켜짐
    expect(switchOf("일시정지된 회의 메일")).toBeChecked();
    // 일시정지된 회의 이름 옆 ? 도움말이 언제 무엇이 오는지 읽힌다(APP-1348).
    expect(
      screen.getByRole("button", { name: "도움말: 일시정지된 회의 알림 안내" })
    ).toHaveAccessibleDescription(
      "회의를 일시정지한 채 두면 1영업일 뒤 메일로 알려 드립니다.3영업일이 지나면 회의를 자동으로 종료하고 분석을 시작한 뒤, 안내 메일을 한 번 더 보냅니다."
    );
    // 메일 받는 주소 카드는 걷었다(APP-1348).
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("스위치를 바꾸면 서버에 보내고 돌아온 설정으로 그린 뒤 사건을 보낸다", async () => {
    const heard: Array<[string, unknown]> = [];
    const stop = onTrack((event, properties) =>
      heard.push([event, properties])
    );
    renderSettings();
    fireEvent.click(
      await screen.findByRole("switch", { name: "일시정지된 회의 메일" })
    );
    await waitFor(() =>
      expect(switchOf("일시정지된 회의 메일")).not.toBeChecked()
    );
    stop();
    expect(writes).toEqual([
      'PUT /v1/notification-settings/items {"type":"MEETING_PAUSED_REMINDER","channel":"EMAIL","enabled":false}',
    ]);
    expect(heard).toEqual([
      [
        "notification_setting_changed",
        {
          workspace_id: "W1",
          scope: "type",
          type: "MEETING_PAUSED_REMINDER",
          channel: "EMAIL",
          enabled: false,
        },
      ],
    ]);
  });

  it("스위치는 누르는 즉시 바뀌고, 서버가 실패하면 누르기 전 값으로 돌아온다", async () => {
    let release: () => void = () => {};
    server.use(
      http.put(
        "*/v1/notification-settings/items",
        () =>
          new Promise<Response>((resolve) => {
            release = () =>
              resolve(
                HttpResponse.json(
                  {
                    success: false,
                    data: null,
                    error: { code: "X", message: "x" },
                  },
                  { status: 500 }
                )
              );
          })
      )
    );
    renderSettings();
    fireEvent.click(
      await screen.findByRole("switch", { name: "일시정지된 회의 메일" })
    );
    // 응답 전인데 이미 꺼져 있다.
    await waitFor(() =>
      expect(switchOf("일시정지된 회의 메일")).not.toBeChecked()
    );
    expect(switchOf("일시정지된 회의 메일")).toBeEnabled();
    release();
    await waitFor(() => expect(switchOf("일시정지된 회의 메일")).toBeChecked());
  });

  it("연타하면 응답 순서가 뒤집혀도 마지막으로 누른 값이 남는다", async () => {
    let stored = true;
    let calls = 0;
    server.use(
      http.get("*/v1/notification-settings", () =>
        HttpResponse.json({
          success: true,
          data: {
            marketingEmail: { agreed: false, changedAt: null },
            muteAll: false,
            muteEmail: false,
            items: [
              {
                type: "MEETING_PAUSED_REMINDER",
                required: false,
                channels: [
                  {
                    channel: "WEB",
                    provided: false,
                    enabled: false,
                    effective: false,
                  },
                  {
                    channel: "EMAIL",
                    provided: true,
                    enabled: stored,
                    effective: stored,
                  },
                ],
              },
            ],
          },
          error: null,
        })
      ),
      http.put("*/v1/notification-settings/items", async ({ request }) => {
        const { enabled } = (await request.json()) as { enabled: boolean };
        stored = enabled;
        calls += 1;
        // 첫 요청의 응답이 가장 늦게 온다.
        await new Promise((resolve) =>
          setTimeout(resolve, calls === 1 ? 120 : 10)
        );
        return HttpResponse.json({ success: true, data: null, error: null });
      })
    );
    renderSettings();
    const toggle = await screen.findByRole("switch", {
      name: "일시정지된 회의 메일",
    });
    fireEvent.click(toggle); // 끔
    await waitFor(() =>
      expect(switchOf("일시정지된 회의 메일")).not.toBeChecked()
    );
    fireEvent.click(switchOf("일시정지된 회의 메일")); // 켬
    await waitFor(() => expect(switchOf("일시정지된 회의 메일")).toBeChecked());
    fireEvent.click(switchOf("일시정지된 회의 메일")); // 끔
    await waitFor(() => expect(calls).toBe(3));
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(switchOf("일시정지된 회의 메일")).not.toBeChecked();
    expect(stored).toBe(false);
  });

  it.each([
    ["인앱 알림 모두 끄기", "인앱 알림을 모두 끌까요?"],
    ["메일 모두 끄기", "메일을 모두 끌까요?"],
  ])(
    "%s 는 확인 창에서 취소하면 아무것도 바꾸지 않는다",
    async (label, title) => {
      renderSettings();
      fireEvent.click(await screen.findByRole("switch", { name: label }));
      const dialog = await screen.findByRole("alertdialog", { name: title });
      expect(
        within(dialog).getByText(/다시 켜면 이전 설정이 그대로 돌아옵니다/)
      ).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      expect(switchOf(label)).not.toBeChecked();
      expect(writes).toEqual([]);
    }
  );

  it("인앱 알림 모두 끄기는 인앱 열만 꺼짐으로 가리고 메일 열은 그대로 두며, 풀면 확인 없이 이전 선택이 돌아온다", async () => {
    renderSettings();
    fireEvent.click(
      await screen.findByRole("switch", { name: "인앱 알림 모두 끄기" })
    );
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "끄기",
      })
    );
    await waitFor(() => expect(switchOf("인앱 알림 모두 끄기")).toBeChecked());
    // 인앱 열(검토할 결과 준비)만 가려지고, 메일 열(일시정지된 회의)은 그대로 켜져 있고 누를 수 있다.
    expect(
      screen.getByLabelText("검토할 결과 준비 인앱 꺼짐")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("switch", { name: "검토할 결과 준비 인앱" })
    ).toBeNull();
    // 문의 답변(APP-1399)의 인앱 열도 같이 가려진다.
    expect(screen.getByLabelText("문의 답변 인앱 꺼짐")).toBeInTheDocument();
    expect(screen.getAllByText("꺼짐")).toHaveLength(2);
    expect(switchOf("일시정지된 회의 메일")).toBeChecked();
    expect(switchOf("일시정지된 회의 메일")).not.toHaveAttribute(
      "data-disabled"
    );

    fireEvent.click(switchOf("인앱 알림 모두 끄기"));
    await waitFor(() =>
      expect(switchOf("인앱 알림 모두 끄기")).not.toBeChecked()
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(switchOf("검토할 결과 준비 인앱")).toBeChecked();
    expect(writes).toEqual([
      'PUT /v1/notification-settings {"muteAll":true,"muteEmail":false}',
      'PUT /v1/notification-settings {"muteAll":false,"muteEmail":false}',
    ]);
  });

  it("메일 모두 끄기는 메일 열만 가린다", async () => {
    renderSettings();
    fireEvent.click(
      await screen.findByRole("switch", { name: "메일 모두 끄기" })
    );
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "끄기",
      })
    );
    await waitFor(() => expect(switchOf("메일 모두 끄기")).toBeChecked());
    expect(
      screen.getByLabelText("일시정지된 회의 메일 꺼짐")
    ).toBeInTheDocument();
    expect(switchOf("검토할 결과 준비 인앱")).toBeChecked();
    expect(switchOf("검토할 결과 준비 인앱")).not.toHaveAttribute(
      "data-disabled"
    );
  });

  it("기본값으로 되돌리기는 확인 창을 거치고, 취소하면 아무것도 바뀌지 않는다", async () => {
    const heard: string[] = [];
    const stop = onTrack((event) => heard.push(event));
    renderSettings();
    fireEvent.click(
      await screen.findByRole("switch", { name: "일시정지된 회의 메일" })
    );
    await waitFor(() =>
      expect(switchOf("일시정지된 회의 메일")).not.toBeChecked()
    );
    writes.length = 0;

    fireEvent.click(
      screen.getByRole("button", { name: "기본값으로 되돌리기" })
    );
    let dialog = await screen.findByRole("alertdialog", {
      name: "알림 설정을 기본값으로 되돌릴까요?",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(writes).toEqual([]);

    fireEvent.click(
      screen.getByRole("button", { name: "기본값으로 되돌리기" })
    );
    dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "되돌리기" }));
    await waitFor(() => expect(switchOf("일시정지된 회의 메일")).toBeChecked());
    stop();
    expect(writes).toEqual(["DELETE /v1/notification-settings"]);
    expect(heard).toContain("notification_settings_reset");
  });

  describe("제품 소식·혜택(APP-1392)", () => {
    const MARKETING = "제품 소식·혜택 메일 받기(선택)";
    /** 조회 전에는 스위치가 잠겨 있다(base-ui 는 `disabled` 속성 대신 `data-disabled` 로 표시한다). */
    const ready = () =>
      waitFor(() =>
        expect(switchOf(MARKETING)).not.toHaveAttribute("data-disabled")
      );

    it("기본은 꺼져 있고, 켜면 바로 바뀌어 동의한 날을 보인 뒤 서버에 보낸다", async () => {
      renderSettings();
      await ready();
      expect(switchOf(MARKETING)).not.toBeChecked();
      expect(screen.queryByText(/동의했어요|거부했어요/)).toBeNull();

      fireEvent.click(switchOf(MARKETING));
      await waitFor(() => expect(switchOf(MARKETING)).toBeChecked());
      expect(
        await screen.findByText(/^\d+월 \d+일에 동의했어요$/)
      ).toBeInTheDocument();
      await waitFor(() =>
        expect(writes).toEqual([
          'PUT /v1/notification-settings/marketing-email {"agreed":true}',
        ])
      );

      fireEvent.click(switchOf(MARKETING));
      expect(await screen.findByText(/에 거부했어요$/)).toBeInTheDocument();
    });

    it("서버가 실패하면 누르기 전 값으로 돌아온다", async () => {
      server.use(
        http.put("*/v1/notification-settings/marketing-email", () =>
          HttpResponse.json(
            { success: false, data: null, error: { code: "X", message: "x" } },
            { status: 500 }
          )
        )
      );
      renderSettings();
      await ready();
      fireEvent.click(switchOf(MARKETING));
      await waitFor(() => expect(writes).toHaveLength(1));
      await waitFor(() => expect(switchOf(MARKETING)).not.toBeChecked());
      expect(screen.queryByText(/동의했어요/)).toBeNull();
    });

    it("「기본값으로 되돌리기」는 동의를 건드리지 않는다", async () => {
      renderSettings();
      await ready();
      fireEvent.click(switchOf(MARKETING));
      await waitFor(() => expect(writes).toHaveLength(1));
      fireEvent.click(
        screen.getByRole("button", { name: "기본값으로 되돌리기" })
      );
      fireEvent.click(await screen.findByRole("button", { name: "되돌리기" }));
      await waitFor(() =>
        expect(writes).toEqual([
          'PUT /v1/notification-settings/marketing-email {"agreed":true}',
          "DELETE /v1/notification-settings",
        ])
      );
      expect(switchOf(MARKETING)).toBeChecked();
    });

    it("「메일 모두 끄기」가 켜져 있으면 이 메일도 가지 않는다고 알린다", async () => {
      renderSettings();
      const note = /메일 모두 끄기」가 켜져 있어/;
      await screen.findByRole("switch", { name: "메일 모두 끄기" });
      expect(screen.queryByText(note)).toBeNull();
      fireEvent.click(switchOf("메일 모두 끄기"));
      fireEvent.click(await screen.findByRole("button", { name: "끄기" }));
      expect(await screen.findByText(note)).toBeInTheDocument();
    });
  });
});
