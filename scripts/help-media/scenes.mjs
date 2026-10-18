import assert from "node:assert/strict";
import { click, type } from "./cursor.mjs";
const workspace = "/w/01K0000000000";
const note = (id, tab) => `${workspace}/notes/${id}?tab=${tab}&view=full`;
const button = (p, name) => p.getByRole("button", { name, exact: true });

export const scenes = [
  {
    name: "new-meeting-record",
    path: workspace,
    ready: (p) => button(p, "새 노트").waitFor(),
    async run(p) {
      await click(p, button(p, "새 노트"));
      await p.getByRole("dialog", { name: "새 회의 만들기" }).waitFor();
      await type(
        p,
        p.getByLabel("회의 이름", { exact: true }),
        "4월 캠페인 성과 리뷰"
      );
      await click(p, button(p, "만들기"));
      await click(p, button(p, "회의 시작"));
      await p.getByTestId("note-recording-waveform").waitFor();
      await p
        .getByText(/자, 시작하겠습니다/)
        .first()
        .waitFor();
      await p.waitForTimeout(2200);
      await click(p, button(p, "중지"));
      await p
        .getByTestId("note-recording-waveform")
        .waitFor({ state: "hidden" });
    },
  },
  {
    name: "dictionary-batch",
    path: `${workspace}?settings=terms`,
    ready: (p) => p.getByLabel("추가할 용어", { exact: true }).waitFor(),
    async run(p) {
      await type(
        p,
        p.getByLabel("추가할 용어", { exact: true }),
        "코호트, 리텐션, 이탈률"
      );
      await p.waitForTimeout(800);
      await p.getByText("코호트", { exact: true }).waitFor();
      await click(p, button(p, "3개 추가"));
      for (const term of ["코호트", "리텐션", "이탈률"]) {
        await p.getByText(term, { exact: true }).waitFor();
      }
      assert.equal(
        await p.getByLabel("추가할 용어", { exact: true }).inputValue(),
        ""
      );
    },
  },
  {
    name: "context-autosave",
    path: note("01KH000001003", "details"),
    async ready(p) {
      await p.locator("#note-context-topic").waitFor();
      await p.locator("#note-context-background").scrollIntoViewIfNeeded();
    },
    async run(p) {
      await type(p, p.locator("#note-context-topic"), "이번 주 운영 지표 점검");
      await type(
        p,
        p.locator("#note-context-background"),
        "문의 응답이 늦어져 담당과 개선 일정을 정합니다."
      );
      await p.getByText("저장했어요", { exact: true }).waitFor();
    },
  },
  {
    name: "speaker-assign",
    path: note("01KH000001001", "transcript"),
    async ready(p) {
      const chip = p
        .getByTestId("speaker-assign-trigger")
        .filter({ has: p.locator("[data-unassigned], [data-placeholder]") })
        .first();
      await chip.waitFor();
      await chip.scrollIntoViewIfNeeded();
    },
    async run(p) {
      const unassigned = p.locator(
        '[data-testid="speaker-assign-trigger"][data-placeholder]'
      );
      await click(p, unassigned.first());
      await p.getByRole("option").first().waitFor();
      await p.waitForTimeout(600);
      await click(p, p.getByRole("option").first(), 900);
      await p.waitForTimeout(1200);
    },
  },
  {
    name: "review-confirm",
    path: note("01KH000001001", "summary"),
    ready: (p) => button(p, "검토 완료").waitFor(),
    async run(p) {
      const row = p
        .getByRole("region", { name: "결정", exact: true })
        .locator('button[aria-expanded="false"]')
        .first();
      await click(p, row);
      await p.waitForTimeout(1400);
      await click(p, button(p, "검토 완료"));
      await click(
        p,
        p
          .getByRole("alertdialog")
          .getByRole("button", { name: "검토 완료", exact: true })
      );
      await p.getByText("확정됨", { exact: true }).first().waitFor();
      await p.waitForTimeout(600);
    },
  },
  {
    name: "tasks-filter",
    path: `${workspace}/tasks`,
    ready: (p) => p.getByRole("radio", { name: /^완료(?: \d+)?$/ }).waitFor(),
    async run(p) {
      for (const label of ["완료", "진행 중"]) {
        const tab = p.getByRole("radio", {
          name: new RegExp(`^${label}(?: \\d+)?$`),
        });
        await click(p, tab, 1000);
        assert.equal(await tab.getAttribute("aria-checked"), "true");
      }
      const mine = button(p, "내 할 일");
      await click(p, mine, 1000);
      assert.equal(await mine.getAttribute("aria-pressed"), "true");
    },
  },
  {
    name: "agent-ask",
    path: workspace,
    ready: (p) => button(p, "내 에이전트 열기").waitFor(),
    async run(p) {
      await click(p, button(p, "내 에이전트 열기"));
      await click(p, button(p, "새 대화"));
      await click(p, p.getByRole("button", { name: /회의록에서 찾기/ }), 0);
      await button(p, "중지").waitFor();
      await button(p, "중지").waitFor({ state: "hidden" });
      assert.ok(
        (await p.getByLabel("개인 챗봇").innerText()).includes("지난 회의")
      );
    },
  },
  {
    name: "members-invite",
    path: `${workspace}?settings=members`,
    ready: (p) => p.getByPlaceholder("name@gmail.com").waitFor(),
    async run(p) {
      const dialog = p.getByRole("dialog");
      await type(
        p,
        p.getByPlaceholder("name@gmail.com"),
        "jisoo.kang@example.com"
      );
      await p.waitForTimeout(600);
      await click(p, dialog.getByRole("button", { name: "초대", exact: true }));
      const pending = p.getByText("jisoo.kang@example.com").last();
      await pending.waitFor();
      await pending.scrollIntoViewIfNeeded();
      await p.waitForTimeout(1400);
    },
  },
  {
    name: "export-mail",
    path: note("01KH000001002", "summary"),
    ready: (p) => button(p, "내보내기·공유").waitFor(),
    async run(p) {
      await click(p, button(p, "내보내기·공유"));
      await click(p, p.getByRole("menuitem", { name: "이메일로 보내기" }));
      const dialog = p.getByRole("dialog", { name: "회의록 보내기" });
      await dialog.waitFor();
      await p.waitForTimeout(500);
      await click(p, dialog.getByRole("button", { name: /참석자 모두 추가/ }));
      await type(
        p,
        dialog.getByPlaceholder("받는 분께 남길 말을 적으세요"),
        "오늘 회의록 공유드립니다."
      );
      await click(p, dialog.getByRole("button", { name: /보내기$/ }).last());
      await p.waitForTimeout(1800);
    },
  },
  {
    name: "feedback-send",
    path: workspace,
    ready: (p) => p.getByRole("button", { name: /문의·피드백/ }).waitFor(),
    async run(p) {
      await click(p, p.getByRole("button", { name: /문의·피드백/ }));
      const dialog = p.getByRole("dialog");
      await dialog.waitFor();
      await p.waitForTimeout(500);
      await click(p, dialog.getByText("사용 문의", { exact: true }));
      await type(
        p,
        dialog.getByLabel("내용", { exact: true }),
        "회의 맥락은 어디서 적나요?"
      );
      await click(
        p,
        dialog.getByRole("button", { name: "보내기", exact: true })
      );
      await p.waitForTimeout(1800);
    },
  },
];
