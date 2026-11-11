const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const snapshot = () => ({ noteId: "note-a", title: "회의 A", loading: false, failed: false, reconnecting: false, total: 1,
  items: [{ id: "item-a", tone: "task", label: "할 일", content: "배포 확인", atMs: 1000, citations: [{ atMs: 1000, text: "<img src=x onerror=alert(1)>" }] }] });
test("long elapsed time fits alongside timeline filters and row classification", async (t) => {
  const { chromium } = require("@playwright/test");
  const { pathToFileURL } = require("node:url");
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 480, height: 700 } });
  await page.addInitScript(() => {
    window.heymoaMeeting = { read: () => new Promise(() => {}), action: async () => {}, subscribe: (listener) => { window.receive = listener; return () => {}; } };
  });
  await page.goto(pathToFileURL(path.resolve(__dirname, "../dist/meeting.html")).href);
  const timeline = snapshot(); timeline.items[0].atMs = 4_680_000;
  await page.evaluate((timeline) => window.receive({ language: "en", meetings: [], timeline, label: "Recording", elapsed: "1:18:00", warning: null, canStop: true, stale: false, viewing: false, phase: "recording", unknown: false }), timeline);
  const offset = page.locator("#elapsed");
  assert.equal(await offset.textContent(), "1:18:00");
  assert.equal(await offset.evaluate(node => { const range = document.createRange(); range.selectNodeContents(node); return range.getClientRects().length; }), 1);
  assert.equal(await page.locator("article .offset").textContent(), "1:18:00");
  assert.equal(await page.locator("article .label").textContent(), "할 일");
  assert.equal(await page.locator("#filters button").count(), 5);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});
test("lost recording state is not rendered as no recording, and idle has an honest app action", (t) => {
  const f = fixture(t);
  f.update(null, false, "녹음 상태 확인 불가", { phase: null, unknown: true });
  assert.match(f.document.querySelector("#empty").textContent, /상태를 확인하지 못/);
  assert.equal(f.document.querySelector("#open").textContent, "HeyMoa 열기 ↗");
  f.update(null, false, "연결 중", { phase: "connecting" });
  assert.match(f.document.querySelector("#empty").textContent, /녹음 시작을 기다리/);
  assert.equal(f.document.querySelector("#open").textContent, "HeyMoa 열기 ↗");
  f.update(null, false, "녹음 일시정지 중", { phase: "stopping" });
  assert.match(f.document.querySelector("#empty").textContent, /전송 완료를 기다리/);
  f.update(null, false, "녹음 대기");
  assert.match(f.document.querySelector("#empty").textContent, /아직 회의록이 없습니다/);
  assert.equal(f.document.querySelector("#open").textContent, "HeyMoa 열기 ↗");
});
function fixture(t, reduced = false, read = () => new Promise(() => {})) {
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname, "../dist/meeting.html"), "utf8"), { runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const actions = []; let receive; const animations = [];
  dom.window.requestAnimationFrame = (callback) => { callback(); return 0; };
  dom.window.HTMLElement.prototype.getAnimations = () => [{ finished: new Promise((resolve) => animations.push(resolve)) }];
  dom.window.matchMedia = () => ({ matches: reduced });
  dom.window.heymoaMeeting = { read, action: async (value) => { actions.push(value); }, subscribe: (listener) => { receive = listener; return () => {}; } };
  dom.window.eval(fs.readFileSync(path.join(__dirname, "../dist/meeting-renderer.js"), "utf8"));
  return { window: dom.window, document: dom.window.document, actions,
    finish: async () => { animations.splice(0).forEach((resolve) => resolve()); await new Promise(setImmediate); },
    update: (timeline, canStop = timeline !== null, label = "녹음 중", status = {}) => receive({ meetings: [], timeline, label, elapsed: "1:00", warning: null, canStop, stale: false, viewing: false, phase: canStop ? "recording" : "idle", unknown: false, ...status }) };
}
test("real renderer keeps an expanded row across updates, uses one disclosure transition, and renders untrusted content only as text", async (t) => {
  const f = fixture(t); const value = snapshot(); f.update(value);
  const button = f.document.querySelector(".summary"), detail = f.document.querySelector(".detail"), text = f.document.querySelector(".quote-text");
  button.click(); assert.equal(button.getAttribute("aria-expanded"), "true"); assert.equal(detail.inert, false); assert.equal(text.classList.contains("revealed"), true);
  await f.finish(); assert.equal(detail.inert, false); assert.equal(text.classList.contains("revealed"), true);
  button.click(); await f.finish(); assert.equal(detail.inert, true); assert.equal(text.classList.contains("revealed"), false);
  button.click(); await f.finish(); f.update({ ...value, items: [...value.items, { ...value.items[0], id: "item-b" }], total: 2 });
  assert.equal(f.document.querySelector(".summary"), button); assert.equal(button.getAttribute("aria-expanded"), "true");
  assert.equal(f.document.querySelector(".citation span").textContent, value.items[0].citations[0].text); assert.equal(f.document.querySelector(".citation img"), null);
  f.update(null); assert.equal(f.document.querySelectorAll("article").length, 0); assert.equal(f.document.querySelector("#stop").disabled, true);
});
test("reduced motion reveals immediately; stop and Escape actions stay separate", (t) => {
  const f = fixture(t, true); f.update(snapshot()); f.document.querySelector(".summary").click(); assert.equal(f.document.querySelector(".detail").inert, false);
  assert.equal(f.document.querySelectorAll("#filters button").length, 5);
  f.document.querySelector("#stop").click(); assert.deepEqual(f.actions, ["stop"]); assert.equal(f.document.querySelector("#stop").disabled, true);
  f.document.dispatchEvent(new f.window.KeyboardEvent("keydown", { key: "Escape" })); assert.deepEqual(f.actions, ["stop", "hide"]);
});

