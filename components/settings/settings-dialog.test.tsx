import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsDialog } from "@/components/settings/settings-dialog";

vi.mock("@/components/settings/account-settings-form", () => ({
  AccountSettingsForm: () => <p>계정 내용</p>,
}));
vi.mock("@/components/settings/workspace-settings-form", () => ({
  WorkspaceSettingsForm: () => <p>워크스페이스 내용</p>,
}));

describe("SettingsDialog", () => {
  it("switches between the two supported sections without navigation", () => {
    render(
      <SettingsDialog open onOpenChange={vi.fn()} workspaceId="01K0000000000" />
    );
    expect(screen.getByText("계정 내용")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "워크스페이스 일반" }));
    expect(screen.getByText("워크스페이스 내용")).toBeInTheDocument();
  });
});
