import assert from "node:assert/strict";
import { click, quietClick, type } from "./cursor.mjs";
import { K, L, LOCALE, R } from "./ui.mjs";
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
    ready: (p) => button(p, L("새 노트")).waitFor(),
    async run(p, mark) {
      // 본문 단계와 1:1: [새 노트] → 이름 입력 → [만들기] → 빨간 점(회의 시작) → 받아쓰기가 쌓임
      await click(p, button(p, L("새 노트")), 300, 450);
      await p.getByRole("dialog", { name: L("새 회의 만들기") }).waitFor();
      await p.waitForTimeout(250);
      await type(
        p,
        p.getByLabel(L("회의 이름"), { exact: true }),
        L("4월 캠페인 리뷰", "April campaign review"),
        { hold: 450, delay: 60 }
      );
      await p.waitForTimeout(350);
      await click(p, button(p, L("만들기")), 100, 450);
      // 노트가 열리면 하단 도크의 빨간 점이 보인다. 읽을 시간을 준다.
      await button(p, L("회의 시작")).waitFor();
      // 이 절과 상관없는 「내 에이전트」 패널은 접어 둔다. 받아쓰기가 넓게 보이게.
      await quietClick(
        p,
        p.getByRole("button", { name: L("내 에이전트 접기"), exact: true })
      );
      await p.waitForTimeout(700);
      await click(p, button(p, L("회의 시작")), 100, 450);
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
      await button(p, L("새 노트")).click();
      await p.getByRole("dialog").getByRole("button", { name: L("만들기") }).click();
      await button(p, L("회의 시작")).waitFor();
      await button(p, L("내 에이전트 접기")).click();
      await button(p, L("회의 시작")).click();
      await p.getByTestId("transcript-block").first().waitFor({ timeout: 40000 });
      await p.waitForTimeout(3000);
    },
    async run(p, mark) {
      // 툴팁이 읽히게 잠깐 올려 둔 뒤 누른다.
      await click(p, button(p, K("recording.dock.pause")), 300, 1600);
      await p.getByTestId("end-nudge").waitFor();
      await p.mouse.move(560, 420, { steps: 14 });
      await p.waitForTimeout(1200);
      mark();
    },
  },
  {
    name: "notification-settings",
    path: workspace,
    ready: (p) => p.getByRole("button", { name: R(/^알림/, /^Notifications/) }).first().waitFor(),
    async run(p, mark) {
      await click(p, p.getByRole("button", { name: R(/^알림/, /^Notifications/) }).first());
      const modal = p.getByRole("dialog", { name: L("알림") });
      await modal.waitFor();
      await p.waitForTimeout(900);
      await click(p, modal.getByRole("tab", { name: R(/^처리 필요/, /^Needs action/) }), 900);
      await click(p, modal.getByRole("button", { name: L("알림 설정") }));
      await p.getByRole("region", { name: L("종류별 알림") }).waitFor();
      await blur(p);
      await p.waitForTimeout(700);
      mark();
      const mail = p.getByRole("switch", {
        // 스위치 이름은 「{종류} {채널}」 이다(settings.notifications.channelLabel)
        name: `${K("settings.notifications.types.INQUIRY_ANSWERED")} ${K("settings.notifications.channels.email.label")}`,
      });
      await click(p, mail, 900);
      assert.equal(await mail.getAttribute("aria-checked"), "false");
    },
  },
  {
    name: "account-delete",
    path: `${workspace}?settings=account`,
    async ready(p) {
      const open = button(p, L("계정 삭제"));
      await open.waitFor();
      // 설정 창은 계정 조회가 끝나면 한 번 다시 그려진다 — 그 뒤에 스크롤한다
      await p.waitForTimeout(1500);
      await open.scrollIntoViewIfNeeded();
      await blur(p);
    },
    async run(p, mark) {
      await click(p, button(p, L("계정 삭제")));
      const dialog = p.getByRole("dialog", { name: L("계정을 삭제할까요?") });
      await dialog.waitFor();
      await dialog.getByRole("region", { name: L("워크스페이스별 처리") }).waitFor();
      await p.waitForTimeout(700);
      await click(p, dialog.getByRole("button", { name: K("settings.accountDeletion.reason.codes.RARELY_USED") }), 900);
      mark();
      await type(p, dialog.getByRole("textbox").last(), L("회원 탈퇴", "delete my account"), {
        hold: 500,
        delay: 90,
      });
      const submit = dialog.getByRole("button", { name: L("탈퇴"), exact: true });
      assert.ok(await submit.isEnabled());
      // 누르지 않는다 — 켜진 [탈퇴]를 보여 주는 데서 끝낸다.
      const box = await submit.boundingBox();
      await p.mouse.move(box.x - 40, box.y + 60, { steps: 14 });
    },
  },
  {
    name: "dictionary-batch",
    path: `${workspace}?settings=terms`,
    ready: (p) => p.getByLabel(L("추가할 용어"), { exact: true }).waitFor(),
    async run(p) {
      await type(
        p,
        p.getByLabel(L("추가할 용어"), { exact: true }),
        L("코호트, 리텐션, 이탈률", "cohort, retention, churn rate")
      );
      await p.waitForTimeout(800);
      await p.getByText(L("코호트", "cohort"), { exact: true }).waitFor();
      await click(p, button(p, L("3개 추가", "Add 3")));
      for (const term of LOCALE === "en" ? ["cohort", "retention", "churn rate"] : ["코호트", "리텐션", "이탈률"]) {
        await p.getByText(term, { exact: true }).waitFor();
      }
      assert.equal(
        await p.getByLabel(L("추가할 용어"), { exact: true }).inputValue(),
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
      await type(p, p.locator("#note-context-topic"), L("이번 주 운영 지표 점검", "This week's ops metrics"));
      await type(
        p,
        p.locator("#note-context-background"),
        L("문의 응답이 늦어져 담당과 개선 일정을 정합니다.", "Support replies are running late, so we'll assign owners and set a timeline to fix it.")
      );
      await p.getByText(K("notes.context.saved"), { exact: true }).waitFor();
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
    ready: (p) => button(p, L("검토 완료")).waitFor(),
    async run(p) {
      const row = p
        .getByRole("region", { name: L("결정", "Decisions"), exact: true })
        .locator('button[aria-expanded="false"]')
        .first();
      await click(p, row);
      await p.waitForTimeout(1400);
      await click(p, button(p, L("검토 완료")));
      await click(
        p,
        p
          .getByRole("alertdialog")
          .getByRole("button", { name: L("검토 완료"), exact: true })
      );
      await p.getByText(L("확정됨"), { exact: true }).first().waitFor();
      await p.waitForTimeout(600);
    },
  },
  {
    name: "tasks-filter",
    path: `${workspace}/tasks`,
    ready: (p) => p.getByRole("radio", { name: new RegExp(`^${L("완료")}(?: \\d+)?$`) }).waitFor(),
    async run(p) {
      for (const label of [L("완료"), L("진행 중", "In progress")]) {
        const tab = p.getByRole("radio", {
          name: new RegExp(`^${label}(?: \\d+)?$`),
        });
        await click(p, tab, 1000);
        assert.equal(await tab.getAttribute("aria-checked"), "true");
      }
      const mine = button(p, L("내 할 일"));
      await click(p, mine, 1000);
      assert.equal(await mine.getAttribute("aria-pressed"), "true");
    },
  },
  {
    name: "agent-ask",
    path: workspace,
    ready: (p) => button(p, L("내 에이전트 열기")).waitFor(),
    async run(p) {
      await click(p, button(p, L("내 에이전트 열기")));
      await click(p, button(p, L("새 대화")));
      // 시작 화면의 예시 질문 중 첫 칩(「최근 결정」 등). 칩 구성은 워크스페이스 상태에 따라 고른다
      await click(p, p.getByRole("list", { name: K("chat.starter.examplesLabel") }).getByRole("button").first(), 0);
      // 칩은 질문을 입력칸에 채운다 — 보내기를 눌러 답을 받는다
      await click(p, button(p, K("chat.composer.send")), 600);
      // 답이 짧으면 「중지」가 잠깐만 보인다 — 나타나기를 기다리지 않고 사라진 뒤(답이 끝난 뒤)를 본다
      await p.waitForTimeout(1500);
      await button(p, K("chat.composer.stop")).waitFor({ state: "hidden", timeout: 30000 });
      assert.ok(
        (await p.getByTestId("personal-chat-panel").innerText()).length > 0
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
        "jordan.hayes@example.com"
      );
      await p.waitForTimeout(600);
      await click(p, dialog.getByRole("button", { name: L("초대"), exact: true }));
      const pending = p.getByText("jordan.hayes@example.com").last();
      await pending.waitFor();
      await pending.scrollIntoViewIfNeeded();
      await p.waitForTimeout(1400);
    },
  },
  {
    name: "export-mail",
    path: note("01KH000001002", "summary"),
    ready: (p) => button(p, L("내보내기·공유")).waitFor(),
    async run(p) {
      await click(p, button(p, L("내보내기·공유")));
      await click(p, p.getByRole("menuitem", { name: L("이메일로 보내기") }));
      const dialog = p.getByRole("dialog", { name: L("회의록 보내기") });
      await dialog.waitFor();
      await p.waitForTimeout(500);
      await click(p, dialog.getByRole("button", { name: R(/참석자 모두 추가/, /Add all attendees/) }));
      await type(
        p,
        dialog.getByPlaceholder(L("받는 분께 남길 말을 적으세요")),
        L("오늘 회의록 공유드립니다.", "Here are the notes from today's meeting.")
      );
      await click(p, dialog.getByRole("button", { name: R(/보내기$/, /^Send( to|$)/) }).last());
      await p.waitForTimeout(1800);
    },
  },
  {
    name: "feedback-send",
    path: workspace,
    ready: (p) => p.getByRole("button", { name: new RegExp(L("문의·피드백")) }).waitFor(),
    async run(p) {
      await click(p, p.getByRole("button", { name: new RegExp(L("문의·피드백")) }));
      const dialog = p.getByRole("dialog");
      await dialog.waitFor();
      await p.waitForTimeout(500);
      await click(p, dialog.getByText(L("사용 문의"), { exact: true }));
      await type(
        p,
        dialog.getByLabel(L("내용", "Message"), { exact: true }),
        L("회의 맥락은 어디서 적나요?", "Where do I add meeting context?")
      );
      await click(
        p,
        dialog.getByRole("button", { name: L("보내기"), exact: true })
      );
      await p.waitForTimeout(1800);
    },
  },
];