test("active recording without a web snapshot remains a waiting state", (t) => {
  const f = fixture(t); f.update(null, true);
  assert.match(f.document.querySelector("#empty").textContent, /타임라인을 기다리고/);
  assert.equal(f.document.querySelector("#stop").disabled, false);
});

test("browsing other meetings and the list retain global recording controls and honest denied states", async t => {
 const f = fixture(t);
 const value = snapshot(); value.detail = { ownsRecording: false, ended: true, summary: { status: 'ready', lead: '지난 회의', sections: [] }, counts: { ALL: 1 }, groups: [], partial: null };
 const status = { recordingTarget: { noteId: 'live', workspaceId: 'w1' }, selection: { noteId: value.noteId, workspaceId: 'w1', requestId: 1 }, label: '녹음 중', elapsed: '2:00' };
 f.update(value, true, '녹음 중', status);
 assert.equal(f.document.querySelector('#phase').textContent, '녹음 중');
 assert.equal(f.document.querySelector('#elapsed').textContent, '2:00');
 assert.equal(f.document.querySelector('#stop').hidden, false);
 assert.equal(f.document.querySelector('#recording-note').hidden, false);
 f.document.querySelector('#recording-note').click(); assert.equal(f.actions.at(-1), 'show-recording');
 f.document.querySelector('#open').click(); assert.equal(JSON.stringify(f.actions.at(-1)), JSON.stringify({ action: 'open-selection', tab: 'summary' }));
 f.update(null, true, '녹음 중', { ...status, selection: null, meetingsStatus: 'ready', meetings: [{ workspaceId: 'w1', noteId: 'past', title: '지난 회의', startedAt: null, ended: true }] });
 assert.equal(f.document.querySelector('#meetings').hidden, false);
 assert.equal(f.document.querySelector('#stop').hidden, false);
 f.update(value, true, '녹음 중', { ...status, noteFailed: true });
 assert.equal(f.document.querySelector('#view-tabs').hidden, true);
 assert.match(f.document.querySelector('#empty').textContent, /접근 권한/);
 f.update(null, false, '녹음 대기', { meetingsStatus: 'no-workspace', language: 'en' });
 assert.match(f.document.querySelector('#empty').textContent, /Choose a workspace/);
 f.update(snapshot()); f.document.querySelector('#stop').click(); await f.finish();
 assert.equal(f.document.querySelector('#stop').disabled, true, 'RPC acknowledgement cannot re-enable pause before the native state changes');
});

test("small English window opens ended placeholders as summary and resets scroll on meeting changes", async t => {
 const { chromium } = require('@playwright/test');
 const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
 const page = await browser.newPage({ viewport: { width: 300, height: 400 } });
 await page.addInitScript(() => { window.heymoaMeeting = { read: () => new Promise(() => {}), action: async () => {}, subscribe: listener => { window.receive = listener; return () => {}; } }; });
 await page.goto(require('node:url').pathToFileURL(path.join(__dirname, '../dist/meeting.html')).href);
 const { loadingMeeting } = require('../dist/meeting-timeline');
 const waiting = loadingMeeting({ workspaceId: 'w1', noteId: 'past', title: 'Past meeting', ended: true, state: 'ENDED' }, 1);
 const publish = timeline => page.evaluate(timeline => window.receive({ language: 'en', meetings: [], timeline, label: 'Recording', elapsed: '1:18:00', canStop: true, phase: 'recording', unknown: false, warning: null, stale: false, recordingTarget: { noteId: 'live', workspaceId: 'w1' } }), timeline);
 await publish(waiting);
 assert.equal(await page.locator('#summary-tab').getAttribute('aria-pressed'), 'true');
 assert.equal(await page.locator('#filters').isVisible(), false);
 const y = await page.locator('#scroll').evaluate(node => node.getBoundingClientRect().top);
 const past = { ...waiting, loading: false, detail: { ...waiting.detail, summary: { status: 'ready', lead: 'A long summary. '.repeat(300), sections: [] } } };
 await publish(past); assert.equal(await page.locator('#scroll').evaluate(node => node.getBoundingClientRect().top), y);
 await page.locator('#scroll').evaluate(node => { node.scrollTop = node.scrollHeight; node.dispatchEvent(new Event('scroll')); });
 assert.ok(await page.locator('#scroll').evaluate(node => node.scrollTop > 0));
 await publish({ ...past, noteId: 'another' });
 assert.equal(await page.locator('#scroll').evaluate(node => node.scrollTop), 0);
 const live = snapshot(); live.items = Array.from({ length: 30 }, (_, i) => ({ ...live.items[0], id: `r${i}` })); live.total = 30;
 live.detail = { ...waiting.detail, ended: false, meetingState: 'IN_PROGRESS', ownsRecording: true, groups: [{ id: 'g', title: 'Long meeting agenda', startMs: 3723000, endMs: 4500000, itemIds: live.items.map(item => item.id) }] };
 await publish(live);
 assert.ok(await page.locator('#scroll').evaluate(node => node.scrollTop > 0));
 const rangeOverlap = await page.locator('.group-range').evaluate(node => { const a=node.getBoundingClientRect(), b=node.nextElementSibling.getBoundingClientRect(); return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; });
 assert.equal(rangeOverlap, false);
 await publish({ ...live, detail: { ...past.detail, groups: live.detail.groups } });
 assert.equal(await page.locator('#summary-tab').getAttribute('aria-pressed'), 'true');
 assert.equal(await page.locator('#scroll').evaluate(node => node.scrollTop), 0);
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});

