// Local experiment only. Start a production MSW build on :3102, then run with node.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const url =
  "http://localhost:3102/w/01K0000000000/notes/01K0000000020?view=side&tab=transcript";
const note = "01K0000000020";
const output = "/tmp/transcript-virtual-experiment";
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  try {
    const results = [];
    for (let run = 0; run < 3; run++) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      });
      page.setDefaultTimeout(15000);
      await page.addInitScript((note) => {
        window.__experiment = { gates: [], requests: [], timings: {} };
        const fetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
          const path = new URL(
            input instanceof Request ? input.url : String(input),
            location.href
          ).pathname;
          window.__experiment.requests.push(path);
          const response = await fetch(input, init);
          if (path !== `/v1/notes/${note}/transcript`) return response;
          const json = response.json.bind(response);
          response.json = async () => {
            await new Promise((resolve) =>
              window.__experiment.gates.push(resolve)
            );
            const parse = performance.now();
            const data = await json();
            const t = window.__experiment.timings;
            t.json = performance.now() - parse;
            const start = performance.now();
            const observer = new MutationObserver(() => {
              const rows = document.querySelectorAll(
                '[data-testid="archive-transcript-block"]'
              );
              if (!rows.length) return;
              observer.disconnect();
              t.commit = performance.now() - start;
              requestAnimationFrame(() =>
                requestAnimationFrame(() => {
                  t.frame = performance.now() - start;
                  t.rows = rows.length;
                  t.dom = document.querySelectorAll("*").length;
                })
              );
            });
            observer.observe(document.body, { childList: true, subtree: true });
            return data;
          };
          return response;
        };
      }, note);
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__experiment.gates.length > 0);
      await expect(
        page.getByRole("tab", { name: "스크립트", exact: true })
      ).toHaveAttribute("aria-selected", "true");
      await page.evaluate(() =>
        window.__experiment.gates.splice(0).forEach((f) => f())
      );
      await page.waitForFunction(
        () => window.__experiment.timings.frame !== undefined
      );
      results.push(await page.evaluate(() => window.__experiment.timings));
      await page.close();
    }
    console.log("MEASUREMENTS", JSON.stringify(results));
    fs.writeFileSync(
      `${output}/measurements-${process.env.EXPERIMENT_LABEL || "virtual"}.json`,
      JSON.stringify(results, null, 2)
    );
    if (process.env.MEASURE_ONLY === "true") return;
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      permissions: ["clipboard-read", "clipboard-write"],
    });
    page.setDefaultTimeout(15000);
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));
    const checks = [];
    const checked = (name) => {
      checks.push(name);
      console.log("PASS", name);
    };
    await page.goto(`${url}&segment=01K0000000063`);
    const target = page.locator('[data-segment-id="01K0000000063"]');
    await expect(target).toBeFocused();
    await expect(target).toBeInViewport();
    assert((await page.getByTestId("archive-transcript-block").count()) < 100);
    checked("offscreen citation 6000 + keyboard focus + bounded DOM");
    await page
      .getByRole("button", { name: "전체 화면으로 보기", exact: true })
      .click();
    await expect(target).toBeInViewport();
    await page
      .getByRole("button", { name: "사이드 뷰로 보기", exact: true })
      .click();
    await expect(target).toBeInViewport();
    checked("side/full resize preserves citation");
    await page.getByRole("button", { name: "맨 아래로", exact: true }).click();
    const last = page.locator('[data-segment-id="01K0000000064"]');
    await expect(last).toBeInViewport();
    await expect
      .poll(() =>
        last.evaluate((element) => {
          const viewport = element.closest(
            '[data-slot="scroll-area-viewport"]'
          );
          return (
            element.getBoundingClientRect().bottom -
            viewport.getBoundingClientRect().bottom
          );
        })
      )
      .toBeLessThanOrEqual(1);
    checked("bottom button fully reveals final row");
    await page.getByRole("button", { name: "검색", exact: true }).click();
    await last.evaluate((e) => {
      e.closest('[data-slot="scroll-area-viewport"]').scrollTop -= 2000;
    });
    await page.getByRole("button", { name: "맨 아래로", exact: true }).click();
    await expect
      .poll(() =>
        last.evaluate((element) => {
          const viewport = element.closest(
            '[data-slot="scroll-area-viewport"]'
          );
          return (
            element.getBoundingClientRect().bottom -
            viewport.getBoundingClientRect().bottom
          );
        })
      )
      .toBeLessThanOrEqual(1);
    await page.getByRole("button", { name: "검색 닫기", exact: true }).click();
    checked("expanded search toolbar preserves bottom alignment");
    await last.evaluate((element) => {
      element.closest('[data-slot="scroll-area-viewport"]').scrollTop = 125000;
    });
    await page.waitForTimeout(300);
    const reading = await page
      .getByTestId("archive-transcript-block")
      .first()
      .evaluate((element) => {
        const viewport = element.closest('[data-slot="scroll-area-viewport"]');
        const toolsBottom = viewport
          .querySelector('[data-testid="transcript-tools"]')
          .getBoundingClientRect().bottom;
        const visible = [
          ...viewport.querySelectorAll("[data-segment-id]"),
        ].find(
          (e) =>
            e.getBoundingClientRect().bottom > toolsBottom &&
            e.getBoundingClientRect().top <
              viewport.getBoundingClientRect().bottom
        );
        return {
          id: visible.dataset.segmentId,
          offset: visible.getBoundingClientRect().top - toolsBottom,
        };
      });
    for (const name of ["전체 화면으로 보기", "사이드 뷰로 보기"]) {
      await page.getByRole("button", { name, exact: true }).click();
      const anchor = page.locator(`[data-segment-id="${reading.id}"]`);
      await expect
        .poll(() =>
          anchor.evaluate((e, position) => {
            const viewport = e.closest('[data-slot="scroll-area-viewport"]');
            return Math.abs(
              e.getBoundingClientRect().top -
                viewport
                  .querySelector('[data-testid="transcript-tools"]')
                  .getBoundingClientRect().bottom -
                position
            );
          }, reading.offset)
        )
        .toBeLessThan(4);
    }
    checked(
      "ordinary reading anchor survives width changes after distant scrolling"
    );
    const clipboardButton = page.getByRole("button", {
      name: "복사",
      exact: true,
    });
    await expect(clipboardButton).toBeEnabled();
    await clipboardButton.click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toContain("가입 후 첫 회의를");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    assert(copied.includes("실험 발화 8112:"));
    assert(copied.includes("재방문 사용자는"));
    assert.equal((copied.match(/\[\d+:\d+(?::\d+)?\]/g) || []).length, 8114);
    checked("copy includes every segment, not only mounted rows");
    await page.getByRole("button", { name: "미지정 1", exact: true }).click();
    const unassigned = page.locator('[data-segment-id="experiment-1"]');
    await expect(unassigned).toBeFocused();
    await expect(unassigned).toBeInViewport();
    checked("next unassigned speaker jump");
    await unassigned.getByTestId("speaker-assign-trigger").click();
    await expect(page.getByPlaceholder("이름으로 검색")).toBeVisible();
    await page.getByRole("radio", { name: "현재 발화에만 적용" }).check();
    const option = page.getByRole("option").filter({ hasText: "테스트 유저" });
    await expect(option).toBeVisible();
    await option.click();
    await expect(
      unassigned.getByTestId("speaker-assign-trigger")
    ).toContainText("테스트 유저");
    const state = await page.evaluate(
      async () =>
        (await (await fetch("/v1/notes/01K0000000020/transcript")).json()).data
    );
    assert(
      state.segments.find((s) => s.segmentId === "experiment-1")
        .assignedParticipantId
    );
    assert.equal(
      state.segments.find((s) => s.segmentId === "experiment-2")
        .assignedParticipantId,
      null
    );
    checked("individual assignment changes only selected segment");
    await unassigned.getByTestId("speaker-assign-trigger").click();
    await page.getByRole("radio", { name: "현재 발화에만 적용" }).check();
    await page
      .getByRole("button", { name: "개별 지정 해제", exact: true })
      .click();
    await expect(
      unassigned.getByTestId("speaker-assign-trigger")
    ).toContainText("화자 B");
    checked("individual assignment clear restores label");
    await unassigned.getByTestId("speaker-assign-trigger").click();
    const viewport = page
      .locator(
        '[data-slot="tabs-content"][role="tabpanel"] [data-slot="scroll-area-viewport"]'
      )
      .first();
    await viewport.evaluate((e) => {
      e.scrollTop = 50000;
    });
    await expect(page.getByPlaceholder("이름으로 검색")).toBeVisible();
    await expect(unassigned).toBeAttached();
    checked("open speaker menu survives scroll");
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder("이름으로 검색")).toBeHidden();
    await page.getByRole("button", { name: "화자", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "화자", exact: true })
    ).toBeVisible();
    await page
      .getByTestId("speaker-panel-row")
      .filter({ hasText: "화자 B" })
      .getByRole("button", { name: "지정하러 가기" })
      .click();
    await expect(unassigned).toBeFocused();
    await expect(unassigned).toBeInViewport();
    checked("speaker panel first utterance navigation");
    await unassigned.getByTestId("speaker-assign-trigger").click();
    await page.getByRole("option").filter({ hasText: "테스트 유저" }).click();
    await expect(
      unassigned.getByTestId("speaker-assign-trigger")
    ).toContainText("테스트 유저");
    const assigned = await page.evaluate(
      async () =>
        (await (await fetch("/v1/notes/01K0000000020/transcript")).json()).data
    );
    assert(
      assigned.diarization.speakers.find((s) => s.label === "B")
        .assignedParticipantId
    );
    checked("whole-label assignment and query refresh");
    await unassigned.getByTestId("speaker-assign-trigger").click();
    await page.getByRole("radio", { name: "현재 발화에만 적용" }).check();
    await page.getByRole("option").filter({ hasText: "테스트 유저" }).click();
    await expect
      .poll(() =>
        page.evaluate(
          async () =>
            (
              await (await fetch("/v1/notes/01K0000000020/transcript")).json()
            ).data.segments.find((s) => s.segmentId === "experiment-1")
              .assignedParticipantId
        )
      )
      .toBeTruthy();
    await unassigned.getByTestId("speaker-assign-trigger").click();
    await page.getByRole("option").filter({ hasText: "테스트 유저" }).click();
    const confirmation = page.getByRole("alertdialog");
    await expect(confirmation).toBeVisible();
    await confirmation
      .getByRole("button", { name: "취소", exact: true })
      .click();
    assert(
      await page.evaluate(
        async () =>
          (
            await (await fetch("/v1/notes/01K0000000020/transcript")).json()
          ).data.segments.find((s) => s.segmentId === "experiment-1")
            .assignedParticipantId
      )
    );
    await unassigned.getByTestId("speaker-assign-trigger").click();
    await page.getByRole("option").filter({ hasText: "테스트 유저" }).click();
    await confirmation
      .getByRole("button", { name: "모든 발화에 적용", exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          async () =>
            (
              await (await fetch("/v1/notes/01K0000000020/transcript")).json()
            ).data.segments.find((s) => s.segmentId === "experiment-1")
              .assignedParticipantId
        )
      )
      .toBeNull();
    checked(
      "whole-label overwrite confirmation: cancel preserves override, confirm removes it"
    );

    assert.equal(
      await page.evaluate(() =>
        window.find("실험 발화 8000:", false, false, true)
      ),
      false
    );
    await page
      .getByRole("button", { name: "전체 텍스트 보기", exact: true })
      .click();
    await expect(page.getByTestId("archive-transcript-block")).toHaveCount(
      8114
    );
    assert.equal(
      await page.evaluate(() =>
        window.find("실험 발화 8000:", false, false, true)
      ),
      true
    );
    const selected = await page.evaluate(() => {
      const rows = document.querySelectorAll(
        '[data-testid="archive-transcript-block"]'
      );
      const range = document.createRange();
      range.setStartBefore(rows[0]);
      range.setEndAfter(rows[rows.length - 1]);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      return selection.toString();
    });
    assert(selected.includes("실험 발화 8000:"));
    assert(selected.includes("재방문 사용자는"));
    checked("full text mode enables native find and full range selection");
    await page.evaluate(() => {
      getSelection().removeAllRanges();
      // Chromium window.find selects text but does not scroll overflow areas,
      // even in a plain HTML control. Explicitly visit the found row.
      const found = window.find("실험 발화 8000:", false, false, true);
      if (!found) throw new Error("Full text search missed row 8000");
      getSelection()
        .anchorNode.parentElement.closest("article")
        .scrollIntoView({ block: "center" });
    });
    await expect(
      page.locator('[data-segment-id="experiment-8000"]')
    ).toBeInViewport();
    await page
      .getByRole("button", { name: "빠르게 보기", exact: true })
      .click();
    await expect(
      page.locator('[data-segment-id="experiment-8000"]')
    ).toBeInViewport();
    checked(
      "visited full text search destination survives return to virtual mode"
    );
    await expect
      .poll(() => page.getByTestId("archive-transcript-block").count())
      .toBeLessThan(100);
    await page.getByRole("tab", { name: "정보", exact: true }).click();
    await expect(
      page.getByRole("tab", { name: "정보", exact: true })
    ).toHaveAttribute("aria-selected", "true");
    await page.evaluate((note) => {
      const fetch = window.fetch.bind(window);
      window.__originalFetch = fetch;
      window.fetch = async (input, init) => {
        const path = new URL(
          input instanceof Request ? input.url : String(input),
          location.href
        ).pathname;
        if (path === `/v1/notes/${note}/transcript`)
          await new Promise((resolve) => (window.__release = resolve));
        return fetch(input, init);
      };
    }, note);
    await page.getByRole("tab", { name: "스크립트", exact: true }).click();
    await expect(
      page.getByRole("tab", { name: "스크립트", exact: true })
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByTestId("archive-transcript-block").first()
    ).toBeVisible();
    await page.waitForFunction(() => !!window.__release);
    await page.evaluate(() => window.__release());
    await page.evaluate(() => {
      window.fetch = window.__originalFetch;
    });
    checked("cached transcript tab visible before held refetch completes");
    const settled = async () =>
      page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))
          )
      );
    for (let round = 0; round < 3; round++) {
      await page.getByRole("tab", { name: "요약", exact: true }).click();
      await expect(
        page.getByRole("tab", { name: "요약", exact: true })
      ).toHaveAttribute("aria-selected", "true");
      await page.getByRole("tab", { name: "타임라인", exact: true }).click();
      await expect(
        page.getByRole("tab", { name: "타임라인", exact: true })
      ).toHaveAttribute("aria-selected", "true");
      await page.getByRole("tab", { name: "스크립트", exact: true }).click();
      await page
        .getByRole("button", { name: "전체 화면으로 보기", exact: true })
        .click();
      await settled();
      await page
        .getByRole("button", { name: "사이드 뷰로 보기", exact: true })
        .click();
      await settled();
      const vp = page
        .locator(
          '[data-slot="tabs-content"][role="tabpanel"] [data-slot="scroll-area-viewport"]'
        )
        .first();
      for (const fraction of [1, 0.2, 0.75, 0]) {
        await vp.evaluate((e, f) => {
          e.scrollTop = (e.scrollHeight - e.clientHeight) * f;
        }, fraction);
        await settled();
        assert(
          (await page.getByTestId("archive-transcript-block").count()) < 100
        );
        assert(
          await page.getByTestId("archive-transcript-block").evaluateAll((es) =>
            es.some((e) => {
              const r = e.getBoundingClientRect();
              return r.bottom > 100 && r.top < innerHeight;
            })
          )
        );
      }
    }
    checked(
      "three mixed tab/resize/rapid-scroll rounds without blank viewport or DOM growth"
    );
    await page.keyboard.press("Tab");
    assert(await page.evaluate(() => document.activeElement !== document.body));
    checked("keyboard focus remains in document after tab and scroll stress");
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${url}&segment=01K0000000065`);
      const long = page.locator('[data-segment-id="01K0000000065"]');
      await expect(long).toBeFocused();
      await expect(long).toBeInViewport();
      await settled();
      assert(
        await long.evaluate((e) => {
          const vp = e.closest('[data-slot="scroll-area-viewport"]');
          return vp.scrollWidth <= vp.clientWidth + 1;
        })
      );
      await page
        .getByRole("button", { name: "전체 화면으로 보기", exact: true })
        .click();
      await settled();
      await expect(long).toBeInViewport();
      await page
        .getByRole("button", { name: "사이드 뷰로 보기", exact: true })
        .click();
      await settled();
      await expect(long).toBeInViewport();
      checked(`long multiline citation and width toggle at ${width}px`);
    }
    const beforeSearch = [];
    const capture = (request) => {
      if (request.url().includes(`/v1/notes/${note}/transcript`))
        beforeSearch.push(request.url());
    };
    page.on("request", capture);
    await page.getByRole("button", { name: "검색", exact: true }).click();
    const search = page.getByRole("textbox", { name: "전사 검색어" });
    await search.fill("실험 발화");
    await search.press("Enter");
    const previous = page.getByRole("button", { name: "이전 검색 결과" });
    await previous.focus();
    await previous.press("Enter");
    await expect(
      page.locator('[data-segment-id="experiment-8112"]')
    ).toBeInViewport();
    const closeSearch = page.getByRole("button", { name: "검색 닫기" });
    await closeSearch.focus();
    await closeSearch.press("Enter");
    await expect(search).toHaveCount(0);
    await page.getByRole("button", { name: "검색", exact: true }).click();
    checked("keyboard Enter activates previous-result and close buttons");
    await search.fill("실험 발화 8000:");
    await search.press("Enter");
    await expect(
      page.locator(`[data-segment-id="experiment-8000"]`)
    ).toBeInViewport();
    await expect(search).toBeFocused();
    await expect(
      page.getByRole("status").filter({ hasText: "1/1" })
    ).toBeVisible();
    await page
      .getByRole("button", { name: "다음 검색 결과", exact: true })
      .click();
    await expect(search).toBeFocused();
    await search.fill("없는 전사 검색어 987654321");
    await expect(
      page.getByRole("button", { name: "다음 검색 결과", exact: true })
    ).toBeDisabled();
    await search.press("Escape");
    await expect(search).toBeHidden();
    await expect(
      page.getByRole("tab", { name: "스크립트", exact: true })
    ).toBeVisible();
    assert.equal(
      beforeSearch.length,
      0,
      "Local search must not request transcripts"
    );
    page.off("request", capture);
    checked(
      "local search reaches offscreen row, retains input focus, handles empty results and Escape without HTTP"
    );
    await page.addInitScript(() => {
      const original = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const response = await original(...args);
        if (!response.url.endsWith("/01K0000000020/transcript"))
          return response;
        const json = response.json.bind(response);
        response.json = async () => {
          const data = await json();
          data.data.segments.find(
            (s) => s.segmentId === "experiment-2700"
          ).text = "아주 긴 합성 발화의 중간 위치를 보존합니다. ".repeat(100);
          return data;
        };
        return response;
      };
    });
    await page.setViewportSize({ width: 390, height: 600 });
    await page.goto(`${url}&segment=experiment-2700`);
    const huge = page.locator(`[data-segment-id="experiment-2700"]`);
    await expect(huge).toBeInViewport();
    const middle = await huge.evaluate((e) => {
      const vp = e.closest(`[data-slot="scroll-area-viewport"]`);
      vp.scrollTop +=
        e.getBoundingClientRect().top - vp.getBoundingClientRect().top + 700;
      return e.getBoundingClientRect().top - vp.getBoundingClientRect().top;
    });
    assert(middle < -600);
    for (const name of ["전체 텍스트 보기", "빠르게 보기"]) {
      await page.getByRole("button", { name, exact: true }).click();
      await expect
        .poll(() =>
          huge.evaluate((e, position) => {
            const vp = e.closest(`[data-slot="scroll-area-viewport"]`);
            return Math.abs(
              e.getBoundingClientRect().top -
                vp.getBoundingClientRect().top -
                position
            );
          }, middle)
        )
        .toBeLessThan(3);
    }
    checked(
      "view mode switches preserve the middle of a transcript taller than the viewport"
    );
    assert.deepEqual(pageErrors, [], "Browser runtime errors");
    await page.screenshot({ path: `${output}/virtual.png` });
    fs.writeFileSync(`${output}/checks.json`, JSON.stringify(checks, null, 2));
    await page.close();
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
