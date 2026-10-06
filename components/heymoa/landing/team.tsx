import { ChevronsUpDown, FileText, Hourglass } from "lucide-react";

import { Reveal } from "@/components/heymoa/landing/reveal";
import { cn } from "@/lib/utils";

import { AppWindow, Face } from "./app";
import { Cursor, ExampleStamp, Scribble, Speech, Sticky } from "./marks";
import {
  APP,
  CONTAINER,
  H2,
  LEAD,
  MARKER_REVEAL,
  SECTION_Y,
  vars,
} from "./tokens";

/**
 * 팀 구간. tl;dv 의 「팀이 같이 쓴다」 포지셔닝(회의 기록이 팀 공간에 모인다)에서 가져왔다. 다만
 * HeyMoa 에서 팀이 하는 일은 둘뿐이다 — 회의가 프로젝트 아래 쌓이는 것, 관리자가 이메일로 멤버를
 * 초대하는 것(역할은 관리자 · 멤버, 링크는 하루). 공유 폴더 · 댓글 · 권한 세분화 같은 것은 없어서
 * 그림도 그 둘만 그린다.
 *
 * - 뒤 창 = 프로젝트 화면(`workspace-page.tsx` 머리 · `workspace-note-list.tsx` 날짜 묶음 ·
 *   `note-list-row.tsx` 행). 프레임은 창 그림자 하나뿐이다 — 전에는 뒤에 라벤더 · 민트 종이 두 장을
 *   깔았는데, 창 가장자리에 8~18px 색 띠로만 비어져 나와 종이가 아니라 창 테두리가 한 겹 더 있는
 *   것으로 읽혔다(테두리 두 겹). 그래서 종이를 걷고, 「쌓인다」는 창을 -1° 기울여
 *   반대로(+1.5°) 기운 멤버 창과 엇갈려 겹치는 것으로 말한다. 겹칠 때는 두 창의 같은 쪽 가장자리가
 *   늘 24px 넘게 어긋나야 한다 — 몇 px 차이로 나란하면 의도한 쌓임이 아니라 어긋남, 또는 테두리 두
 *   겹으로 읽힌다. 그래서 sm 부터는 프로젝트 창을 그림 칸보다 36px 좁혀(`sm:mr-9`) 멤버 창이 오른쪽으로
 *   늘 36px 내민다(전에는 최대 폭 560 만 걸어서, 그림 칸이 500 안팎으로 줄어드는 1024~1100 에서 두 창의
 *   오른쪽 끝이 겹쳤다). 640 아래는 그만큼 엇갈릴 폭이 없어(320 에서 프로젝트 창을 24px만 좁혀도 회의
 *   제목이 세 줄로 깨진다) 겹치지 않는다 — 프로젝트 창은 바로 서고, 기운 멤버 창이 32px 아래에 따로 놓인다.
 * - 겹친 앞 창 = 설정의 멤버 화면(`members-settings.tsx` 머리 · 멤버 행 · 대기 중인 초대).
 *   대기 중인 초대 줄에 「하루만 살아요」 쪽지를 붙인다(초대 링크 하루 · 앱 코드와 대조됨). 하루는
 *   이 쪽지만 말하고 리드에서 되풀이하지 않는다(한 구간에서 같은 말 두 번 금지).
 * - 여는 농담은 이서연의 「그 회의록 어디 있어요?」이고, 답은 그림이 한다 — 히어로에서 돌던
 *   「3차 스프린트 킥오프」 줄에 형광펜을 긋고 손가락을 얹는다(누르면 노트가 열리는 것은 앱 그대로).
 * - 「올리다」는 이 구간에서 쓰지 않는다. 페이지 다른 곳(히어로 쪽지 · 근거 리드 · 확정 막대)에서
 *   「검토 완료를 눌러 프로젝트에 올린다」는 뜻으로 쓰여서, 여기서 쓰면 결정까지 저절로 들어간다고
 *   읽힌다. 「검토 완료를 눌러야 확정」도 그 세 곳이 이미 말해서 여기서 네 번째로 되풀이하지 않고,
 *   리드는 저절로 생기는 것(목록의 한 줄)만 말한다.
 * - 리드의 참여자 수는 출석을 재는 것이 아니다. 목록의 「참여 N명」은 정보 탭 「참여자 선택」에서
 *   사람이 고른 참여자 수라(`note-participants-field.tsx` → `note-list-row.tsx` MeetingMeta) 「몇 명이
 *   들어왔는지」가 아니라 「정보 탭에서 고른 참여자 수」로 적는다. 기록 시간은 앱이 잰다.
 *
 * 이야기 순서: 히어로(3차 킥오프가 도는 중) → 근거(그 회의가 끝난 뒤) → 여기(한 주 뒤 그 스프린트의
 * 회고가 기록 중). 「4차 스프린트 회고」로 두면 3차를 시작한 지 한 주 만에 4차가 끝난 셈이라
 * 줄거리가 어긋나서 「3차 스프린트 회고」로 바꿨다.
 *
 * 앱에서 줄이거나 바꾼 곳(과장 허용 범위): 행의 「…」 메뉴 · hover 배경은 그리지 않는다. 멤버 목록과
 * 대기 중인 초대의 둥근 테두리 상자는 hairline 선으로 줄였고(창의 마지막 줄인 초대는 위 선만 — 아래
 * 선이 창 바닥 가까이 남으면 테두리 두 겹으로 읽힌다), 멤버 행의 가입일 열과 초대 입력
 * 줄은 뺐다. 행 메타는 앱처럼 한 줄이지만 좁은 폭에서는 잘리는 대신 줄을 바꾼다(가운뎃점은 앞 항목에
 * 붙어 다닌다). 이메일도 말줄임 대신 다 보이고, 멤버 창 안쪽이 17rem 보다 좁으면(320) 역할 선택 · 초대
 * 취소가 모든 행에서 함께 아래로 내려간다(행마다 제 길이로 내려가면 이메일 · 역할 글자 폭 차이로 어떤
 * 행만 내려가 들쭉날쭉했다). 390 에서는 참여자 얼굴을 셋 대신 둘 + 「+N」으로, 멤버 행의 「내보내기」는
 * 숨긴다.
 */