test("long recent list starts at the top, preserves keyboard focus, and long live text follows only its own bottom", async t => {
 const { chromium } = require('@playwright/test'); const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
 const page = await browser.newPage({ viewport: { width: 420, height: 580 } });
 await page.addInitScript(() => { window.heymoaMeeting = { read: () => new Promise(() => {}), action: async action => { window.lastAction = action; }, subscribe: listener => { window.receive = listener; return () => {}; } }; });
 await page.goto(require('node:url').pathToFileURL(path.join(__dirname, '../dist/meeting.html')).href);
 const list = Array.from({ length: 20 }, (_, i) => ({ workspaceId: 'w1', noteId: `past${i}`, title: `Meeting ${i}`, startedAt: null, ended: true }));
 const publish = (timeline, meetings = list, canStop = true) => page.evaluate(({ timeline, meetings, canStop }) => window.receive({ language: 'en', meetings, meetingsStatus: 'ready', timeline, label: 'Recording', elapsed: '2:00', phase: canStop ? 'recording' : 'completed', canStop, warning: null, unknown: false, stale: false }), { timeline, meetings, canStop });
 await publish(null); assert.equal(await page.locator('#scroll').evaluate(node => node.scrollTop), 0);
 await page.locator('#scroll').evaluate(node => { node.scrollTop = 400; node.dispatchEvent(new Event('scroll')); });
 await publish(null); assert.equal(await page.locator('#scroll').evaluate(node => node.scrollTop), 400);
 await page.locator('.meeting').first().focus();
 await publish(null, list.map((meeting, i) => i === 0 ? { ...meeting, title: 'Updated title' } : meeting));
 assert.equal(await page.evaluate(() => document.activeElement.dataset.noteId), 'past0');
 const value = snapshot(); value.noteId = 'past0'; value.detail = { ended: false, meetingState: 'IN_PROGRESS', ownsRecording: true, counts: { ALL: 1 }, groups: [], partial: { confirmedText: 'Long live transcript. '.repeat(100), pendingText: 'latest' } };
 await publish(value); assert.equal(await page.evaluate(() => document.activeElement.id), 'title');
 const live = page.locator('#live-transcript p'); assert.ok(await live.evaluate(node => node.scrollTop > 0));
 assert.ok(await live.evaluate(node => node.scrollHeight - node.clientHeight - node.scrollTop <= 2));
 await live.evaluate(node => { node.scrollTop = 0; }); value.detail.partial.pendingText += ' more words'; await publish(value);
 assert.equal(await live.evaluate(node => node.scrollTop), 0);
 await page.locator('#back').focus(); await publish(null);
 assert.equal(await page.evaluate(() => document.activeElement.dataset.noteId), 'past0');
 assert.equal(await page.locator('#scroll').evaluate(node => node.scrollTop), 0);
 await page.locator('#open').click(); assert.equal(await page.evaluate(() => window.lastAction), 'show-app');
 await page.locator('#stop').focus(); await page.locator('#stop').press('Enter');
 await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
 await publish(null, list, false); assert.equal(await page.evaluate(() => document.activeElement.dataset.noteId), 'past0');
 await publish(value); await page.locator('#stop').focus(); await page.locator('#stop').press('Enter');
 await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
 await publish(value, list, false); assert.equal(await page.evaluate(() => document.activeElement.id), 'back');
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
  const alignment = await page.locator("#close").evaluate((button) => {
    const icon = button.querySelector("svg").getBoundingClientRect();
    const bounds = button.getBoundingClientRect();
    return {
      x: (icon.left + icon.right - bounds.left - bounds.right) / 2,
      y: (icon.top + icon.bottom - bounds.top - bounds.bottom) / 2,
    };
  });
  assert.equal(alignment.x, 0);
  assert.equal(alignment.y, 0);
  const value = snapshot();
  const publish = (timeline) => page.evaluate((timeline) => window.testReceive({ meetings: [], timeline, phase: "recording", unknown: false, label: "녹음 중", elapsed: "1:00", warning: null, canStop: true, stale: false }), timeline);
  await publish(value);
  await page.locator(".summary").click();
  await page.waitForFunction(() => !document.querySelector(".detail").inert);
  await page.evaluate(() => { const button = document.querySelector(".summary"); button.click(); button.click(); });
  await page.waitForFunction(() => !document.querySelector(".detail").inert && getComputedStyle(document.querySelector(".quote-text")).opacity === "1");
  const many = { ...value, total: 60, items: Array.from({ length: 60 }, (_, i) => ({ ...value.items[0], id: `item-${i}`, atMs: i * 1000 })) };
  await publish(many);
  await page.locator("#latest").click();
  assert.equal(await page.locator("#latest").isVisible(), false);
  await page.evaluate(() => { const scroll = document.querySelector("#scroll"); scroll.scrollTop = 0; scroll.dispatchEvent(new Event("scroll")); });
  await publish({ ...many, total: 61, items: [...many.items, { ...value.items[0], id: "last" }] });
  assert.equal(await page.locator("#latest").isVisible(), true);
  const floating = await page.locator("#latest").evaluate((node) => {
    const bounds = node.getBoundingClientRect();
    return { center: (bounds.left + bounds.right) / 2, viewportCenter: innerWidth / 2, bottom: bounds.bottom, footerTop: document.querySelector("footer").getBoundingClientRect().top };
  });
  assert.ok(floating.bottom > floating.footerTop, "latest navigation stays in the footer instead of covering meeting text");
  assert.equal(await page.locator("#scroll").evaluate((node) => node.scrollTop), 0);
  await page.locator("#latest").click();
  assert.equal(await page.locator("#latest").isVisible(), false);
});


