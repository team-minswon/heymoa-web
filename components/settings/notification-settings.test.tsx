import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  NotificationSettings,
  NotificationSettingsSkeleton,
} from "@/components/settings/notification-settings";
import { DataBoundary } from "@/components/ui/data-boundary";
import { onTrack } from "@/lib/analytics/track";
import {
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
  writes.length = 0;
});
afterAll(() => server.close());

function renderSettings() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <DataBoundary
        fallback={<NotificationSettingsSkeleton />}
        errorLabel="알림 설정을 불러오지 못했습니다"
      >
        <NotificationSettings workspaceId="W1" />
      </DataBoundary>
    </QueryClientProvider>
  );
}

const switchOf = (name: string) => screen.getByRole("switch", { name });

describe("NotificationSettings", () => {
  it("선택 알림만 줄로 그리고 필수 알림은 한 줄 안내로 둔다", async () => {
    renderSettings();
    expect(await screen.findByText("중지된 회의")).toBeInTheDocument();
    expect(screen.queryByText("워크스페이스 초대")).toBeNull();
    expect(
      screen.getByText(
        "워크스페이스 초대 같은 필수 알림은 여기서 끌 수 없습니다."
      )
    ).toBeInTheDocument();
    // 보내지 않는 채널은 「—」이고 이유를 읽힌다
    expect(
      screen.getByLabelText("이 알림은 웹으로 보내지 않습니다")
    ).toHaveTextContent("—");
    // 기본값은 서버가 정한다 — 중지된 회의 메일은 켜짐
    expect(switchOf("중지된 회의 메일")).toBeChecked();
    expect(screen.getByRole("textbox", { name: "메일 받는 주소" })).toBeDisabled();
  });

  it("스위치를 바꾸면 서버에 보내고 돌아온 설정으로 그린 뒤 사건을 보낸다", async () => {
    const heard: Array<[string, unknown]> = [];
    const stop = onTrack((event, properties) =>
      heard.push([event, properties])
    );
    renderSettings();
    fireEvent.click(
      await screen.findByRole("switch", { name: "중지된 회의 메일" })
    );
    await waitFor(() => expect(switchOf("중지된 회의 메일")).not.toBeChecked());
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

  it.each([
    ["알림 모두 끄기", "알림을 모두 끌까요?"],
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

  it("알림 모두 끄기를 켜면 종류별 스위치가 꺼짐으로 가려지고, 풀면 확인 없이 이전 선택이 돌아온다", async () => {
    renderSettings();
    fireEvent.click(
      await screen.findByRole("switch", { name: "알림 모두 끄기" })
    );
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "끄기",
      })
    );
    await waitFor(() => expect(switchOf("알림 모두 끄기")).toBeChecked());
    expect(switchOf("중지된 회의 메일")).toHaveAttribute("data-disabled");
    expect(screen.getByText("꺼짐")).toBeInTheDocument();

    fireEvent.click(switchOf("알림 모두 끄기"));
    await waitFor(() => expect(switchOf("알림 모두 끄기")).not.toBeChecked());
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(switchOf("중지된 회의 메일")).toBeChecked();
    expect(writes).toEqual([
      'PUT /v1/notification-settings {"muteAll":true,"muteEmail":false}',
      'PUT /v1/notification-settings {"muteAll":false,"muteEmail":false}',
    ]);
  });

  it("기본값으로 되돌리기는 확인 창을 거치고, 취소하면 아무것도 바뀌지 않는다", async () => {
    const heard: string[] = [];
    const stop = onTrack((event) => heard.push(event));
    renderSettings();
    fireEvent.click(
      await screen.findByRole("switch", { name: "중지된 회의 메일" })
    );
    await waitFor(() => expect(switchOf("중지된 회의 메일")).not.toBeChecked());
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
    await waitFor(() => expect(switchOf("중지된 회의 메일")).toBeChecked());
    stop();
    expect(writes).toEqual(["DELETE /v1/notification-settings"]);
    expect(heard).toContain("notification_settings_reset");
  });
});