type Meeting = {
  date: string;
  title: string;
  live?: boolean;
  min: number;
  host: string;
  people: string[];
  /** 농담의 답 — 형광펜과 손가락이 이 줄에 붙는다. */
  found?: boolean;
};

const MEETINGS: Meeting[] = [
  {
    date: "2026년 9월 8일 (화)",
    title: "3차 스프린트 회고",
    live: true,
    min: 12,
    host: "김민서",
    people: ["김민서", "박지훈"],
  },
  {
    date: "2026년 9월 1일 (화)",
    title: "3차 스프린트 킥오프",
    // 목록 행은 분을 내림한다(`note-list-row.tsx` MeetingMeta 의 Math.floor) — 누적 01:52 라 「기록 1분」.
    // 검토 머리의 「2분」은 반올림(lengthLabel)이라 두 자리 값이 다른 것이 앱 그대로다.
    min: 1,
    host: "김민서",
    people: ["김민서", "박지훈", "이서연", "정우재"],
    found: true,
  },
  {
    date: "2026년 8월 25일 (화)",
    title: "2차 스프린트 킥오프",
    min: 3,
    host: "김민서",
    people: ["김민서", "박지훈", "정우재"],
  },
];

type Member = { who: string; email: string; role: string; me?: boolean };

/**
 * 페이지가 줄곧 같은 팀으로 그려 온 넷 그대로다. 정우재는 위 킥오프 두 줄 · 히어로의 참여자이고
 * 회의 카드 · 근거에서 할 일 담당이라, 멤버 목록에 없으면 (앱이 임시 참여자를 허용해 틀린 것은
 * 아니어도) 눈여겨본 사람에게 어긋난다. 이서연은 이 구간 농담의 주인이라 뺄 수 없다.
 */