test("popover title follows inactive recording status and only active sessions use a meeting heading", (t) => {
  const f = fixture(t);
  assert.equal(f.document.querySelector("#title").textContent, "녹음 대기");
  f.update(null, false, "녹음 대기");
  assert.equal(f.document.querySelector("#title").textContent, "최근 회의록");
  f.update(null, false, "전송 중");
  assert.equal(f.document.querySelector("#title").textContent, "최근 회의록");
  f.update(null, true);
  assert.equal(f.document.querySelector("#title").textContent, "최근 회의록");
  f.update(snapshot(), true);
  assert.equal(f.document.querySelector("#title").textContent, "회의 A");
});


test("Chromium aligns compact timeline metadata with optional evidence", async (t) => {
  const { chromium } = require("@playwright/test");
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 460, height: 620 }, reducedMotion: "reduce" });
  await page.addInitScript(() => {
    window.heymoaMeeting = { read: () => new Promise(() => {}), action: async () => {}, subscribe: (receive) => { window.testReceive = receive; return () => {}; } };
  });
  await page.goto(require("node:url").pathToFileURL(path.join(__dirname, "../dist/meeting.html")).href);
  const value = snapshot(); value.items[0].content = "클룸은 첫 번째 협박 이후 하루 동안 아무 말도 하지 않았다. 회의에서 나온 긴 내용도 같은 클릭 영역에 들어간다.";
  await page.evaluate((timeline) => window.testReceive({ meetings: [], timeline, phase: "recording", unknown: false, label: "녹음 중", elapsed: "1:00", warning: null, canStop: true, stale: false }), value);
  const geometry = await page.locator("article").evaluate(row => {
    const button = row.querySelector(".summary"), content = row.querySelector(".content");
    const b = button.getBoundingClientRect(), c = content.getBoundingClientRect();
    return { leftInset: c.left - b.left, multiline: c.height > parseFloat(getComputedStyle(button).lineHeight) };
  });
  assert.equal(geometry.leftInset, 0); assert.equal(geometry.multiline, true);
  assert.equal(await page.locator("article .label, article .offset").count(), 2);
  await page.locator(".summary").hover();
  assert.equal(await page.locator(".summary .content").evaluate(node => getComputedStyle(node).textDecorationLine), "underline");
  await page.locator(".summary").focus();
  assert.equal(await page.locator(".summary").evaluate((node) => getComputedStyle(node).outlineStyle), "solid");
  await page.locator(".summary").click();
  assert.equal(await page.locator(".summary").getAttribute("aria-expanded"), "true");
  assert.equal(await page.locator(".detail").evaluate((node) => node.inert), false);
  const indent = await page.locator("article").evaluate((row) => row.querySelector(".quote").getBoundingClientRect().left - row.querySelector(".content").getBoundingClientRect().left);
  assert.equal(indent, 0);
});


test("Chromium follows updates until evidence or upward input expresses reading intent", async (t) => {
  const { chromium } = require("@playwright/test");
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 460, height: 620 } });
  await page.addInitScript(() => {
    window.heymoaMeeting = {
      read: () => new Promise(() => {}),
      action: async () => {},
      subscribe: (receive) => {
        window.testReceive = receive;
        return () => {};
      },
    };
  });
  await page.goto(
    require("node:url").pathToFileURL(
      path.join(__dirname, "../dist/meeting.html")
    ).href
  );
  const value = snapshot();
  let timeline = {
    ...value,
    total: 20,
    items: Array.from({ length: 20 }, (_, i) => ({
      ...value.items[0],
      id: `item-${i}`,
    })),
  };
  const publish = () =>
    page.evaluate(
      (timeline) =>
        window.testReceive({
          meetings: [],
          timeline,
          phase: "recording",
          unknown: false,
          label: "녹음 중",
          elapsed: "1:00",
          warning: null,
          canStop: true,
          stale: false,
        }),
      timeline
    );
  const atBottom = () =>
    page.waitForFunction(() => {
      const node = document.querySelector("#scroll");
      return (
        Math.abs(node.scrollHeight - node.scrollTop - node.clientHeight) < 2 &&
        document.querySelector("#latest").hidden
      );
    });
  await publish();
  await atBottom();
  assert.equal(await page.locator("article.arriving").count(), 0);
  timeline.items[19] = {
    ...timeline.items[19],
    content: "회의에서 함께 확인한 긴 결정과 후속 작업입니다. ".repeat(45),
    citations: [
      { atMs: 1000, text: "회의 근거로 남는 긴 발화입니다. ".repeat(60) },
    ],
  };
  await publish();
  await atBottom();
  const readingTop = await page.locator("#scroll").evaluate(node => node.scrollTop);
  await page.evaluate(() => document.querySelectorAll(".summary")[19].click());
  await page.locator(".detail").nth(19).evaluate(node => Promise.all(node.getAnimations().map(a=>a.finished)));
  assert.equal(await page.locator("#scroll").evaluate(node=>node.scrollTop), readingTop);
  await publish();
  assert.equal(await page.locator("#scroll").evaluate(node=>node.scrollTop), readingTop);
  timeline.items[19] = { ...timeline.items[19], citations: [{ atMs:1000, text:"뒤늦게 보충된 회의 근거입니다. ".repeat(100) }] };
  await publish();
  assert.equal(await page.locator("#scroll").evaluate(node=>node.scrollTop), readingTop);
  await page.locator("#latest").click();
  await atBottom();
  await page.evaluate(() => { document.querySelector("#scroll").style.maxHeight = "220px"; });
  await atBottom();
  for (const kind of ["wheel", "touch", "key"]) {
    await page.locator("#latest").evaluate((button) => button.click());
    await atBottom();
    const before = await page.locator("#scroll").evaluate((node, kind) => {
      if (kind === "wheel")
        node.dispatchEvent(new WheelEvent("wheel", { deltaY: -12 }));
      if (kind === "key")
        node.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
      if (kind === "touch") {
        node.dispatchEvent(
          new TouchEvent("touchstart", {
            touches: [new Touch({ identifier: 1, target: node, clientY: 100 })],
          })
        );
        node.dispatchEvent(
          new TouchEvent("touchmove", {
            touches: [new Touch({ identifier: 1, target: node, clientY: 112 })],
          })
        );
      }
      node.scrollTop -= 12;
      node.dispatchEvent(new Event("scroll"));
      return node.scrollTop;
    }, kind);
    await publish();
    await publish();
    assert.equal(
      await page.locator("#latest").isVisible(),
      true,
      `${kind} must stay paused across snapshots`
    );
    assert.equal(
      await page.locator("#scroll").evaluate((node) => node.scrollTop),
      before
    );
  }
  await page.locator("#latest").click();
  await atBottom();
});

