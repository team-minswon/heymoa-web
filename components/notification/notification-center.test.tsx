import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  NotificationCenterProvider,
  useNotificationCenter,
} from "@/components/notification/notification-center";
import { useReadAnalysisReadyOnView } from "@/components/notification/use-read-analysis-ready";
import { onTrack } from "@/lib/analytics/track";
import type { NotificationItem } from "@/lib/notification/notification-list";
import { notificationModalMemory } from "@/lib/notification/notification-list";

/**
 * 서버를 흉내 낸다 — 필터를 쪽을 자르기 전에 적용하고 `(createdAt, id)` 커서로 자르며, 모두 읽음은 `upTo` 까지만 읽는다.
 * 요청 기록으로 「목록을 다시 읽지 않았다」·「쪽 수만큼 다시 읽지 않았다」를 본다.
 */
const push = vi.hoisted(() => vi.fn());
/** 라우터가 `history.pushState/replaceState` 를 `useSearchParams` 에 잇는 것을 흉내 낸다(Next 16 통합). */
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  const subscribe = (notify: () => void) => {
    window.addEventListener("popstate", notify);
    window.addEventListener("test:history", notify);
    return () => {
      window.removeEventListener("popstate", notify);
      window.removeEventListener("test:history", notify);
    };
  };
  return {
    useRouter: () => ({ push }),
    useSearchParams: () =>
      new URLSearchParams(
        useSyncExternalStore(subscribe, () => window.location.search)
      ),
  };
});
for (const method of ["pushState", "replaceState"] as const) {
  const original = window.history[method].bind(window.history);
  window.history[method] = (...args: Parameters<History["pushState"]>) => {
    original(...args);
    window.dispatchEvent(new Event("test:history"));
  };
}

const store = {
  items: [] as NotificationItem[],
  serverTime: "2026-10-22T03:00:00.000Z",
  failCount: false,
  legacy: false,
  muteAll: false,
  /** 있으면 하나 읽기 응답이 이것을 기다린다 — 응답 전 화면을 보려고 */
  readGate: null as Promise<void> | null,
};
const requests: string[] = [];

function analysisReady(
  id: string,
  createdAt: string,
  options: {
    noteId?: string;
    workspaceId?: string;
    autoEnded?: boolean;
    days?: number | null;
  } = {}
): NotificationItem {
  return {
    notificationId: id,
    type: "ANALYSIS_READY",
    readAt: null,
    createdAt,
    invitation: null,
    payload: {
      workspaceId: options.workspaceId ?? "WS1",
      workspaceName: "제품 팀",
      invitationId: null,
      inviterUserId: null,
      noteId: options.noteId ?? "NOTE1",
      noteTitle: "스프린트 회고",
      autoEnded: options.autoEnded ?? false,
      pausedBusinessDays: options.days ?? null,
      feedbackId: null,
    },
  };
}

function invitation(
  id: string,
  createdAt: string,
  status = "PENDING",
  readAt: string | null = null
): NotificationItem {
  return {
    notificationId: id,
    type: "WORKSPACE_INVITATION",
    readAt,
    createdAt,
    invitation: {
      invitationId: `inv-${id}`,
      status: status as "PENDING",
      role: "MEMBER",
      workspaceId: "WS2",
      workspaceName: "디자인 스튜디오",
      inviterName: "이서연",
      expiresAt: "2099-01-01T00:00:00Z",
    },
    payload: {
      workspaceId: "WS2",
      workspaceName: "디자인 스튜디오",
      invitationId: `inv-${id}`,
      inviterUserId: "U2",
      noteId: null,
      noteTitle: null,
      autoEnded: null,
      pausedBusinessDays: null,
      feedbackId: null,
    },
  };
}

const at = (minute: number) =>
  new Date(Date.UTC(2026, 9, 22, 2, minute)).toISOString();