const MEMBERS: Member[] = [
  { who: "김민서", email: "minseo@example.com", role: "관리자", me: true },
  { who: "박지훈", email: "jihoon@example.com", role: "멤버" },
  { who: "이서연", email: "seoyeon@example.com", role: "멤버" },
  { who: "정우재", email: "jeongwoo@example.com", role: "멤버" },
];

/**
 * 조상 `Reveal` 이 아직 안 보였으면 반복 움직임을 세워 둔다 — 붙자마자 돌면 사용자가 이 구간에
 * 닿기 전에 끝나 버린다. `motion.tsx` 의 규칙이 레이어 밖이라 `!` 로 이긴다. 보이면 이 규칙이 풀려
 * 그때 처음부터 돈다. 모션을 줄이면 애니메이션 자체가 없다.
 */
const HOLD = "[[data-reveal]:not([data-shown])_&]:[animation-name:none]!";

/** 기록 중 레벨 막대. 멈춘 뒤에는 이 높이로 선다(정지 화면이 빈 막대 넷으로 보이지 않게). */
const LEVELS = [0.55, 1, 0.4, 0.8];

/* ── 프로젝트 화면 ─────────────────────────────────────────────────────── */

function RowIcon({ live }: { live?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-5 shrink-0 items-center justify-center",
        live ? APP.rec : APP.faint
      )}
    >
      {live ? (
        <span className="flex h-4 w-5 items-center justify-center gap-[2px]">
          {LEVELS.map((level, i) => (
            <span
              key={i}
              className={cn("tv-level-brief h-3.5 w-[2px] rounded-full", APP.recBg, HOLD)}
              style={{ scale: `1 ${level}`, ...vars({ "--i": i }) }}
            />
          ))}
        </span>
      ) : (
        <FileText className="size-4" />
      )}
    </span>
  );
}

