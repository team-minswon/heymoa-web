import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

describe("design tokens (globals.css)", () => {
  const required = [
    "--shadow-e2",
    "--shadow-e3",
    "--radius-panel",
    "--radius-block",
    "--radius-control",
    "--radius-chip",
    "--text-screen-title",
    "--text-note-title",
    "--text-section",
    "--text-panel-title",
    "--text-read",
    "--el-highlight",
  ];

  it.each(required)("defines %s", (token) => {
    expect(css).toContain(token);
  });

  describe("상태색 틴트 대비", () => {
    const tokenValue = (name: string) =>
      css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];

    const channels = (hex: string) =>
      [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
    const linear = (value: number) => {
      const channel = value / 255;
      return channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    };
    const luminance = ([r, g, b]: number[]) =>
      0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
    const tintOnWhite = (rgb: number[]) =>
      rgb.map((channel) => channel * 0.1 + 255 * 0.9);
    const contrast = (fg: number[], bg: number[]) => {
      const [brighter, darker] = [luminance(fg), luminance(bg)].sort(
        (a, b) => b - a
      );
      return (brighter + 0.05) / (darker + 0.05);
    };

    it.each([
      ["--el-success", "--el-success-strong"],
      ["--el-error", "--el-error-strong"],
    ])("%s 틴트 위의 %s 글자가 AA를 넘는다", (tintToken, textToken) => {
      const tint = tokenValue(tintToken);
      const text = tokenValue(textToken);
      expect(tint, `${tintToken} missing`).toBeDefined();
      expect(text, `${textToken} missing`).toBeDefined();

      const ratio = contrast(channels(text!), tintOnWhite(channels(tint!)));
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });
});
