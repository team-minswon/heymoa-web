import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GlobalRecordingIndicator } from "@/components/transcription/global-recording-indicator";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/api/generated/workspace/workspace", () => ({
  useListWorkspaces: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: { items: [{ workspaceId: "01K0000000000", isDefault: true }] },
      },
    },
  }),
}));
vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => ({
    session: { noteId: "01K0000000002", status: "STREAMING" },
    elapsedMs: 1200,
    level: 0.42,
    microphoneState: "recording",
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
  }),
}));

describe("GlobalRecordingIndicator", () => {
  it("renders input level as an accessible meter", () => {
    render(<GlobalRecordingIndicator />);
    expect(screen.getByRole("meter", { name: "마이크 입력" })).toHaveAttribute(
      "aria-valuenow",
      "42"
    );
    expect(screen.getByText("녹음 중")).toBeInTheDocument();
  });
});
