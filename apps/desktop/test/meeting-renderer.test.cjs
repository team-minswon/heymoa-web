const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const snapshot = () => ({ noteId: "note-a", title: "회의 A", loading: false, failed: false, reconnecting: false, total: 1,
  items: [{ id: "item-a", tone: "task", label: "할 일", content: "배포 확인", atMs: 1000, citations: [{ atMs: 1000, text: "<img src=x onerror=alert(1)>" }] }] });
function fixture(t, reduced = false) {
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname, "../dist/meeting.html"), "utf8"), { runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const actions = []; let receive; const animations = [];
  dom.window.requestAnimationFrame = (callback) => { callback(); return 0; };
  dom.window.HTMLElement.prototype.getAnimations = () => [{ finished: new Promise((resolve) => animations.push(resolve)) }];
  dom.window.matchMedia = () => ({ matches: reduced });
  dom.window.heymoaMeeting = { read: () => new Promise(() => {}), action: async (value) => { actions.push(value); }, subscribe: (listener) => { receive = listener; return () => {}; } };
  dom.window.eval(fs.readFileSync(path.join(__dirname, "../dist/meeting-renderer.js"), "utf8"));
  return { window: dom.window, document: dom.window.document, actions,
    finish: async () => { animations.splice(0).forEach((resolve) => resolve()); await new Promise(setImmediate); },
    update: (timeline, canStop = timeline !== null) => receive({ timeline, label: "녹음 중", elapsed: "1:00", warning: null, canStop, stale: false }) };
}
test("real renderer keeps an expanded row across updates, reveals text after space, and renders untrusted content only as text", async (t) => {
  const f = fixture(t); const value = snapshot(); f.update(value);
  const button = f.document.querySelector(".summary"), detail = f.document.querySelector(".detail"), text = f.document.querySelector(".quote-text");
  button.click(); assert.equal(button.getAttribute("aria-expanded"), "true"); assert.equal(detail.inert, true); assert.equal(text.classList.contains("revealed"), false);
  await f.finish(); assert.equal(detail.inert, false); assert.equal(text.classList.contains("revealed"), true);
  button.click(); await f.finish(); assert.equal(detail.inert, true); assert.equal(text.classList.contains("revealed"), false);
  button.click(); await f.finish(); f.update({ ...value, items: [...value.items, { ...value.items[0], id: "item-b" }], total: 2 });
  assert.equal(f.document.querySelector(".summary"), button); assert.equal(button.getAttribute("aria-expanded"), "true");
  assert.equal(f.document.querySelector(".citation span").textContent, value.items[0].citations[0].text); assert.equal(f.document.querySelector(".citation img"), null);
  f.update(null); assert.equal(f.document.querySelectorAll("article").length, 0); assert.equal(f.document.querySelector("#stop").disabled, true);
});
test("reduced motion reveals immediately; filters, fixed stop and Escape actions stay separate", (t) => {
  const f = fixture(t, true); f.update(snapshot()); f.document.querySelector(".summary").click(); assert.equal(f.document.querySelector(".detail").inert, false);
  [...f.document.querySelectorAll("nav button")].find((button) => button.textContent === "결정").click(); assert.equal(f.document.querySelectorAll("article").length, 0);
  f.document.querySelector("#stop").click(); assert.deepEqual(f.actions, ["stop"]); assert.equal(f.document.querySelector("#stop").disabled, true);
  f.document.dispatchEvent(new f.window.KeyboardEvent("keydown", { key: "Escape" })); assert.deepEqual(f.actions, ["stop", "hide"]);
});

test("active recording without a web snapshot remains a waiting state", (t) => {
  const f = fixture(t); f.update(null, true);
  assert.match(f.document.querySelector("#empty").textContent, /타임라인을 기다리고/);
  assert.equal(f.document.querySelector("#stop").disabled, false);
});

// Exercise real CSS rather than manufacturing transitionend events.
test("Chromium reveals after same-frame close/open and preserves scroll intent", async (t) => {
  const { chromium } = require("@playwright/test");
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.addInitScript(() => {
    window.heymoaMeeting = {
      read: () => new Promise(() => {}), action: async () => {},
      subscribe: (receive) => { window.testReceive = receive; return () => {}; },
    };
  });
  await page.goto(require("node:url").pathToFileURL(path.join(__dirname, "../dist/meeting.html")).href);
  const value = snapshot();
  const publish = (timeline) => page.evaluate((timeline) => window.testReceive({ timeline, label: "녹음 중", elapsed: "1:00", warning: null, canStop: true, stale: false }), timeline);
  await publish(value);
  await page.locator(".summary").click();
  await page.waitForFunction(() => !document.querySelector(".detail").inert);
  await page.evaluate(() => { const button = document.querySelector(".summary"); button.click(); button.click(); });
  await page.waitForFunction(() => !document.querySelector(".detail").inert && getComputedStyle(document.querySelector(".quote-text")).opacity === "1");
  const many = { ...value, total: 60, items: Array.from({ length: 60 }, (_, i) => ({ ...value.items[0], id: `item-${i}`, atMs: i * 1000 })) };
  await publish(many);
  assert.equal(await page.locator("#latest").isVisible(), false);
  await page.evaluate(() => { const scroll = document.querySelector("#scroll"); scroll.scrollTop = 0; scroll.dispatchEvent(new Event("scroll")); });
  await publish({ ...many, total: 61, items: [...many.items, { ...value.items[0], id: "last" }] });
  assert.equal(await page.locator("#latest").isVisible(), true);
  assert.equal(await page.locator("#scroll").evaluate((node) => node.scrollTop), 0);
  await page.locator("#latest").click();
  assert.equal(await page.locator("#latest").isVisible(), false);
});
