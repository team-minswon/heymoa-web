const { test } = require("node:test");
const assert = require("node:assert/strict");
const { meetingTimeline, popoverBounds, activeMeetings } = require("../dist/meeting-timeline");
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
test("v2 display detail validates groups, exhaustive counts, partial bounds, and keeps legacy snapshots valid", () => {
  const value = snapshot();
  value.detail = { counts: { ALL: 1, DECISION: 0, ACTION_ITEM: 1, OPEN: 0, REFERENCE: 0 }, groups: [{ id: "g1", title: "안건", startMs: 1000, endMs: null, itemIds: ["item-a"] }], partial: { confirmedText: "확인한 ", pendingText: "발언" } };
  assert.deepEqual(meetingTimeline(value), value);
  for (const detail of [
    { ...value.detail, token: "bad" },
    { ...value.detail, counts: { ...value.detail.counts, ALL: 2 } },
    { ...value.detail, counts: { ...value.detail.counts, OPEN: 1 } },
    { ...value.detail, groups: [] },
    { ...value.detail, groups: [{ ...value.detail.groups[0], itemIds: ["unknown"] }] },
    { ...value.detail, groups: [value.detail.groups[0], value.detail.groups[0]] },
    { ...value.detail, partial: { confirmedText: "x".repeat(4001), pendingText: "" } },
    { ...value.detail, partial: { confirmedText: "", pendingText: "", html: "bad" } },
  ]) assert.throws(() => meetingTimeline({ ...value, detail }), /INVALID_MEETING_TIMELINE/);
});
test("active meeting list is bounded, id-only and rejects extra fields and duplicates", () => {
  const one = { workspaceId: "w1", noteId: "n1", title: "회의", startedAt: 1000 };
  assert.deepEqual(activeMeetings([one, { ...one, noteId: "n2", startedAt: null }]), [one, { ...one, noteId: "n2", startedAt: null }]);
  assert.deepEqual(activeMeetings([]), []);
  for (const invalid of [null, "x", Array(21).fill(one), [one, one], [{ ...one, url: "https://x" }], [{ ...one, title: "x".repeat(301) }], [{ ...one, noteId: "" }], [{ ...one, startedAt: -1 }]])
    assert.throws(() => activeMeetings(invalid), /INVALID_ACTIVE_MEETINGS/);
});


test("recent lists and summary DTOs enforce workspace, bounded text and exact keys", () => {
 const { meetingList } = require('../dist/meeting-timeline');
 const entry = { workspaceId: 'w1', noteId: 'past', title: '지난 회의', startedAt: 1000, state: 'PAUSED', ended: false };
 const list = { workspaceId: 'w1', status: 'ready', meetings: [entry] };
 assert.deepEqual(meetingList(list), list);
 for (const invalid of [{ ...list, workspaceId: 'w2' }, { ...list, status: 'unknown' }, { ...list, html: 'x' }]) assert.throws(() => meetingList(invalid), /INVALID/);
 const value = snapshot();
 value.detail = { counts: { ALL: 1, DECISION: 0, ACTION_ITEM: 1, OPEN: 0, REFERENCE: 0 }, groups: [{ id: 'g1', title: '안건', startMs: 1000, endMs: null, itemIds: ['item-a'] }], partial: null, ended: true, workspaceId: 'w1', ownsRecording: false, selectionId: 2, meetingState: 'ENDED', summary: { status: 'ready', lead: '<img src=x>', sections: [{ id: 'a', title: '결론', description: '요약', conclusions: ['확인'], openItems: [] }] } };
 assert.deepEqual(meetingTimeline(value), value);
 for (const summary of [{ ...value.detail.summary, html: 'x' }, { ...value.detail.summary, lead: 'x'.repeat(4001) }, { ...value.detail.summary, sections: Array(21).fill(value.detail.summary.sections[0]) }, { ...value.detail.summary, sections: [{ ...value.detail.summary.sections[0], conclusions: Array(6).fill('x') }] }]) assert.throws(() => meetingTimeline({ ...value, detail: { ...value.detail, summary } }), /INVALID/);
 assert.throws(() => meetingTimeline({ ...value, detail: { ...value.detail, selectionId: -1 } }), /INVALID/);
});
