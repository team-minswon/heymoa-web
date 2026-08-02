import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
import { AccountSettingsForm } from "@/components/settings/account-settings-form";

const mutations = vi.hoisted(() => ({ changeDefaultWorkspace: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("sonner", () => ({ toast }));

vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  getGetWorkspacesQueryKey: () => ["/v1/workspaces"],
  useGetWorkspacesSuspense: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          workspaces: [
            {
              workspaceId: "01K0000000000",
              name: "테스트 유저의 워크스페이스",
              isDefault: true,
            },
            { workspaceId: "01K0000000006", name: "제품 팀", isDefault: false },
          ],
        },
      },
    },
  }),
  useChangeDefaultWorkspace: () => ({
    mutateAsync: mutations.changeDefaultWorkspace,
    isPending: false,
  }),
}));

vi.mock("@/lib/api/generated/users/users", () => ({
  getGetCurrentUserQueryKey: () => ["current-user"],
  useGetCurrentUserSuspense: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          userId: "01K0000000003",
          name: "테스트 유저",
          email: "test@heymoa.com",
          image: "https://images.heymoa.test/users/test-user.png",
        },
      },
    },
  }),
}));

describe("AccountSettingsForm", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "Image",
      class {
        complete = true;
        naturalWidth = 1;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          this.onload?.();
        }
      }
    );
  });

  afterAll(() => vi.unstubAllGlobals());
  afterEach(cleanup);

  beforeEach(() => {
    mutations.changeDefaultWorkspace.mockReset();
    mutations.changeDefaultWorkspace.mockResolvedValue({ status: 200 });
    toast.error.mockReset();
    toast.success.mockReset();
  });

  const renderForm = () =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AccountSettingsForm />
      </QueryClientProvider>
    );

  it("displays read-only profile information", async () => {
    renderForm();
    expect(screen.getByDisplayValue("test@heymoa.com")).toBeDisabled();
    expect(screen.getByDisplayValue("테스트 유저")).toBeDisabled();
    expect(
      await screen.findByRole("img", { name: "테스트 유저 프로필" })
    ).toHaveAttribute("src", expect.stringContaining("test-user.png"));
  });

  it("offers the command only on workspaces that are not already default", () => {
    renderForm();
    // 기본인 행은 「지금 기본입니다」만 있고 명령이 없다 — 있으면 자기 자신을 다시 지정한다.
    expect(screen.getByText("지금 기본입니다")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "기본으로 설정" })
    ).toHaveLength(1);
  });

  it("changes the default workspace and reports it", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "기본으로 설정" }));

    await waitFor(() =>
      expect(mutations.changeDefaultWorkspace).toHaveBeenCalledWith({
        data: { workspaceId: "01K0000000006" },
      })
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("refreshes every workspace detail, not just the new default", async () => {
    // 옛 기본의 상세 캐시에 isDefault: true가 남으면 그 워크스페이스의 설정이 계속
    // `기본` 배지를 그린다. 하위 경로(`/projects`)까지 끌어오면 과잉 무효화다.
    const queryClient = new QueryClient();
    const invalidated: unknown[] = [];
    queryClient.setQueryData(["/v1/workspaces/01K0000000000"], { seeded: true });
    queryClient.setQueryData(["/v1/workspaces/01K0000000006"], { seeded: true });
    queryClient.setQueryData(["/v1/workspaces/01K0000000000/projects"], {
      seeded: true,
    });
    vi.spyOn(queryClient, "invalidateQueries").mockImplementation(
      async (filters) => {
        for (const query of queryClient.getQueryCache().getAll()) {
          if (filters?.predicate?.(query)) invalidated.push(query.queryKey);
        }
        if (filters?.queryKey) invalidated.push(filters.queryKey);
      }
    );

    render(
      <QueryClientProvider client={queryClient}>
        <AccountSettingsForm />
      </QueryClientProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "기본으로 설정" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(invalidated).toEqual(
      expect.arrayContaining([
        ["/v1/workspaces"],
        ["/v1/workspaces/01K0000000000"],
        ["/v1/workspaces/01K0000000006"],
      ])
    );
    expect(invalidated).not.toContainEqual([
      "/v1/workspaces/01K0000000000/projects",
    ]);
  });

  it("shows the server's own wording when the change fails", async () => {
    mutations.changeDefaultWorkspace.mockRejectedValue({
      success: false,
      data: null,
      error: { code: "WORKSPACE_NOT_FOUND", message: "워크스페이스를 찾을 수 없습니다." },
    });
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "기본으로 설정" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "워크스페이스를 찾을 수 없습니다.",
        expect.anything()
      )
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("refetches the list after a failure so a stale row cannot linger", async () => {
    mutations.changeDefaultWorkspace.mockRejectedValue(new Error("gone"));
    const queryClient = new QueryClient();
    const invalidate = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);

    render(
      <QueryClientProvider client={queryClient}>
        <AccountSettingsForm />
      </QueryClientProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "기본으로 설정" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["/v1/workspaces"] });
  });
});
