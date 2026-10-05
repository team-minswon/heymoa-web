const { test } = require("node:test");
const assert = require("node:assert/strict");
const { meetingTimeline, popoverBounds } = require("../dist/meeting-timeline");
const snapshot = () => ({ noteId: "note-a", title: "회의", loading: false, failed: false, reconnecting: false, total: 1,
  items: [{ id: "item-a", tone: "task", label: "할 일", content: "확인합니다.", atMs: 1000, citations: [{ atMs: 1000, text: "<script>실행하지 않습니다.</script>" }] }] });
test("snapshot admits only bounded display data and rejects executable fields, malformed items and duplicate ids", () => {
  const value = snapshot(); assert.deepEqual(meetingTimeline(value), value); assert.equal(meetingTimeline(null), null);
  for (const invalid of [ { ...value, token: "secret" }, { ...value, items: Array(121).fill(value.items[0]) }, { ...value, title: "x".repeat(301) },
    { ...value, items: [{ ...value.items[0], tone: "html" }] }, { ...value, total: 2, items: [value.items[0], value.items[0]] },
    { ...value, items: [{ ...value.items[0], citations: [{ atMs: -1, text: "bad" }] }] } ])
    assert.throws(() => meetingTimeline(invalid), /INVALID_MEETING_TIMELINE/);
});
test("popup fits top, bottom, negative-origin and small displays", () => {
  for (const [anchor, area] of [
    [{ x: 1400, y: 0, width: 20, height: 24 }, { x: 0, y: 24, width: 1440, height: 900 }],
    [{ x: 1900, y: 1040, width: 20, height: 40 }, { x: 0, y: 0, width: 1920, height: 1040 }],
    [{ x: -1400, y: 0, width: 20, height: 24 }, { x: -1440, y: 24, width: 1440, height: 800 }],
    [{ x: 100, y: 0, width: 20, height: 24 }, { x: 0, y: 24, width: 300, height: 400 }],
  ]) {
    const bounds = popoverBounds(anchor, area);
    assert.ok(bounds.x >= area.x && bounds.y >= area.y);
    assert.ok(bounds.x + bounds.width <= area.x + area.width);
    assert.ok(bounds.y + bounds.height <= area.y + area.height);
  }
});
