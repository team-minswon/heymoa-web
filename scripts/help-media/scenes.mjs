import assert from "node:assert/strict";
import { click, quietClick, type } from "./cursor.mjs";
const workspace = "/w/01K0000000000";
const note = (id, tab) => `${workspace}/notes/${id}?tab=${tab}&view=full`;
// 설정 창이 열리며 첫 탭에 남는 포커스 링을 지운다(영상에서는 누른 것처럼 보인다).
const blur = (p) => p.evaluate(() => document.activeElement?.blur?.());
const button = (p, name) => p.getByRole("button", { name, exact: true });

export const scenes = [
  {
    name: "new-meeting-record",
    path: workspace,
    // 1024 폭으로 찍어 960으로 줄인다 — 거의 1:1이라 도크의 작은 글자와 버튼이 뭉개지지 않는다.
    viewport: { width: 1024, height: 576 },
    fade: true,
    endHold: 1200,
    ready: (p) => button(p, "새 노트").waitFor(),
    async run(p, mark) {
      // 본문 단계와 1:1: [새 노트] → 이름 입력 → [만들기] → 빨간 점(회의 시작) → 받아쓰기가 쌓임
      await click(p, button(p, "새 노트"), 300, 450);
      await p.getByRole("dialog", { name: "새 회의 만들기" }).waitFor();
      await p.waitForTimeout(250);
      await type(
        p,
        p.getByLabel("회의 이름", { exact: true }),
        "4월 캠페인 리뷰",
        { hold: 450, delay: 60 }
      );
      await p.waitForTimeout(350);
      await click(p, button(p, "만들기"), 100, 450);
      // 노트가 열리면 하단 도크의 빨간 점이 보인다. 읽을 시간을 준다.
      await button(p, "회의 시작").waitFor();
      // 이 절과 상관없는 「내 에이전트」 패널은 접어 둔다. 받아쓰기가 넓게 보이게.
      await quietClick(
        p,
        p.getByRole("button", { name: "내 에이전트 접기", exact: true })
      );
      await p.waitForTimeout(700);
      await click(p, button(p, "회의 시작"), 100, 450);
      await p.getByTestId("note-recording-waveform").waitFor();
      // 커서가 일시정지 버튼 위에 남아 있으면 누르려는 것처럼 보인다. 받아쓰기 쪽으로 비켜 준다.
      await p.mouse.move(700, 330, { steps: 14 });
      // 받아쓰기 줄이 하나둘 쌓이는 걸 보여 준다.
      await p.getByTestId("transcript-block").first().waitFor({ timeout: 30000 });
      await p.getByTestId("partial-pending").waitFor({ timeout: 30000 });
      await p.waitForTimeout(300);
      mark();
    },
  },
  {
    // 기록 중 ⏸ → 「일시정지됨」 칩 → 종료 안내 말풍선(APP-1406·1411)
    name: "pause-end-nudge",
    path: workspace,
    viewport: { width: 1024, height: 576 },
    endNudge: true,
    endHold: 2600,
    async ready(p) {
      // 새 회의를 만들어 기록을 켜 두는 데까지는 준비 구간이다(영상에서 잘린다).
      await button(p, "새 노트").click();
      await p.getByRole("dialog").getByRole("button", { name: "만들기" }).click();
      await button(p, "회의 시작").waitFor();
      await button(p, "내 에이전트 접기").click();
      await button(p, "회의 시작").click();
      await p.getByTestId("transcript-block").first().waitFor({ timeout: 40000 });
      await p.waitForTimeout(3000);
    },
    async run(p, mark) {
      // 툴팁이 읽히게 잠깐 올려 둔 뒤 누른다.
      await click(p, button(p, "일시정지"), 300, 1600);
      await p.getByTestId("end-nudge").waitFor();
      await p.mouse.move(560, 420, { steps: 14 });
      await p.waitForTimeout(1200);
      mark();
    },
  },
  {
    name: "notification-settings",
    path: workspace,
    ready: (p) => p.getByRole("button", { name: /^알림/ }).first().waitFor(),
    async run(p, mark) {
      await click(p, p.getByRole("button", { name: /^알림/ }).first());
      const modal = p.getByRole("dialog", { name: "알림" });
      await modal.waitFor();
      await p.waitForTimeout(900);
      await click(p, modal.getByRole("tab", { name: /^처리 필요/ }), 900);
      await click(p, modal.getByRole("button", { name: "알림 설정" }));
      await p.getByRole("region", { name: "종류별 알림" }).waitFor();
      await blur(p);
      await p.waitForTimeout(700);
      mark();
      const mail = p.getByRole("switch", { name: "문의 답변 메일" });
      await click(p, mail, 900);
      assert.equal(await mail.getAttribute("aria-checked"), "false");
    },
  },
  {
    name: "account-delete",
    path: `${workspace}?settings=account`,
    async ready(p) {
      const open = button(p, "계정 삭제");
      await open.waitFor();
      await open.scrollIntoViewIfNeeded();
      await blur(p);
    },
    async run(p, mark) {
      await click(p, button(p, "계정 삭제"));
      const dialog = p.getByRole("dialog", { name: "계정을 삭제할까요?" });
      await dialog.waitFor();
      await dialog.getByRole("region", { name: "워크스페이스별 처리" }).waitFor();
      await p.waitForTimeout(700);
      await click(p, dialog.getByRole("button", { name: "자주 쓰지 않음" }), 900);
      mark();
      await type(p, dialog.getByRole("textbox").last(), "회원 탈퇴", {
        hold: 500,
        delay: 90,
      });
      const submit = dialog.getByRole("button", { name: "탈퇴", exact: true });
      assert.ok(await submit.isEnabled());
      // 누르지 않는다 — 켜진 [탈퇴]를 보여 주는 데서 끝낸다.
      const box = await submit.boundingBox();
      await p.mouse.move(box.x - 40, box.y + 60, { steps: 14 });
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
