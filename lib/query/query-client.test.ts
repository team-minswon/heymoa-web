import { describe, expect, it, vi, beforeEach } from "vitest";

// vi.mock은 import보다 먼저 끌어올려지므로 팩토리 안에서 만든다.
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { toast } from "sonner";

import { makeQueryClient } from "@/lib/query/query-client";

const toastError = vi.mocked(toast.error);

function envelope(code: string, message: string) {
  return { success: false, data: null, error: { code, message, details: null } };
}

async function runFailingMutation(
  client: ReturnType<typeof makeQueryClient>,
  error: unknown,
  meta?: Record<string, unknown>
) {
  const mutation = client
    .getMutationCache()
    .build(client, { mutationFn: async () => Promise.reject(error), meta });
  await mutation.execute(undefined).catch(() => undefined);
}

describe("mutation error toasts", () => {
  beforeEach(() => toastError.mockClear());

  it("shows the server message so web does not restate contract copy", async () => {
    const client = makeQueryClient();

    await runFailingMutation(
      client,
      envelope("DUPLICATE_PENDING_INVITATION", "이미 대기 중인 초대가 있습니다.")
    );

    expect(toastError).toHaveBeenCalledWith("이미 대기 중인 초대가 있습니다.");
  });

  it("falls back when the failure is not a contract envelope", async () => {
    const client = makeQueryClient();

    await runFailingMutation(client, new TypeError("Failed to fetch"));

    expect(toastError).toHaveBeenCalledWith("Failed to fetch");
  });

  // 지속 상태(입력 잠금·비ACTIVE)와 주 데이터 실패는 화면이 그린다 — 토스트는 사라지므로
  // 왜 막혔는지 알 수 없게 된다.
  it("stays silent when the screen draws the failure itself", async () => {
    const client = makeQueryClient();

    await runFailingMutation(
      client,
      envelope("CHAT_LOCKED", "다른 멤버가 입력 중입니다."),
      { suppressErrorToast: true }
    );

    expect(toastError).not.toHaveBeenCalled();
  });
});

describe("callers that already toast are not doubled up", () => {
  beforeEach(() => toastError.mockClear());

  // 실패 코드에 따라 문구가 갈리는 곳(프로젝트 삭제 등)은 자기 토스트를 띄운다.
  // 전역 훅이 또 띄우면 두 개가 겹치고 문구가 서로 다르다.
  it("skips the global toast for flows that opt out", async () => {
    const client = makeQueryClient();

    await runFailingMutation(
      client,
      envelope("PROJECT_HAS_NOTES", "프로젝트에 노트가 있어 삭제할 수 없습니다."),
      { suppressErrorToast: true }
    );

    expect(toastError).not.toHaveBeenCalled();
  });
});