const server = setupServer(
  http.get("*/v1/notifications", ({ request }) => {
    const query = new URL(request.url).searchParams;
    requests.push(`GET list ${query.toString()}`);
    const sorted = [...store.items].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    const filtered = sorted.filter((item) =>
      query.get("filter") === "UNREAD"
        ? item.readAt === null
        : query.get("filter") === "ACTION_REQUIRED"
          ? item.invitation?.status === "PENDING"
          : true
    );
    const cursor = query.get("afterCreatedAt");
    const rest = cursor
      ? filtered.filter((item) => item.createdAt < cursor)
      : filtered;
    const limit = Number(query.get("limit") ?? 50);
    const page = rest.slice(0, limit);
    const hasMore = rest.length > limit;
    const data = {
      notifications: store.legacy
        ? page.map((item) => ({ ...item, payload: undefined }))
        : page,
      unreadCount: sorted.filter((item) => item.readAt === null).length,
      hasMore,
      nextCreatedAt: hasMore ? page.at(-1)!.createdAt : null,
      nextNotificationId: hasMore ? page.at(-1)!.notificationId : null,
      ...(store.legacy ? {} : { serverTime: store.serverTime }),
    };
    return HttpResponse.json({ success: true, data, error: null });
  }),
  http.get("*/v1/notifications/unread-count", () => {
    requests.push("GET count");
    if (store.failCount)
      return HttpResponse.json(
        { success: false, data: null, error: { code: "X", message: "x" } },
        { status: 500 }
      );
    return HttpResponse.json({
      success: true,
      data: {
        unreadCount: store.items.filter((item) => item.readAt === null).length,
      },
      error: null,
    });
  }),
  http.put("*/v1/notifications/read", async ({ request }) => {
    const { upTo } = (await request.json()) as { upTo: string };
    requests.push(`PUT read-all ${upTo}`);
    for (const item of store.items)
      if (item.readAt === null && item.createdAt <= upTo)
        item.readAt = store.serverTime;
    return HttpResponse.json({
      success: true,
      data: { readCount: 1 },
      error: null,
    });
  }),
  http.put("*/v1/notifications/:id/read", async ({ params }) => {
    requests.push(`PUT read ${params.id}`);
    if (store.readGate) await store.readGate;
    const item = store.items.find((i) => i.notificationId === params.id);
    if (item) item.readAt ??= store.serverTime;
    return HttpResponse.json({
      success: true,
      data: { notificationId: params.id },
      error: null,
    });
  }),
  http.post("*/v1/invitations/:id/:action", ({ params }) => {
    requests.push(`POST ${params.action} ${params.id}`);
    return HttpResponse.json({
      success: true,
      data: {
        invitationId: params.id,
        workspaceId: "WS2",
        role: "MEMBER",
        status: params.action === "accept" ? "ACCEPTED" : "DECLINED",
      },
      error: null,
    });
  }),
  http.get("*/v1/notification-settings", () =>
    HttpResponse.json({
      success: true,
      data: { muteAll: store.muteAll, muteEmail: false, items: [] },
      error: null,
    })
  ),
  http.get("*/v1/workspaces", () =>
    HttpResponse.json({
      success: true,
      data: {
        workspaces: [
          {
            workspaceId: "WS1",
            name: "제품 팀",
            description: null,
            role: "ADMIN",
            agentAccessAllowed: true,
          },
        ],
      },
      error: null,
    })
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
beforeEach(() => {
  window.history.replaceState(null, "", "/");
  push.mockReset();
  store.items = [];
  store.readGate = null;
  store.failCount = false;
  store.legacy = false;
  store.muteAll = false;
  requests.length = 0;
  notificationModalMemory.filter = "ALL";
  notificationModalMemory.scrollTop = 0;
  notificationModalMemory.lastNotificationId = null;
});
afterEach(() => cleanup());
afterAll(() => server.close());

function Entry() {
  const center = useNotificationCenter()!;
  return (
    <button type="button" onClick={center.openNotifications}>
      알림 {center.unreadCount ?? "?"}
    </button>
  );
}

function renderCenter() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const openSettings = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <NotificationCenterProvider
        workspaceId="WS1"
        onOpenSettings={openSettings}
      >
        <Entry />
      </NotificationCenterProvider>
    </QueryClientProvider>
  );
  return { client, openSettings };
}

async function openModal() {
  fireEvent.click(screen.getByRole("button", { name: /^알림/ }));
  return screen.findByRole("dialog", { name: "알림" });
}

