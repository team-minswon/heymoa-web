// @vitest-environment node
// jsdom 의 FormData · Blob 은 fetch 쪽과 서로 맞지 않아 목이 첨부를 파일로 못 읽는다
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { setupServer } from "msw/node";

import { mockDb } from "@/lib/mocks/db";
import { restHandlers } from "@/lib/mocks/rest-handlers";

const server = setupServer(...restHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  vi.useRealTimers();
  mockDb.reset();
});
afterAll(() => server.close());

const send = () => {
  const form = new FormData();
  form.append("file", new Blob(["%PDF-1.7"], { type: "application/pdf" }), "회의록.pdf");
  form.append("recipients", "kim@example.com");
  return fetch("http://localhost/v1/notes/01K0000000402/share-mails", { method: "POST", body: form });
};

it("회의록 메일은 한 시간에 30건까지 받고, 넘으면 429 SHARE_MAIL_RATE_LIMITED 다", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-16T10:00:00Z"));

  for (let sent = 0; sent < 30; sent++) expect((await send()).status).toBe(202);
  const limited = await send();
  expect(limited.status).toBe(429);
  expect((await limited.json()).error).toMatchObject({
    code: "SHARE_MAIL_RATE_LIMITED",
    message: "메일을 너무 자주 보냈습니다. 잠시 후 다시 시도해 주세요.",
  });

  // 첫 발송이 한 시간 창을 벗어나면 다시 보낼 수 있다
  vi.advanceTimersByTime(60 * 60 * 1000);
  expect((await send()).status).toBe(202);
});

it("거절된 발송은 상한에 세지 않는다", async () => {
  const form = new FormData();
  form.append("file", new Blob(["not a pdf"]), "x.pdf");
  form.append("recipients", "kim@example.com");
  for (let tried = 0; tried < 30; tried++) {
    const response = await fetch("http://localhost/v1/notes/01K0000000402/share-mails", { method: "POST", body: form });
    expect(response.status).toBe(400);
  }
  expect((await send()).status).toBe(202);
});

it("서버가 거절하는 주소 형식은 400 SHARE_MAIL_INVALID_RECIPIENT 다", async () => {
  const form = new FormData();
  form.append("file", new Blob(["%PDF-1.7"], { type: "application/pdf" }), "회의록.pdf");
  form.append("recipients", "a..b@example.com");
  const response = await fetch("http://localhost/v1/notes/01K0000000402/share-mails", { method: "POST", body: form });
  expect(response.status).toBe(400);
  expect((await response.json()).error.code).toBe("SHARE_MAIL_INVALID_RECIPIENT");
});

it("상한은 정시로 자른 한 시간 칸마다 센다 — 서버처럼 10:59 에 다 써도 11:00 에는 다시 보낸다", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-16T10:59:00Z"));
  for (let sent = 0; sent < 30; sent++) expect((await send()).status).toBe(202);
  expect((await send()).status).toBe(429);
  vi.setSystemTime(new Date("2026-10-16T11:00:00Z"));
  expect((await send()).status).toBe(202);
});

it("서버와 같은 차례로 거절한다 — 받는 사람이 틀리면 파일이 PDF 가 아니어도 받는 사람 오류다", async () => {
  const form = new FormData();
  form.append("file", new Blob(["not a pdf"]), "x.pdf");
  form.append("recipients", "a..b@example.com");
  const response = await fetch("http://localhost/v1/notes/01K0000000402/share-mails", { method: "POST", body: form });
  expect((await response.json()).error.code).toBe("SHARE_MAIL_INVALID_RECIPIENT");
});

it("상태 조회는 접수 뒤 잠깐 PENDING 이었다가 SENT 가 되고, @reject.test 는 FAILED 다. 처음 쓴 표기를 남기고 없는 메일은 404 다", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-16T10:00:00Z"));
  const form = new FormData();
  form.append("file", new Blob(["%PDF-1.7"], { type: "application/pdf" }), "회의록.pdf");
  for (const email of ["Kim@Example.com", "kim@example.com", "no@reject.test"]) form.append("recipients", email);
  const accepted = await fetch("http://localhost/v1/notes/01K0000000402/share-mails", { method: "POST", body: form });
  const { mailId } = (await accepted.json()).data;
  const status = async () => (await fetch(`http://localhost/v1/notes/01K0000000402/share-mails/${mailId}`)).json();

  expect((await status()).data).toMatchObject({
    completed: false,
    recipients: [
      { email: "Kim@Example.com", status: "PENDING" },
      { email: "no@reject.test", status: "PENDING" },
    ],
  });
  vi.setSystemTime(new Date("2026-10-16T10:00:02Z"));
  expect((await status()).data).toMatchObject({
    completed: true,
    recipients: [
      { email: "Kim@Example.com", status: "SENT" },
      { email: "no@reject.test", status: "FAILED" },
    ],
  });
  const missing = await fetch("http://localhost/v1/notes/01K0000000402/share-mails/0K9XXXXXXXXXX");
  expect(missing.status).toBe(404);
  expect((await missing.json()).error.code).toBe("SHARE_MAIL_NOT_FOUND");
});
