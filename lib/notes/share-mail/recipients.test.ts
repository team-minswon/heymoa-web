import { describe, expect, it } from "vitest";

import {
  MAX_RECIPIENTS,
  addRecipients,
  matchCandidates,
  recipientProblem,
  removeRecipient,
  isEmail,
  splitAddresses,
} from "@/lib/notes/share-mail/recipients";

const PEOPLE = [
  { name: "강성재", email: "sungjae@mentor.kr" },
  { name: "이서연", email: "seoyeon@heymoa.ai" },
];

describe("splitAddresses", () => {
  it("쉼표 · 세미콜론 · 공백 · 줄바꿈으로 나눈다", () => {
    expect(
      splitAddresses("a@x.com, b@y.co.kr;c@z.io\nd@w.net  e@v.org")
    ).toEqual(["a@x.com", "b@y.co.kr", "c@z.io", "d@w.net", "e@v.org"]);
  });

  it("메일 앱에서 복사한 「이름 <주소>」는 주소만 쓴다", () => {
    expect(splitAddresses("김민수 <minsu@a.com>, Lee Seo <seo@b.com>")).toEqual(
      ["minsu@a.com", "seo@b.com"]
    );
  });

  it("이름 붙은 주소와 맨 주소를 섞어 붙여 넣어도 하나도 빠뜨리지 않는다", () => {
    expect(
      splitAddresses(
        'John <john@example.com>, jane@example.com; "Kim, Minsu" <kim@a.com>'
      )
    ).toEqual(["john@example.com", "jane@example.com", "kim@a.com"]);
  });

  it("줄이나 빈칸으로 나눈 맨 주소가 이름 붙은 주소 앞에 있어도 남긴다", () => {
    expect(splitAddresses("alice@example.com\nBob <bob@example.com>")).toEqual([
      "alice@example.com",
      "bob@example.com",
    ]);
    expect(splitAddresses("alice@example.com Bob <bob@example.com>")).toEqual([
      "alice@example.com",
      "bob@example.com",
    ]);
  });
});

describe("isEmail", () => {
  it("서버와 같은 규칙이다 — 연속 · 앞뒤 점, 하이픈으로 시작하는 라벨, 영문이 아닌 최상위 도메인을 막는다", () => {
    for (const ok of [
      "a@example.com",
      "a.b+c@sub.example.co.kr",
      "o'neil@x.io",
    ])
      expect(isEmail(ok)).toBe(true);
    for (const bad of [
      "a..b@example.com",
      ".a@example.com",
      "a.@example.com",
      "a@-example.com",
      "a@example..com",
      "a@exa:mple.com",
      "a@localhost",
      "a@example.c0m",
    ]) {
      expect(isEmail(bad)).toBe(false);
    }
    expect(isEmail(`a@${"b".repeat(254)}.com`)).toBe(false);
  });
});

describe("addRecipients", () => {
  it("주소를 쳤으면 주소로만 후보를 찾는다 — 이름이 그 주소인 다른 후보로 바뀌지 않는다", () => {
    const tricky = [{ name: "client@example.com", email: "other@example.com" }];
    expect(
      addRecipients([], ["client@example.com"], tricky).map((row) => row.email)
    ).toEqual(["client@example.com"]);
    expect(addRecipients([], ["강성재"], PEOPLE)[0]).toMatchObject({
      email: "sungjae@mentor.kr",
      name: "강성재",
    });
  });

  it("대소문자만 다른 주소는 한 번만 넣는다", () => {
    const list = addRecipients([], ["A@x.com", "a@X.com", "b@x.com"]);
    expect(list.map((r) => r.email)).toEqual(["A@x.com", "b@x.com"]);
  });

  it("틀린 형식은 invalid 칩으로 남긴다", () => {
    const [bad, good] = addRecipients([], ["nope@", "ok@x.com"]);
    expect(bad).toMatchObject({ email: "nope@", valid: false });
    expect(good).toMatchObject({ email: "ok@x.com", valid: true });
  });

  it("후보 이름이나 주소와 맞으면 그 사람 이름을 붙인다", () => {
    const list = addRecipients([], ["강성재", "SEOYEON@heymoa.ai"], PEOPLE);
    expect(list).toEqual([
      { email: "sungjae@mentor.kr", name: "강성재", valid: true },
      { email: "seoyeon@heymoa.ai", name: "이서연", valid: true },
    ]);
  });

  it("후보 객체를 그대로 넣을 수 있다", () => {
    expect(addRecipients([], [PEOPLE[0]])).toEqual([
      { email: "sungjae@mentor.kr", name: "강성재", valid: true },
    ]);
  });
});

describe("recipientProblem", () => {
  it("문제가 없으면 null", () => {
    expect(recipientProblem(addRecipients([], ["a@x.com"]))).toBeNull();
  });

  it("틀린 주소를 짚는다", () => {
    expect(recipientProblem(addRecipients([], ["a@x.com", "bad"]))).toContain(
      "bad"
    );
  });

  it(`${MAX_RECIPIENTS}명을 넘으면 몇 명을 빼야 하는지 알린다`, () => {
    const many = addRecipients(
      [],
      Array.from({ length: MAX_RECIPIENTS + 2 }, (_, i) => `p${i}@x.com`)
    );
    expect(recipientProblem(many)).toContain("2명을 빼");
    expect(recipientProblem(many.slice(0, MAX_RECIPIENTS))).toBeNull();
  });
});

describe("matchCandidates · removeRecipient", () => {
  it("이미 넣은 사람은 후보에서 빠지고, 이름 · 주소로 거른다", () => {
    const list = addRecipients([], [PEOPLE[0]]);
    expect(matchCandidates(PEOPLE, list, "")).toEqual([PEOPLE[1]]);
    expect(matchCandidates(PEOPLE, [], "heymoa")).toEqual([PEOPLE[1]]);
    expect(matchCandidates(PEOPLE, [], "성재")).toEqual([PEOPLE[0]]);
  });

  it("빼기는 대소문자를 가리지 않는다", () => {
    const list = addRecipients([], ["a@x.com", "b@x.com"]);
    expect(removeRecipient(list, "A@X.COM").map((r) => r.email)).toEqual([
      "b@x.com",
    ]);
  });
});