describe("알림 개수", () => {
  it("서버 개수를 보이고, 창 복귀 때 다시 읽어 다른 탭에서 읽은 것을 반영한다. 실패해도 0으로 바꾸지 않는다", async () => {
    store.items = [invitation("N1", at(1)), invitation("N2", at(2))];
    renderCenter();
    expect(await screen.findByRole("button", { name: "알림 2" })).toBeVisible();

    store.items[0].readAt = at(3); // 다른 탭에서 읽었다
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    expect(await screen.findByRole("button", { name: "알림 1" })).toBeVisible();

    store.failCount = true;
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() =>
      expect(requests.filter((r) => r === "GET count")).toHaveLength(3)
    );
    expect(screen.getByRole("button", { name: "알림 1" })).toBeVisible();
    act(() => focusManager.setFocused(undefined));
  });

  it("개수 조회는 목록을 읽지 않는다 — 목록은 모달이 열려 있을 때만 읽는다", async () => {
    store.items = [invitation("N1", at(1))];
    renderCenter();
    await screen.findByRole("button", { name: "알림 1" });
    expect(requests.some((r) => r.startsWith("GET list"))).toBe(false);
  });
});

describe("알림 모달", () => {
  it("초대를 수락하면 바로 처리하고, 거절은 확인 창을 거친다. 처리한 행은 결과를 흐리게 보인다", async () => {
    store.items = [invitation("N1", at(2)), invitation("N2", at(1))];
    renderCenter();
    const dialog = await openModal();
    const rowOf = (id: string) =>
      waitFor(() => {
        const row = dialog.querySelector<HTMLElement>(
          `[data-notification-id="${id}"]`
        );
        expect(row).not.toBeNull();
        return row!;
      });
    const first = await rowOf("N1");
    fireEvent.click(within(first).getByRole("button", { name: "수락" }));
    expect(await within(first).findByText("수락함")).toBeVisible();
    expect(requests).toContain("POST accept inv-N1");

    const second = await rowOf("N2");
    fireEvent.click(within(second).getByRole("button", { name: "거절" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(requests).not.toContain("POST decline inv-N2");
    fireEvent.click(within(confirm).getByRole("button", { name: "거절" }));
    expect(await within(second).findByText("거절함")).toBeVisible();
    expect(requests).toContain("POST decline inv-N2");
  });

  it("원본 초대가 지워진 알림도 행이 남고 처리 버튼이 없다", async () => {
    const gone = { ...invitation("N1", at(1)), invitation: null };
    store.items = [gone];
    renderCenter();
    const dialog = await openModal();
    expect(
      await within(dialog).findByText(
        "취소되었거나 더 이상 볼 수 없는 초대입니다"
      )
    ).toBeVisible();
    expect(within(dialog).queryByRole("button", { name: "수락" })).toBeNull();
  });

  it("안 읽음 탭은 서버 필터로 읽고 「더 보기」로 끝까지 가도 빠지는 항목이 없다", async () => {
    store.items = Array.from({ length: 45 }, (_, index) =>
      invitation(`N${index}`, at(index), "ACCEPTED", index % 2 ? at(50) : null)
    );
    renderCenter();
    const dialog = await openModal();
    fireEvent.click(within(dialog).getByRole("tab", { name: "안 읽음" }));
    await waitFor(() =>
      expect(requests.some((r) => r.includes("filter=UNREAD"))).toBe(true)
    );
    await waitFor(() =>
      expect(
        within(dialog).getAllByRole("button", { name: "읽음으로 표시" })
      ).toHaveLength(20)
    );
    fireEvent.click(within(dialog).getByRole("button", { name: /더 보기/ }));
    await waitFor(() =>
      expect(
        within(dialog).getAllByRole("button", { name: "읽음으로 표시" })
      ).toHaveLength(23)
    );
    expect(
      within(dialog).queryByRole("button", { name: /더 보기/ })
    ).toBeNull();
  });

  it("모달과 탭은 주소에 남는다 — 열기·탭은 기록을 쌓고, 뒤로 가기는 앞 탭으로, 닫기는 쌓은 칸을 한 번에 걷는다", async () => {
    const before = window.history.length;
    renderCenter();
    let dialog = await openModal();
    expect(window.location.search).toBe("?notifications=all");
    fireEvent.click(within(dialog).getByRole("tab", { name: "안 읽음" }));
    fireEvent.click(within(dialog).getByRole("tab", { name: "처리 필요" }));
    expect(window.location.search).toBe("?notifications=action");
    expect(window.history.length).toBe(before + 3);

    window.history.back();
    await waitFor(() =>
      expect(
        within(dialog).getByRole("tab", { name: "안 읽음" })
      ).toHaveAttribute("aria-selected", "true")
    );
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(window.location.search).toBe(""));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "알림" })).toBeNull()
    );
    // 다시 열면 마지막 탭이다.
    dialog = await openModal();
    expect(window.location.search).toBe("?notifications=unread");
  });

  it("딥링크(새로고침)로 들어오면 그 탭으로 열리고, 닫으면 기록을 안 늘리고 쿼리만 지운다", async () => {
    window.history.replaceState(null, "", "/?notifications=action");
    const before = window.history.length;
    renderCenter();
    const dialog = await screen.findByRole("dialog", { name: "알림" });
    expect(
      within(dialog).getByRole("tab", { name: "처리 필요" })
    ).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(window.location.search).toBe(""));
    expect(window.history.length).toBe(before);
  });

  it("설정 창 쿼리가 같이 있으면 알림 모달은 열리지 않는다", async () => {
    window.history.replaceState(
      null,
      "",
      "/?settings=notifications&notifications=all"
    );
    renderCenter();
    await screen.findByRole("button", { name: /^알림/ });
    expect(screen.queryByRole("dialog", { name: "알림" })).toBeNull();
  });

  it("닫았다 열면 탭·불러온 쪽·스크롤이 그대로이고 목록을 다시 읽지 않는다", async () => {
    store.items = Array.from({ length: 30 }, (_, index) =>
      invitation(`N${index}`, at(index), "ACCEPTED", at(50))
    );
    renderCenter();
    let dialog = await openModal();
    fireEvent.click(within(dialog).getByRole("tab", { name: "처리 필요" }));
    fireEvent.click(within(dialog).getByRole("tab", { name: "전체" }));
    await within(dialog).findByRole("button", { name: /더 보기/ });
    fireEvent.click(within(dialog).getByRole("button", { name: /더 보기/ }));
    await waitFor(() =>
      expect(dialog.querySelectorAll("[data-notification-id]")).toHaveLength(30)
    );
    const viewport = dialog.querySelector<HTMLElement>(
      "[data-slot=notification-list]"
    )!;
    viewport.scrollTop = 240;
    const listReads = requests.filter((r) => r.startsWith("GET list")).length;

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "알림" })).toBeNull()
    );
    dialog = await openModal();
    expect(within(dialog).getByRole("tab", { name: "전체" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(dialog.querySelectorAll("[data-notification-id]")).toHaveLength(30);
    expect(
      dialog.querySelector<HTMLElement>("[data-slot=notification-list]")!
        .scrollTop
    ).toBe(240);
    expect(requests.filter((r) => r.startsWith("GET list")).length).toBe(
      listReads
    );
  });

  it("모두 읽음은 목록 응답의 서버 시각까지만 읽는다 — 그 사이 도착한 알림은 안 읽음으로 남는다", async () => {
    store.items = [invitation("N1", at(1)), invitation("N2", at(2))];
    store.serverTime = at(5);
    renderCenter();
    await screen.findByRole("button", { name: "알림 2" });
    const dialog = await openModal();
    await within(dialog).findAllByRole("button", { name: "읽음으로 표시" });
    store.items.push(invitation("LATE", at(7))); // 목록을 받은 뒤 도착
    fireEvent.click(
      within(dialog).getByRole("button", { name: "모두 읽음으로 표시" })
    );
    await waitFor(() => expect(requests).toContain(`PUT read-all ${at(5)}`));
    expect(store.items.find((i) => i.notificationId === "LATE")!.readAt).toBe(
      null
    );
    // 모달이 열려 있어 바깥은 접근성 트리에서 빠진다(hidden).
    expect(
      await screen.findByRole("button", { name: "알림 1", hidden: true })
    ).toBeInTheDocument();
  });

  it("옛 서버 응답(payload·serverTime 없음)도 그린다 — 모두 읽음만 막힌다", async () => {
    store.legacy = true;
    store.items = [invitation("N1", at(1))];
    renderCenter();
    const dialog = await openModal();
    expect(await within(dialog).findByText("이서연")).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: "모두 읽음으로 표시" })
    ).toBeDisabled();
  });

  it("모르는 종류는 일반 행으로 그리고 실패하지 않는다", async () => {
    store.items = [
      {
        ...invitation("N1", at(1)),
        type: "SOMETHING_NEW" as "WORKSPACE_INVITATION",
        invitation: null,
      },
    ];
    renderCenter();
    const dialog = await openModal();
    expect(
      await within(dialog).findByText("새 알림이 도착했습니다")
    ).toBeVisible();
  });

  it("빈 목록·인앱 알림 꺼짐·처리 필요 없음 문구를 보인다", async () => {
    store.muteAll = true;
    renderCenter();
    const dialog = await openModal();
    expect(
      await within(dialog).findByText(
        "초대와 검토할 결과 알림이 여기에 도착합니다."
      )
    ).toBeVisible();
    expect(
      await within(dialog).findByText("인앱 알림이 꺼져 있습니다")
    ).toBeVisible();
    fireEvent.click(within(dialog).getByRole("tab", { name: "처리 필요" }));
    expect(
      await within(dialog).findByText("응답할 초대나 검토할 결과가 없습니다.")
    ).toBeVisible();
  });

  it("읽는 도중 도착한 알림은 끼워 넣지 않고 「새 알림 N개」로 알린다", async () => {
    store.items = [invitation("N1", at(1))];
    const { client } = renderCenter();
    const dialog = await openModal();
    await within(dialog).findAllByRole("listitem");
    store.items.push(invitation("NEW", at(9)));
    await act(() =>
      client.refetchQueries({ predicate: (q) => q.queryKey.at(-1) === "head" })
    );
    expect(
      await within(dialog).findByRole("button", { name: "새 알림 1개" })
    ).toBeVisible();
    expect(dialog.querySelector('[data-notification-id="NEW"]')).toBeNull();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "새 알림 1개" })
    );
    await waitFor(() =>
      expect(
        dialog.querySelector('[data-notification-id="NEW"]')
      ).not.toBeNull()
    );
  });

  it("「알림 설정」은 알림을 주소에 남긴 채 설정의 알림 탭을 연다. 사건에는 노트·이름·제목이 없다", async () => {
    const heard: Array<[string, Record<string, unknown>]> = [];
    const off = onTrack((name, props) =>
      heard.push([name, (props ?? {}) as Record<string, unknown>])
    );
    store.items = [invitation("N1", at(1))];
    const { openSettings } = renderCenter();
    await screen.findByRole("button", { name: "알림 1" });
    const dialog = await openModal();
    fireEvent.click(within(dialog).getByRole("button", { name: "알림 설정" }));
    // 알림을 걷지 않고 그 위에 설정을 얹는다(APP-1363) — 뒤로 가기가 알림으로 돌아오게.
    expect(openSettings).toHaveBeenCalledWith("notifications");
    expect(window.location.search).toBe("?notifications=all");
    off();
    expect(heard.map(([name]) => name)).toEqual([
      "notifications_opened",
      "settings_tab_opened",
    ]);
    for (const [, props] of heard) {
      for (const key of Object.keys(props))
        expect(["noteId", "note_id", "email", "name", "title"]).not.toContain(
          key
        );
    }
    expect(heard[0][1]).toEqual({ workspace_id: "WS1", unread_count: 1 });
  });
});