test("Chromium adds rows without animation and leaves existing content stable", async (t) => {
  const { chromium } = require("@playwright/test");
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const page = await browser.newPage({
      viewport: { width: 460, height: 620 },
      reducedMotion,
    });
    await page.addInitScript(() => {
      window.heymoaMeeting = {
        read: () => new Promise(() => {}),
        action: async () => {},
        subscribe: (receive) => {
          window.testReceive = receive;
          return () => {};
        },
      };
    });
    await page.goto(
      require("node:url").pathToFileURL(
        path.join(__dirname, "../dist/meeting.html")
      ).href
    );
    const value = snapshot();
    const publish = (timeline) =>
      page.evaluate(
        (timeline) =>
          window.testReceive({
            meetings: [],
            timeline,
            phase: "recording",
            unknown: false,
            label: "녹음 중",
            elapsed: "1:00",
            warning: null,
            canStop: true,
            stale: false,
          }),
        timeline
      );
    await publish(value);
    assert.equal(await page.locator("article.arriving").count(), 0);
    await publish({
      ...value,
      total: 2,
      items: [...value.items, { ...value.items[0], id: "new-row" }],
    });
    assert.equal(await page.locator("article.arriving").count(), 0);
    const animationFrames = await page.evaluate((value) => {
      window.testReceive({
        meetings: [],
        timeline: {
          ...value,
          items: [
            {
              ...value.items[0],
              content: "새로 보충된 회의 내용입니다. ".repeat(40),
            },
          ],
        },
        phase: "recording",
        unknown: false,
        label: "녹음 중",
        elapsed: "1:00",
        warning: null,
        canStop: true,
        stale: false,
      });
      return {
        row: document
          .querySelector("article")
          .getAnimations()
          .flatMap((animation) => animation.effect.getKeyframes()),
        content: document.querySelector(".content").getAnimations().length,
      };
    }, value);
    assert.equal(
      animationFrames.row.some((frame) => "height" in frame),
      false
    );
    assert.equal(animationFrames.content, 0);
    await page.close();
  }
});

test("English and Korean switches update controls and aria labels without translating meeting content", (t) => {
  const f = fixture(t, true), value = snapshot();
  f.update(value, true, "Recording", { language: "en" });
  assert.equal(f.document.documentElement.lang, "en");
  assert.equal(f.document.title, "HeyMoa · Current meeting");
  assert.equal(f.document.querySelector("#close").getAttribute("aria-label"), "Close popover");
  assert.equal(f.document.querySelector("#pin").getAttribute("aria-label"), "Keep on top");
  assert.equal(f.document.querySelector("#stop").textContent.trim(), "Pause recording");
  assert.equal(f.document.querySelector("#title").textContent, value.title);
  assert.equal(f.document.querySelector(".content").textContent, value.items[0].content);
  f.update(value, true, "녹음 중", { language: "ko" });
  assert.equal(f.document.querySelector("#pin").getAttribute("aria-label"), "항상 위에 고정");
  assert.equal(f.document.querySelector("#close").getAttribute("aria-label"), "팝오버 닫기");
});