/** `진행자 | 참여자들`(note-list-row). 참여자는 셋까지(390 은 둘까지), 넘치면 「+N」. */
function RowFaces({ host, people }: { host: string; people: string[] }) {
  const overLg = people.length - 3;
  const overSm = people.length - 2;
  return (
    <span aria-hidden className="flex shrink-0 items-center gap-1.5 sm:gap-2">
      <Face who={host} size={24} />
      <span className="h-5 w-px bg-[var(--el-hairline-strong)]" />
      <span className="flex items-center">
        {people.slice(0, 3).map((name, i) => (
          <Face
            key={name}
            who={name}
            size={24}
            className={cn("ring-2 ring-white", i > 0 && "-ml-2", i === 2 && "max-sm:hidden")}
          />
        ))}
        {overSm > 0 ? (
          <span
            className={cn(
              "-ml-2 flex size-6 items-center justify-center rounded-full text-[11px] tabular-nums ring-2 ring-white",
              APP.softBg,
              APP.muted,
              overLg <= 0 && "sm:hidden"
            )}
          >
            <span className="sm:hidden">+{overSm}</span>
            {overLg > 0 ? <span className="max-sm:hidden">+{overLg}</span> : null}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function MeetingRow({ m }: { m: Meeting }) {
  return (
    <div className="relative flex min-h-16 items-center gap-3 px-2 sm:gap-[14px] sm:px-3">
      <RowIcon live={m.live} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-[15px] font-medium break-keep", APP.ink)}>
          {m.found ? (
            <span className={MARKER_REVEAL} style={vars({ "--d": "750ms" })}>
              {m.title}
            </span>
          ) : (
            m.title
          )}
        </span>
        <span
          className={cn(
            "flex min-w-0 flex-wrap items-center gap-x-1.5 text-[12px] leading-4 whitespace-nowrap",
            APP.muted
          )}
        >
          {/* 항목마다 뒤 가운뎃점까지 한 덩어리 — 좁아서 줄이 바뀌어도 「·」로 시작하는 줄이 없다. */}
          <span className="inline-flex items-center gap-1.5">
            {m.live ? (
              <span
                aria-hidden
                className={cn("tv-blink-3 size-1.5 shrink-0 rounded-full", APP.recBg, HOLD)}
              />
            ) : null}
            <span className={cn("font-medium", m.live && APP.rec)}>
              {m.live ? "기록 중" : "종료됨"}
            </span>
            <span aria-hidden>·</span>
          </span>
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            기록 {m.min}분<span aria-hidden>·</span>
          </span>
          <span className="tabular-nums">참여 {m.people.length}명</span>
        </span>
      </span>
      <RowFaces host={m.host} people={m.people} />
      {m.found ? (
        <Cursor
          press
          delay={950}
          className={cn(
            "top-[44%] left-[56%] max-sm:hidden [animation-delay:950ms]!",
            HOLD,
            "[[data-reveal]:not([data-shown])_&_.tv-ripple]:[animation-name:none]!"
          )}
        />
      ) : null}
    </div>
  );
}

/**
 * 프로젝트 창(그림자 하나, sm 부터 -1°). sm 부터 창 아래 빈 바닥 80 은 멤버 창이 걸칠 자리라 마지막
 * 행을 덮지 않는다(겹침 = 멤버 창의 음수 위 여백 64 + 두 창의 기울기 몇 px). 640 아래는 겹치지 않아
 * 바닥도 위(24)와 같은 숨만 둔다. 오른쪽 36px(`sm:mr-9`)은 멤버 창이 내밀 자리다(머리 주석).
 */
function ProjectStack() {
  return (
    <Reveal className="relative max-w-[560px] sm:mr-9 sm:-rotate-1">
      <AppWindow className="px-3 pt-6 pb-3 sm:px-6 sm:pt-7 sm:pb-20">
        <div className="mx-2 border-b border-[var(--el-hairline)] pb-5 sm:mx-0 sm:pb-6">
          <p
            className={cn(
              "m-0 font-serif text-[34px] leading-[1.05] font-light tracking-[-0.035em] sm:text-[40px]",
              APP.ink
            )}
          >
            온보딩 개선
          </p>
          <p className={cn("m-0 mt-3 text-[14px] leading-6 break-keep", APP.muted)}>
            3개의 회의 기록 · 발화와 결정이 시간순으로 보관됩니다.
          </p>
        </div>
        <div className="mt-2">
          {MEETINGS.map((m, i) => (
            <div key={m.title} className="tv-r" style={vars({ "--i": i * 1.5 })}>
              <p
                className={cn(
                  "m-0 px-2 pt-3 pb-1.5 text-[12px] leading-4 font-medium sm:px-3 sm:pt-5 sm:pb-2",
                  APP.muted
                )}
              >
                {m.date}
              </p>
              <MeetingRow m={m} />
            </div>
          ))}
        </div>
      </AppWindow>
      <ExampleStamp className="absolute -top-3 right-4 sm:right-6" />
    </Reveal>
  );
}

/* ── 멤버 화면 ─────────────────────────────────────────────────────────── */

/** 앱 `Button variant="outline"` 의 그림(포커스 없음). 높이는 자리마다 앱 값(sm 28 · 초대 취소 32). */
const OUTLINE = cn(
  "inline-flex shrink-0 items-center rounded-[8px] border border-[var(--el-hairline)] bg-[var(--el-canvas)] px-2.5 text-[12.8px] font-medium whitespace-nowrap",
  APP.ink
);

function MemberRow({ who, email, role, me }: Member) {
  return (
    <div className="flex min-h-[52px] items-start gap-3 py-2.5">
      {/* 얼굴 · 내보내기는 이름 두 줄(36px) 높이에 가운데로 선다 — 역할이 아래로 내려가도 그대로. */}
      <span className="flex h-9 shrink-0 items-center">
        <Face who={who} size={28} />
      </span>
      {/* 앱은 이메일을 말줄임하지만 여기서는 다 보인다 — 창 안쪽이 17rem 보다 좁으면(320) 모든
          행의 역할 선택이 함께 이름·이메일 아래로 내려간다(가장 긴 행이 얼굴까지 약 268px 이라 그
          위에서는 다 한 줄에 든다). 그 위 폭에서는 앱처럼 한 줄, 역할 선택이 오른쪽 끝. */}
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex-1 whitespace-nowrap @max-[17rem]:basis-full">
          <span
            className={cn("flex items-center gap-1.5 text-[14px] leading-5 font-medium", APP.ink)}
          >
            {who}
            {me ? <span className={cn("text-[12px] font-normal", APP.muted)}>(나)</span> : null}
          </span>
          <span className={cn("block text-[12px] leading-4", APP.muted)}>{email}</span>
        </span>
        {/* 역할 select 의 그림(`SelectTrigger`: h-8 · hairline-strong · 14px · 위아래 갈매기). */}
        <span
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-2 rounded-[8px] border border-[var(--el-hairline-strong)] px-2.5 text-[14px] whitespace-nowrap",
            APP.ink
          )}
        >
          {role}
          <ChevronsUpDown aria-hidden className={cn("size-3.5", APP.muted)} />
        </span>
      </span>
      {/* 내 행은 버튼 없이 자리만 남긴다(앱과 같다 — 줄마다 오른쪽 끝이 맞는다). */}
      <span className="hidden h-9 w-[74px] shrink-0 items-center justify-end sm:flex">
        {me ? null : <span className={cn(OUTLINE, "h-7")}>내보내기</span>}
      </span>
    </div>
  );
}

/**
 * 멤버 창. sm 부터는 오른쪽에 붙어(프로젝트 창보다 36px 밖) 64px 걸친다. 흐름 안에 두고 음수 위
 * 여백으로 올리므로 겹침이 늘 그 값이다(내용 높이가 바뀌어도 행을 덮지 않는다). 640 아래는 겹치지 않고
 * 32px 아래에 프로젝트 창과 같은 폭으로 놓인다 — 전에는 32px 걸치고 왼쪽만 16px 들여서, 왼쪽은 뒤 창
 * 모서리가 14px 조각으로 삐져나오고 오른쪽은 두 창 선이 3px 간격으로 나란해 테두리 두 겹으로 읽혔다.
 * 창 안쪽 폭이 행 배치를 정하므로 창은 `@container` 다(멤버 행 주석).
 */
function MembersStack() {
  return (
    <Reveal className="relative z-10 mt-8 sm:-mt-16 sm:ml-auto sm:w-[420px]">
      <div className="tv-rslide relative rotate-1 sm:rotate-[1.5deg]" style={vars({ "--d": "300ms" })}>
        <AppWindow className="@container p-4 sm:p-5">
          <p
            className={cn(
              "m-0 font-serif text-[30px] leading-9 font-light tracking-[-0.03em]",
              APP.ink
            )}
          >
            멤버
          </p>
          <p className={cn("m-0 mt-1 text-[13px] leading-5 break-keep", APP.muted)}>
            이 워크스페이스의 멤버와 대기 중인 초대를 관리합니다.
          </p>
          <div className="mt-4 divide-y divide-[var(--el-hairline)] border-y border-[var(--el-hairline)]">
            {MEMBERS.map((member) => (
              <MemberRow key={member.who} {...member} />
            ))}
          </div>
          <p className={cn("m-0 mt-4 text-[14px] leading-5 font-medium", APP.ink)}>
            대기 중인 초대
          </p>
          {/* 멤버 행처럼 이메일은 다 보이고, 멤버 행과 같은 폭(창 안쪽 17rem)에서 역할 · 취소가 아래로
              내려간다. 창의 마지막 행이라 위 선만 둔다 — 아래 선은 창 바닥 16~20px 위에 남아 창 테두리가
              한 겹 더 있는 것처럼 읽혔다. */}
          <div className="mt-2 flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-2 border-t border-[var(--el-hairline)] py-2.5">
            {/* 미가입자는 이름이 없어 이메일이 곧 이름이다(앱 그대로). */}
            <span
              className={cn(
                "flex-1 text-[14px] font-medium whitespace-nowrap @max-[17rem]:basis-full",
                APP.ink
              )}
            >
              doyun@example.com
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span
                className={cn(
                  "inline-flex h-5 items-center rounded-[6px] border border-[var(--el-hairline)] px-2 text-[12px] font-medium",
                  APP.ink
                )}
              >
                멤버
              </span>
              <span className={cn("hidden text-[12px] sm:block", APP.muted)}>김민서 · 9월 8일</span>
              <span className={cn(OUTLINE, "h-8")}>취소</span>
            </span>
          </div>
        </AppWindow>

        {/* 하루짜리 초대장. 창 아래 여백에만 걸치고(390 은 안쪽 오른쪽, 넓으면 오른쪽 모서리 밖으로),
            넓은 화면에서는 보라 화살표가 그 초대 줄 끝을 가리킨다 — 화살촉은 창 가장자리 밖이다.
            「하루」는 이 쪽지만 말하므로 화면 읽기 프로그램에도 읽힌다. */}
        <Sticky
          aria-hidden={false}
          tone="pop"
          size="sm"
          tilt={-5}
          tape
          anim="reveal"
          delay={850}
          className="absolute right-3 -bottom-5 z-10 inline-flex items-center gap-1.5 whitespace-nowrap lg:-right-14 lg:-bottom-6"
        >
          <Hourglass aria-hidden className="size-3.5" strokeWidth={2.5} />
          이 링크는 하루만 살아요
        </Sticky>
        <Scribble
          kind="arrow"
          flipX
          draw="reveal"
          delay={1150}
          className="absolute bottom-[18px] left-[calc(100%-6px)] max-lg:hidden"
        />
      </div>
    </Reveal>
  );
}

/* ── 구간 ─────────────────────────────────────────────────────────────── */

export function Team() {
  return (
    <section
      id="team"
      aria-labelledby="team-title"
      className={`scroll-mt-20 bg-white ${SECTION_Y.white}`}
    >
      <div
        className={`${CONTAINER} grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16`}
      >
        {/* DOM 은 글 → 그림(화면 읽기 순서 = 좁은 화면에서 보이는 순서). 넓은 화면만 그림을 왼쪽
            칸으로 옮긴다 — 나란한 두 칸이라 읽는 순서가 뜻을 바꾸지 않는다. */}
        <Reveal className="min-w-0 sm:max-w-[560px] lg:max-w-none lg:self-center">
          <Speech who="이서연" tone="pop" size="sm" tilt={-2} anim="reveal">
            그 회의록 어디 있어요?
          </Speech>
          <h2 id="team-title" className={`${H2} mt-4`}>
            회의는 프로젝트에 <span className={MARKER_REVEAL}>차곡차곡</span> 쌓입니다
          </h2>
          <p className={`${LEAD} mt-4`}>
            회의록을 따로 공유할 필요가 없습니다. 새 회의를 만들면 그 프로젝트 목록에 바로 한 줄이
            생기고, 기록한 시간과 정보 탭에서 고른 참여자 수가 그 줄에 같이 붙습니다.
          </p>
          <p className={`${LEAD} mt-4`}>
            멤버는 관리자가 이메일로 초대합니다. 아직 가입하지 않은 사람도 초대 메일의 링크로
            가입해 들어옵니다. 역할은 관리자와 멤버 둘입니다.
          </p>
        </Reveal>

        <figure className="relative m-0 w-full max-w-[596px] min-w-0 lg:order-first">
          <figcaption className="sr-only">
            예시 화면. 「온보딩 개선」 프로젝트에 회의 세 개가 날짜별로 쌓인 목록과, 같은
            워크스페이스의 멤버 설정(멤버 넷, 대기 중인 초대 하나)입니다.
          </figcaption>
          <ProjectStack />
          <MembersStack />
        </figure>
      </div>
    </section>
  );
}
