/**
 * 녹음 사용량 블록 시험(APP-1566). MSW 목으로 그린 것이라 서버 정합성의 증거가 아니다 — 값은 전부 서버가 준 분 필드를 그대로 쓴다.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { WorkspacePlanSettings } from "@/components/billing/plan-settings";
import { billingHandlers, billingMock } from "@/lib/mocks/billing";
import { mockDb } from "@/lib/mocks/db";
import { restHandlers } from "@/lib/mocks/rest-handlers";

const FREE = "01K0000000000";
const PAID = "01K0000000006";

const server = setupServer(...restHandlers, ...billingHandlers);
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  mockDb.reset();
  billingMock.setScenario(null);
});
afterAll(() => server.close());

const renderIn = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {ui}
    </QueryClientProvider>
  );

/** 설정 › 요금제 탭. 사용량은 현재 요금제 패널의 오른쪽 칸이다. */
const PlanTab = ({ workspaceId }: { workspaceId: string }) => (
  <WorkspacePlanSettings workspaceId={workspaceId} onOpenPayment={vi.fn()} />
);
/** 사용량 값 한 줄(사용분과 「/ 한도」)의 글. 두 조각이 한 줄에 붙어 읽힌다. */
const usageValue = async (used: string) =>
  (await screen.findByText(used)).parentElement?.textContent;

const freeUsage = (patch: Record<string, unknown> = {}) => ({
  enforced: true,
  periodKind: "FREE",
  periodStart: "2026-11-01T00:00:00+09:00",
  periodEnd: "2026-12-01T00:00:00+09:00",
  unlimited: false,
  sampleRate: 16000,
  allowanceSamples: 115200000,
  usedSamples: 43200000,
  remainingSamples: 72000000,
  allowanceMinutes: 120,
  usedMinutes: 45,
  remainingMinutes: 75,
  recordingInProgress: false,
  ...patch,
});
const serveUsage = (data: unknown, workspaceId = FREE) =>
  server.use(
    http.get(`*/v1/workspaces/${workspaceId}/billing/usage`, () =>
      HttpResponse.json({ success: true, data, error: null })
    )
  );

describe("녹음 사용량 — 요금제 탭", () => {
  it("Free 는 이번 달 사용분·한도·진행 막대·초기화 날짜를 서버 값으로 그린다", async () => {
    renderIn(<PlanTab workspaceId={FREE} />);
    expect(await usageValue("45분")).toBe("45분/ 30시간");
    expect(screen.getByText("이번 달 녹음")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "3"
    );
    expect(screen.getByText("12월 1일에 초기화됩니다")).toBeInTheDocument();
    expect(
      screen.queryByText("녹음 중인 회의는 끝난 뒤 사용량에 반영됩니다")
    ).not.toBeInTheDocument();
  });

  it("한도를 넘어 사용했어도 막대는 가득 찬 채 서버 분 값을 그대로 보인다", async () => {
    serveUsage(
      freeUsage({
        usedMinutes: 131,
        usedSamples: 125760000,
        remainingMinutes: 0,
      })
    );
    renderIn(<PlanTab workspaceId={FREE} />);
    expect(await usageValue("2시간 11분")).toBe("2시간 11분/ 2시간");
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100"
    );
  });

  it("끝나지 않은 녹음이 있으면 녹음 중인 회의는 끝난 뒤 반영된다고 한 줄 알린다", async () => {
    serveUsage(freeUsage({ recordingInProgress: true }));
    renderIn(<PlanTab workspaceId={FREE} />);
    expect(
      await screen.findByText("녹음 중인 회의는 끝난 뒤 사용량에 반영됩니다")
    ).toBeInTheDocument();
  });

  it("Pro 도 끝나지 않은 녹음이 있으면 같은 한 줄을 알린다", async () => {
    serveUsage(
      freeUsage({
        periodKind: "PAID",
        unlimited: true,
        allowanceSamples: null,
        remainingSamples: null,
        allowanceMinutes: null,
        remainingMinutes: null,
        recordingInProgress: true,
      }),
      PAID
    );
    renderIn(<PlanTab workspaceId={PAID} />);
    expect(
      await screen.findByText("녹음 중인 회의는 끝난 뒤 사용량에 반영됩니다")
    ).toBeInTheDocument();
    expect(screen.getByText("무제한")).toBeInTheDocument();
  });

  it("Pro 는 무제한과 참고용 사용 시간만 그리고 막대는 없다", async () => {
    renderIn(<PlanTab workspaceId={PAID} />);
    expect(await screen.findByText("5시간 30분")).toBeInTheDocument();
    expect(screen.getByText("이번 달 녹음")).toBeInTheDocument();
    expect(screen.getByText("무제한")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText(/초기화/)).not.toBeInTheDocument();
  });

  it("사용량 조회가 집행 대상이 아니라고 하면 아무것도 그리지 않는다", async () => {
    serveUsage({ ...freeUsage(), enforced: false, usedMinutes: null });
    renderIn(<PlanTab workspaceId={FREE} />);
    await screen.findByRole("heading", { name: "요금제 비교" });
    expect(screen.queryByText("이번 달 녹음")).not.toBeInTheDocument();
  });

  it("사용량 조회가 실패해도 요금제는 그리고 그 자리만 다시 시도를 준다", async () => {
    server.use(
      http.get(`*/v1/workspaces/${FREE}/billing/usage`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: "INTERNAL_SERVER_ERROR",
              message: "x",
              details: null,
            },
          },
          { status: 500 }
        )
      )
    );
    renderIn(<PlanTab workspaceId={FREE} />);
    expect(
      await screen.findByRole("heading", { name: "요금제 비교" })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /다시 시도/ })
    ).toBeInTheDocument();
  });

  it("로딩 중에는 실제 블록과 같은 자리의 skeleton 을 그린다", async () => {
    server.use(
      http.get(`*/v1/workspaces/${FREE}/billing/usage`, async () => {
        await delay(300);
        return HttpResponse.json({
          success: true,
          data: freeUsage(),
          error: null,
        });
      })
    );
    renderIn(<PlanTab workspaceId={FREE} />);
    expect(
      await screen.findByLabelText("사용량을 불러오는 중")
    ).toBeInTheDocument();
    expect(await usageValue("45분")).toBe("45분/ 2시간");
    expect(
      screen.queryByLabelText("사용량을 불러오는 중")
    ).not.toBeInTheDocument();
  });
});