test("Chromium preserves content position across notice changes and heartbeats, with full timeline detail and live partial", async (t) => {
  const { chromium } = require("@playwright/test");
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 420, height: 580 } });
  await page.addInitScript(() => {
    window.heymoaMeeting = { read: () => new Promise(() => {}), action: async () => {}, subscribe: receive => { window.testReceive = receive; return () => {}; } };
  });
  await page.goto(require("node:url").pathToFileURL(path.join(__dirname, "../dist/meeting.html")).href);
  const value = snapshot();
  value.items = [
    { ...value.items[0], id: "decision", tone: "decision", label: "결정", content: "다음 배포는 금요일에 진행합니다.", atMs: 14000 },
    { ...value.items[0], id: "task", content: "업데이트 후 녹음과 전송 상태를 확인합니다.", citations: [] },
    { ...value.items[0], id: "question", tone: "open", label: "이슈", content: "네트워크가 끊긴 상황의 재연결을 확인해야 합니다.", citations: [] },
    { ...value.items[0], id: "reference", tone: "reference", label: "인사이트", content: "상태 안내는 실제 조치가 필요할 때만 표시합니다.", citations: [] },
  ];
  value.total = 4;
  value.detail = { counts: { ALL: 4, DECISION: 1, ACTION_ITEM: 1, OPEN: 1, REFERENCE: 1 }, groups: [{ id: "agenda", title: "데스크톱 업데이트 검증", startMs: 14000, endMs: 55000, itemIds: value.items.map(i => i.id) }], partial: { confirmedText: "지금 말씀하시는 내용은 ", pendingText: "이렇게 실시간으로 표시됩니다." } };
  const publish = (warning = null) => page.evaluate(({ timeline, warning }) => window.testReceive({ meetings: [], timeline, language: "ko", phase: "recording", unknown: false, label: "녹음 중", elapsed: "1:03", warning, canStop: true, stale: false }), { timeline: value, warning });
  await publish();
  await page.locator("#scroll").evaluate(n => { n.scrollTop = 0; n.dispatchEvent(new Event("scroll")); });
  const top = await page.locator("article").first().evaluate(n => n.getBoundingClientRect().top);
  for (const warning of ["연결을 다시 확인하고 있습니다.", null, "마이크 음소거", null]) {
    await publish(warning);
    assert.equal(await page.locator("#phase").textContent(), warning || "녹음 중");
    assert.equal(await page.locator("article").first().evaluate(n => n.getBoundingClientRect().top), top);
  }
  assert.equal(await page.locator("#filters button").first().textContent(), "전체 4");
  assert.match(await page.locator(".group-heading").textContent(), /데스크톱 업데이트 검증/);
  assert.equal(await page.locator("#live-transcript p").textContent(), "지금 말씀하시는 내용은 이렇게 실시간으로 표시됩니다.");
  const captures = path.resolve(__dirname, "../../../output/playwright");
  fs.mkdirSync(captures, { recursive: true });
  await page.screenshot({ path: path.join(captures, "app-1567-compact-timeline-ko.png") });
  // A one-second native heartbeat must not touch timeline DOM or replay animations.
  await page.evaluate(() => { window.mutations = 0; new MutationObserver(records => window.mutations += records.length).observe(document.querySelector("#items"), { childList: true, characterData: true, subtree: true, attributes: true }); });
  await publish(); await publish();
  assert.equal(await page.evaluate(() => window.mutations), 0);
  await page.locator("#filters button").nth(2).click();
  assert.equal(await page.locator("article").count(), 1);
  assert.equal(await page.locator("article .label").textContent(), "할 일");
  await page.locator("#filters button").first().click();
  await page.locator(".group-heading").click();
  await publish();
  assert.equal(await page.locator(".group-heading").getAttribute("aria-expanded"), "false");
  await page.locator(".group-heading").click();
  value.detail.partial = null;
  await publish();
  assert.equal(await page.locator("#live-transcript").isVisible(), true);
  assert.match(await page.locator("#live-transcript").textContent(), /다음 발화/);
});