describe("검토할 결과 준비 행", () => {
  it("일반 종료분과 자동 종료분이 각각 맞는 문구로 그려진다", async () => {
    store.items = [
      analysisReady("A1", at(2), { autoEnded: true, days: 3 }),
      analysisReady("A2", at(1), { noteId: "NOTE2" }),
    ];
    renderCenter();
    const dialog = await openModal();
    const auto = await waitFor(() => {
      const row = dialog.querySelector<HTMLElement>(
        '[data-notification-id="A1"]'
      );
      expect(row).not.toBeNull();
      return row!;
    });
    expect(auto).toHaveTextContent(
      "스프린트 회고의 검토할 결과가 준비되었습니다"
    );
    expect(auto).toHaveTextContent(
      "마지막 일시정지 후 3영업일이 지나 자동으로 종료했습니다."
    );
    const normal = dialog.querySelector<HTMLElement>(
      '[data-notification-id="A2"]'
    )!;
    expect(normal).not.toHaveTextContent("자동으로 종료했습니다");
    expect(normal).toHaveTextContent("검토하기 →");
  });

  it("행을 누르면 모달을 닫고 그 노트의 요약·검토 화면으로 간다. 읽음은 도착 화면이 한다", async () => {
    store.items = [analysisReady("A1", at(1))];
    renderCenter();
    const dialog = await openModal();
    fireEvent.click(
      await within(dialog).findByRole("button", {
        name: /검토할 결과가 준비되었습니다/,
      })
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/w/WS1/notes/NOTE1?view=full&tab=summary&source=notification"
      )
    );
    // 모달 쿼리를 걷은 뒤에 간다 — 노트에서 뒤로 가기가 모달 칸으로 돌아오지 않는다.
    expect(window.location.search).toBe("");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "알림" })).toBeNull()
    );
    expect(requests.some((r) => r.startsWith("PUT read"))).toBe(false);
  });

  it("점(읽음으로 표시)은 이동 없이 그 알림만 읽고, 사이드바 배지는 응답 전에 먼저 하나 내려간다", async () => {
    store.items = [analysisReady("A1", at(1)), analysisReady("A2", at(2))];
    renderCenter();
    await screen.findByRole("button", { name: "알림 2" });
    const dialog = await openModal();
    await within(dialog).findAllByRole("button", { name: "읽음으로 표시" });
    const row = dialog.querySelector<HTMLElement>(
      '[data-notification-id="A1"]'
    )!;
    let release = () => {};
    store.readGate = new Promise((resolve) => (release = resolve));
    fireEvent.click(within(row).getByRole("button", { name: "읽음으로 표시" }));
    await waitFor(() => expect(requests).toContain("PUT read A1"));
    // 서버가 아직 답하지 않았는데 배지는 이미 1이다(모달 뒤라 접근성 트리에서는 가려져 있다).
    expect(
      await screen.findByRole("button", { name: "알림 1", hidden: true })
    ).toBeInTheDocument();
    expect(row).not.toHaveAttribute("data-unread");
    release();
    store.readGate = null;
    expect(requests).not.toContain("PUT read A2");
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "알림" })).toBeVisible();
  });

  it("원본이 없거나 권한이 없는 워크스페이스면 행은 남고 이동만 막힌다", async () => {
    store.items = [analysisReady("A1", at(1), { workspaceId: "GONE" })];
    renderCenter();
    const dialog = await openModal();
    expect(
      await within(dialog).findByText("삭제되었거나 볼 권한이 없는 회의입니다")
    ).toBeVisible();
    fireEvent.click(dialog.querySelector('[data-notification-id="A1"]')!);
    expect(push).not.toHaveBeenCalled();
  });
});

