import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DesktopAppearanceSettings } from "./desktop-appearance-settings";
const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/track", () => ({ track }));
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, "heymoaDesktop");
  track.mockClear();
});
it("keeps opacity in settings, previews the chosen value and saves only on commit", async () => {
  const setPanelOpacity = vi.fn(async (value) => value);
  Object.defineProperty(window, "heymoaDesktop", {
    configurable: true,
    value: { getPanelOpacity: async () => 0.8, setPanelOpacity },
  });
  render(<DesktopAppearanceSettings />);
  const slider = screen.getByRole("slider", { name: "팝업 불투명도" });
  await waitFor(() => expect(slider).toHaveValue("80"));
  fireEvent.change(slider, { target: { value: "65" } });
  expect(setPanelOpacity).not.toHaveBeenCalled();
  fireEvent.pointerUp(slider);
  await waitFor(() => expect(setPanelOpacity).toHaveBeenCalledWith(0.65));
  expect(track).toHaveBeenCalledWith("desktop_panel_opacity_changed", {
    opacity: 0.65,
  });
  setPanelOpacity.mockRejectedValueOnce(new Error("disk full"));
  fireEvent.change(slider, { target: { value: "70" } });
  fireEvent.keyUp(slider, { key: "ArrowRight" });
  await screen.findByRole("alert");
  expect(slider).toHaveValue("65");
});
it("old desktop versions get an update hint without a broken slider", () => {
  render(<DesktopAppearanceSettings />);
  expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  expect(screen.getByText(/최신 데스크톱 앱/)).toBeInTheDocument();
});