test("Chromium keeps small-window controls inside bounds across empty, loading, content, warnings and both languages", async (t) => {
  const { chromium } = require("@playwright/test");
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  for (const [width, height] of [[420, 580], [300, 400]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce" });
    await page.addInitScript(() => { window.heymoaMeeting = { read: () => new Promise(() => {}), action: async () => {}, subscribe: receive => { window.testReceive = receive; return () => {}; } }; });
    await page.goto(require("node:url").pathToFileURL(path.join(__dirname, "../dist/meeting.html")).href);
    for (const language of ["ko", "en"]) {
      const value = snapshot(); value.title = "제품 배포 검증 회의와 긴 제목 ".repeat(10);
      value.items[0].content = "공백없는아주긴문장".repeat(70);
      value.items[0].atMs = 12 * 60 * 60 * 1000;
      for (const state of ["empty", "loading", "content", "warning"]) {
        await page.evaluate(({ language, timeline, state }) => window.testReceive({ language, timeline: state === "empty" ? null : { ...timeline, loading: state === "loading", items: state === "loading" ? [] : timeline.items }, meetings: [], phase: state === "empty" ? "idle" : "recording", unknown: false, label: language === "en" ? "Recording state unavailable" : "녹음 상태 확인 불가", elapsed: "12:34:56", warning: state === "warning" ? "마이크 일시 중단 · 시스템 소리 일시 중단".repeat(5) : null, canStop: state !== "empty", viewing: false, stale: false }), { language, timeline: value, state });
        const bounds = await page.evaluate(() => {
          const rect = n => { const r = n.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
          return { wide: document.documentElement.scrollWidth > innerWidth, header: rect(document.querySelector("header")), close: rect(document.querySelector("#close")), footer: rect(document.querySelector("footer")), stop: rect(document.querySelector("#stop")), scroll: rect(document.querySelector("#scroll")), height: innerHeight, width: innerWidth };
        });
        assert.equal(bounds.wide, false, `${width} ${language} ${state}`);
        assert.ok(bounds.close.left >= bounds.header.left && bounds.close.right <= bounds.width);
        assert.ok(bounds.footer.bottom <= bounds.height && bounds.scroll.bottom <= bounds.footer.top);
        assert.ok(bounds.scroll.bottom > bounds.scroll.top);
        if (state !== "empty") assert.ok(bounds.stop.left >= 0 && bounds.stop.right <= bounds.width);
      }
    }
    await page.close();
  }
});


test("the compact app browses meetings and reads summary/timeline without dismissing the popup", async t => {
 const { chromium } = require('@playwright/test'); const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
 const page = await browser.newPage({ viewport: { width: 420, height: 580 } });
 await page.addInitScript(() => { window.actions = []; window.heymoaMeeting = { read: () => new Promise(() => {}), action: async action => { window.actions.push(action); }, subscribe: f => { window.receiveMeeting = f; return () => {}; } }; });
 await page.goto(require('node:url').pathToFileURL(path.join(__dirname, '../dist/meeting.html')).href);
 const meetings = [
  { workspaceId: 'w1', noteId: 'past', title: '제품 주간 회의', startedAt: Date.parse('2026-11-10T01:00:00Z'), state: 'ENDED', ended: true },
  { workspaceId: 'w1', noteId: 'paused', title: '배포 검증 회의', startedAt: Date.parse('2026-11-11T02:00:00Z'), state: 'PAUSED', ended: false },
  { workspaceId: 'w1', noteId: 'live', title: '진행 중인 팀 회의', startedAt: Date.parse('2026-11-11T09:00:00Z'), state: 'IN_PROGRESS', ended: false },
 ];
 const publish = (timeline = null, extra = {}) => page.evaluate(({ timeline, meetings, extra }) => window.receiveMeeting({ language: 'ko', meetingsStatus: 'ready', meetings, timeline, phase: 'completed', unknown: false, label: '녹음 완료', elapsed: null, warning: null, canStop: false, viewing: Boolean(timeline), stale: false, ...extra }), { timeline, meetings, extra });
 await publish(); assert.equal(await page.locator('.meeting').count(), 3); assert.equal(await page.locator('#empty').isVisible(), false);
 assert.equal(await page.locator('#title').textContent(), '최근 회의록');
 const captures = path.resolve(__dirname, '../../../output/playwright'); fs.mkdirSync(captures, { recursive: true });
 await page.screenshot({ path: path.join(captures, 'app-1567-meeting-list-ko.png') });
 await page.locator('.meeting').first().click();
 assert.deepEqual(await page.evaluate(() => window.actions), [{ action: 'open-note', noteId: 'past' }]);
 const value = snapshot(); value.noteId = 'past'; value.title = '제품 주간 회의';
 value.detail = { ended: true, ownsRecording: false, meetingState: 'ENDED', partial: null, counts: { ALL: 1, DECISION: 0, ACTION_ITEM: 1, OPEN: 0, REFERENCE: 0 }, groups: [{ id: 'g', title: '업데이트 검증', startMs: 1000, endMs: null, itemIds: ['item-a'] }], summary: { status: 'ready', lead: '다음 배포에서 회의 중 읽기 흐름과 업데이트 안내를 개선하기로 했습니다.', sections: [{ id: 'a', title: '데스크톱 앱 개선', description: '회의 목록에서 지난 회의를 선택하고 작은 창 안에서 요약과 타임라인을 전환합니다.', conclusions: ['녹음을 멈춰도 보던 회의는 그대로 유지합니다.'], openItems: ['Mac과 Windows에서 최종 업데이트 동작을 확인합니다.'] }] } };
 await publish(value); assert.equal(await page.locator('#summary-view').isVisible(), true); assert.equal(await page.locator('#filters').isVisible(), false);
 assert.equal(await page.locator('#stop').isVisible(), false); assert.equal(await page.locator('#latest').isVisible(), false); assert.match(await page.locator('#summary-view').textContent(), /녹음을 멈춰도/);
 assert.equal(await page.locator('#summary-view img').count(), 0);
 await page.screenshot({ path: path.join(captures, 'app-1567-meeting-summary-ko.png') });
 await page.locator('#timeline-tab').click(); assert.equal(await page.locator('#filters').isVisible(), true); assert.equal(await page.locator('article').count(), 1);
 await publish(value); assert.equal(await page.locator('#timeline-tab').getAttribute('aria-pressed'), 'true', 'a heartbeat cannot change the chosen tab');
 await page.locator('#back').click(); assert.equal(await page.evaluate(() => window.actions.at(-1)), 'list');
 await publish(null); assert.equal(await page.locator('.meeting').count(), 3);
 await publish(null, { language: 'en', label: 'Completed' }); assert.equal(await page.locator('#title').textContent(), 'Recent meetings');
 assert.doesNotMatch(await page.locator('header,footer,#view-tabs').allTextContents().then(lines => lines.join(' ')), /[가-힣]/);
 await page.screenshot({ path: path.join(captures, 'app-1567-meeting-list-en.png') });
});

test("popover action errors survive heartbeats and language changes until a successful retry", async t => {
 const f = fixture(t); f.update(snapshot());
 f.window.heymoaMeeting.action = async () => { throw new Error('disk unavailable'); };
 f.document.querySelector('#pin').click(); await f.finish();
 for (let i = 0; i < 3; i++) f.update(snapshot());
 assert.match(f.document.querySelector('#notice').textContent, /표시 설정을 저장하지 못/);
 f.update(snapshot(), true, 'Recording', { language: 'en' });
 assert.equal(f.document.querySelector('#notice').textContent, 'Could not save display settings. Try again.');
 f.window.heymoaMeeting.action = async () => {};
 f.document.querySelector('#pin').click(); await f.finish();
 assert.equal(f.document.querySelector('#notice').textContent, '');
});


test("compact reading layout fits six recent rows and motion belongs to navigation, not heartbeats", async t => {
 const { chromium } = require('@playwright/test'); const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
 const captures = path.resolve(__dirname, '../../../output/playwright'); fs.mkdirSync(captures, { recursive: true });
 for (const language of ['ko', 'en']) for (const colorScheme of ['light', 'dark']) {
  const reducedMotion = colorScheme === 'dark' ? 'reduce' : 'no-preference';
  const page = await browser.newPage({ viewport: { width: 420, height: 580 }, colorScheme, reducedMotion });
  await page.addInitScript(() => {
   window.motionCalls = 0; const animate = Element.prototype.animate;
   Element.prototype.animate = function(...args) { if (this.id === 'scroll') window.motionCalls++; return animate.apply(this, args); };
   window.heymoaMeeting = { read: () => new Promise(() => {}), action: async () => {}, subscribe: receive => { window.receiveCompact = receive; return () => {}; } };
  });
  await page.goto(require('node:url').pathToFileURL(path.join(__dirname, '../dist/meeting.html')).href);
  const en = language === 'en';
  const meetings = Array.from({ length: 9 }, (_, i) => ({ workspaceId: 'w', noteId: `m${i}`, title: en ? ['Product weekly review', 'Desktop update and recording reliability', 'Design review and next steps'][i % 3] : ['제품 주간 회의', '데스크톱 업데이트와 녹음 안정성 점검', '디자인 검토와 다음 일정'][i % 3], startedAt: Date.parse('2026-11-11T09:00:00Z') - i * 86400000, ended: true, state: 'ENDED' }));
  const publish = timeline => page.evaluate(({ timeline, meetings, language }) => window.receiveCompact({ language, meetings, meetingsStatus: 'ready', timeline, label: language === 'en' ? 'Completed' : '녹음 완료', elapsed: null, canStop: false, phase: 'completed', unknown: false, warning: null, stale: false }), { timeline, meetings, language });
  await publish(null);
  const geometry = await page.evaluate(() => {
   const main=document.querySelector('main').getBoundingClientRect(), title=document.querySelector('h1').getBoundingClientRect();
   const rows=[...document.querySelectorAll('.meeting')].map(node=>node.getBoundingClientRect());
   return { visible: rows.filter(row=>row.top>=main.top && row.bottom<=main.bottom).length, gap: rows[0].top-title.bottom, overflow: document.documentElement.scrollWidth>innerWidth };
  });
  assert.ok(geometry.visible >= 6, `${language}/${colorScheme} exposes at least six complete rows`);
  assert.ok(geometry.gap <= 8); assert.equal(geometry.overflow, false);
  await page.screenshot({ path: path.join(captures, `app-1580-list-${language}-${colorScheme}.png`) });
  await page.locator('.meeting').first().click();
  const timeline=snapshot(); timeline.noteId='m0'; timeline.title=meetings[0].title;
  timeline.items=Array.from({length: 12}, (_, i)=>({ id:`row-${i}`, tone:i%2 ? 'reference':'task', label:en ? (i%2 ? 'Reference':'Task') : (i%2 ? '참고':'할 일'), content:en ? 'Check the update flow and preserve the meeting when recording stops.' : '업데이트 흐름을 점검하고 녹음을 멈춰도 회의록을 계속 읽을 수 있게 합니다.', atMs:i*65000, citations:[{atMs:i*65000,text:en?'The meeting stays available after recording stops. We will check this before release.':'녹음을 멈춘 뒤에도 회의록은 그대로 볼 수 있어야 해요. 배포 전에 확인하겠습니다.'}] }));
  timeline.total=12; timeline.detail={ended:true, ownsRecording:false, meetingState:'ENDED', counts:{ALL:12,ACTION_ITEM:6,REFERENCE:6}, groups:[{id:'g', title:en?'Desktop updates and reading the meeting notes':'데스크톱 업데이트와 회의록 읽기',startMs:0,endMs:715000,itemIds:timeline.items.map(i=>i.id)}], summary:{status:'ready',lead:en?'Keep meeting notes available after recording stops.':'녹음 중지 후에도 회의록을 계속 조회할 수 있게 합니다.',sections:[]}};
  await publish(timeline); await page.locator('#timeline-tab').click();
  await page.locator('#scroll').evaluate(node=>Promise.all(node.getAnimations().map(a=>a.finished)));
  await page.locator('.summary').first().click();
  await page.locator('.detail').first().evaluate(node=>Promise.all(node.getAnimations().map(a=>a.finished)));
  await page.locator('#scroll').evaluate(node=>{node.scrollTop=0;});
  const calls=await page.evaluate(()=>window.motionCalls);
  assert.equal(calls, reducedMotion==='reduce' ? 0 : 2);
  await publish(timeline);
  assert.equal(await page.evaluate(()=>window.motionCalls), calls, 'heartbeat has no navigation animation');
  assert.equal(await page.locator('.summary').first().getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('.quote').first().evaluate(node=>getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)');
  const footer=await page.locator('footer').boundingBox(), latest=await page.locator('#latest').boundingBox();
  if (latest) assert.ok(latest.y>=footer.y && latest.y+latest.height<=footer.y+footer.height);
  await page.locator('#title').hover();
  await page.screenshot({ path: path.join(captures, `app-1580-timeline-${language}-${colorScheme}.png`) });
  await page.close();
 }
});


test("initial read failure is visible and a late failed read cannot replace a fresh subscription", async t => {
 const f=fixture(t,false,async()=>{throw new Error('offline');}); await f.finish();
 assert.equal(f.document.querySelector('#phase').textContent,'현재 회의를 확인하지 못했습니다.');
 assert.equal(f.document.querySelector('#empty').textContent,'현재 회의를 확인하지 못했습니다.');
 let reject; const g=fixture(t,false,()=>new Promise((_resolve,fail)=>reject=fail));
 g.update(snapshot()); reject(new Error('late')); await g.finish();
 assert.equal(g.document.querySelector('#phase').textContent,'녹음 중');
 assert.equal(g.document.querySelector('article .content').textContent,'배포 확인');
});
test("latest navigation preserves keyboard focus in the reading region when its button hides", t => {
 const f=fixture(t);f.update(snapshot());const latest=f.document.querySelector('#latest');latest.hidden=false;latest.focus();latest.click();
 assert.equal(latest.hidden,true);assert.equal(f.document.activeElement.id,'scroll');
});