describe("문의 답변 행", () => {
  it("행을 누르면 읽고 모달을 닫은 뒤 「내 문의」가 그 문의를 연다", async () => {
    store.items = [
      {
        notificationId: "Q1",
        type: "INQUIRY_ANSWERED",
        readAt: null,
        createdAt: at(1),
        invitation: null,
        payload: {
          workspaceId: null,
          workspaceName: null,
          invitationId: null,
          inviterUserId: null,
          noteId: null,
          noteTitle: null,
          autoEnded: null,
          pausedBusinessDays: null,
          feedbackId: "FB1",
        },
      },
    ];
    renderCenter();
    const dialog = await openModal();
    fireEvent.click(
      await within(dialog).findByRole("button", {
        name: "문의에 답변이 등록되었습니다",
      })
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/w/WS1?inquiry=FB1")
    );
    await waitFor(() => expect(requests).toContain("PUT read Q1"));
  });
});

function Viewer({ noteId, displayed }: { noteId: string; displayed: boolean }) {
  useReadAnalysisReadyOnView(noteId, displayed);
  return null;
}

function renderViewer(displayed: boolean) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <NotificationCenterProvider workspaceId="WS1" onOpenSettings={() => {}}>
        <Entry />
        <Viewer noteId="NOTE1" displayed={displayed} />
      </NotificationCenterProvider>
    </QueryClientProvider>
  );
}

describe("검토할 결과 준비 자동 읽음", () => {
  function setVisibility(state: DocumentVisibilityState) {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => state,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }
  afterEach(() => setVisibility("visible"));

  it("결과가 표시되고 창이 보이면 그 노트의 알림만 읽는다", async () => {
    setVisibility("visible");
    store.items = [
      analysisReady("A1", at(2)),
      analysisReady("A2", at(1), { noteId: "OTHER" }),
    ];
    renderViewer(true);
    await waitFor(() => expect(requests).toContain("PUT read A1"));
    expect(requests).not.toContain("PUT read A2");
  });

  it("창이 숨겨져 있거나 결과가 표시되지 않았으면 읽지 않는다", async () => {
    setVisibility("hidden");
    store.items = [analysisReady("A1", at(2))];
    renderViewer(true);
    await screen.findByRole("button", { name: "알림 1" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(requests.some((r) => r.startsWith("PUT read"))).toBe(false);
    cleanup();

    setVisibility("visible");
    renderViewer(false);
    await screen.findByRole("button", { name: "알림 1" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(requests.some((r) => r.startsWith("PUT read"))).toBe(false);
  });
});
