import { ChevronsUpDown, FileText, Hourglass } from "lucide-react";
import { useTranslations } from "next-intl";

import { Reveal } from "@/components/heymoa/landing/reveal";
import { cn } from "@/lib/utils";

import { AppWindow, Face, usePersonName, type Person } from "./app";
import { Cursor, Scribble, Speech, Sticky } from "./marks";
import { RICH } from "./rich";
import {
  APP,
  CONTAINER,
  H2,
  LEAD,
  MARKER_REVEAL,
  SECTION_Y,
  vars,
} from "./tokens";

type Meeting = {
  id: "retro" | "kickoff" | "earlier";
  live?: boolean;
  min: number;
  host: Person;
  people: Person[];
  found?: boolean;
};

const MEETINGS: Meeting[] = [
  {
    id: "retro",
    live: true,
    min: 12,
    host: "minseo",
    people: ["minseo", "jihoon"],
  },
  {
    id: "kickoff",
    min: 1,
    host: "minseo",
    people: ["minseo", "jihoon", "seoyeon", "woojae"],
    found: true,
  },
  {
    id: "earlier",
    min: 3,
    host: "minseo",
    people: ["minseo", "jihoon", "woojae"],
  },
];

type Member = {
  who: Person;
  email: string;
  role: "admin" | "member";
  me?: boolean;
};

const MEMBERS: Member[] = [
  { who: "minseo", email: "minseo@example.com", role: "admin", me: true },
  { who: "jihoon", email: "jihoon@example.com", role: "member" },
  { who: "seoyeon", email: "seoyeon@example.com", role: "member" },
  { who: "woojae", email: "woojae@example.com", role: "member" },
];

const HOLD = "[[data-reveal]:not([data-shown])_&]:[animation-name:none]!";

const LEVELS = [0.55, 1, 0.4, 0.8];

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

function RowFaces({ host, people }: { host: Person; people: Person[] }) {
  const shownLg = people.length > 3 ? 2 : people.length;
  const shownSm = people.length > 2 ? 1 : people.length;
  const overLg = people.length - shownLg;
  const overSm = people.length - shownSm;
  return (
    <span aria-hidden className="flex shrink-0 items-center gap-1.5 sm:gap-2">
      <Face who={host} size={24} />
      <span className="h-5 w-px bg-[var(--el-hairline-strong)]" />
      <span className="flex items-center">
        {people.slice(0, shownLg).map((name, i) => (
          <Face
            key={name}
            who={name}
            size={24}
            className={cn("ring-2 ring-white", i > 0 && "-ml-2", i >= shownSm && "max-sm:hidden")}
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
  const t = useTranslations("landing.team");
  const status = useTranslations("landing.app.status");
  const title = t(`meetings.${m.id}.title`);
  return (
    <div className="relative flex min-h-16 items-center gap-3 px-2 sm:gap-[14px] sm:px-3">
      <RowIcon live={m.live} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-[15px] font-medium", APP.ink)}>
          {m.found ? (
            <span className={MARKER_REVEAL} style={vars({ "--d": "750ms" })}>
              {title}
            </span>
          ) : (
            title
          )}
        </span>
        <span
          className={cn(
            "flex min-w-0 flex-wrap items-center gap-x-1.5 text-[12px] leading-4 whitespace-nowrap",
            APP.muted
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            {m.live ? (
              <span
                aria-hidden
                className={cn("tv-blink-3 size-1.5 shrink-0 rounded-full", APP.recBg, HOLD)}
              />
            ) : null}
            <span className={cn("font-medium", m.live && APP.rec)}>
              {status(m.live ? "recording" : "ended")}
            </span>
            <span aria-hidden>·</span>
          </span>
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            {t("recorded", { min: m.min })}
            <span aria-hidden>·</span>
          </span>
          <span className="tabular-nums">
            {t("participants", { count: m.people.length })}
          </span>
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

function ProjectStack() {
  const t = useTranslations("landing.team");
  return (
    <Reveal
      className="tv-land relative max-w-[560px] sm:mr-9 sm:-rotate-1"
      style={vars({ "--fy": "80px", "--fr": "-3deg" })}
    >
      <AppWindow className="px-3 pt-6 pb-3 sm:px-6 sm:pt-7 sm:pb-20">
        <div className="mx-2 border-b border-[var(--el-hairline)] pb-5 sm:mx-0 sm:pb-6">
          <p
            className={cn(
              "m-0 text-[34px] leading-[1.05] font-light tracking-[-0.035em] sm:text-[40px]",
              APP.ink
            )}
          >
            {t("project.name")}
          </p>
          <p className={cn("m-0 mt-3 text-[14px] leading-6", APP.muted)}>
            {t("project.description")}
          </p>
        </div>
        <div className="mt-2">
          {MEETINGS.map((m, i) => (
            <div key={m.id} className="tv-r" style={vars({ "--i": i * 1.5 })}>
              <p
                className={cn(
                  "m-0 px-2 pt-3 pb-1.5 text-[12px] leading-4 font-medium sm:px-3 sm:pt-5 sm:pb-2",
                  APP.muted
                )}
              >
                {t(`meetings.${m.id}.date`)}
              </p>
              <MeetingRow m={m} />
            </div>
          ))}
        </div>
      </AppWindow>
    </Reveal>
  );
}

const OUTLINE = cn(
  "inline-flex shrink-0 items-center rounded-[8px] border border-[var(--el-hairline)] bg-[var(--el-canvas)] px-2.5 text-[12.8px] font-medium whitespace-nowrap",
  APP.ink
);

function MemberRow({ who, email, role, me }: Member) {
  const t = useTranslations("landing.team.members");
  const name = usePersonName();
  return (
    <div className="flex min-h-[52px] items-start gap-3 py-2.5">
      <span className="flex h-9 shrink-0 items-center">
        <Face who={who} size={28} />
      </span>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex-1 whitespace-nowrap @max-[17rem]:basis-full">
          <span
            className={cn("flex items-center gap-1.5 text-[14px] leading-5 font-medium", APP.ink)}
          >
            {name(who)}
            {me ? <span className={cn("text-[12px] font-normal", APP.muted)}>{t("me")}</span> : null}
          </span>
          <span className={cn("block text-[12px] leading-4", APP.muted)}>{email}</span>
        </span>
        <span
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-2 rounded-[8px] border border-[var(--el-hairline-strong)] px-2.5 text-[14px] whitespace-nowrap",
            APP.ink
          )}
        >
          {t(`roles.${role}`)}
          <ChevronsUpDown aria-hidden className={cn("size-3.5", APP.muted)} />
        </span>
      </span>
      <span className="hidden h-9 w-[74px] shrink-0 items-center justify-end sm:flex">
        {me ? null : <span className={cn(OUTLINE, "h-7")}>{t("remove")}</span>}
      </span>
    </div>
  );
}

function MembersStack() {
  const t = useTranslations("landing.team");
  const name = usePersonName();
  return (
    <Reveal
      className="tv-land relative z-10 mt-8 sm:-mt-16 sm:ml-auto sm:w-[420px]"
      style={vars({
        "--fx": "70px",
        "--fy": "200px",
        "--fr": "6deg",
        "--ty": "-40px",
      })}
    >
      <div className="tv-rslide relative rotate-1 sm:rotate-[1.5deg]" style={vars({ "--d": "300ms" })}>
        <AppWindow className="@container p-4 sm:p-5">
          <p
            className={cn(
              "m-0 text-[30px] leading-9 font-light tracking-[-0.03em]",
              APP.ink
            )}
          >
            {t("members.title")}
          </p>
          <p className={cn("m-0 mt-1 text-[13px] leading-5", APP.muted)}>
            {t("members.description")}
          </p>
          <div className="mt-4 divide-y divide-[var(--el-hairline)] border-y border-[var(--el-hairline)]">
            {MEMBERS.map((member) => (
              <MemberRow key={member.who} {...member} />
            ))}
          </div>
          <p className={cn("m-0 mt-4 text-[14px] leading-5 font-medium", APP.ink)}>
            {t("members.pending")}
          </p>
          <div className="mt-2 flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-2 border-t border-[var(--el-hairline)] py-2.5">
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
                {t("members.roles.member")}
              </span>
              <span className={cn("hidden text-[12px] sm:block", APP.muted)}>
                {t("members.invitedBy", { name: name("minseo") })}
              </span>
              <span className={cn(OUTLINE, "h-8")}>{t("members.cancel")}</span>
            </span>
          </div>
        </AppWindow>

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
          {t("inviteNote")}
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

export function Team() {
  const t = useTranslations("landing.team");
  return (
    <section
      id="team"
      aria-labelledby="team-title"
      className={`bg-white ${SECTION_Y.white}`}
    >
      <div
        className={`${CONTAINER} grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16`}
      >
        <Reveal className="min-w-0 sm:max-w-[560px] lg:max-w-none lg:self-center">
          <Speech who="seoyeon" tone="pop" size="sm" tilt={-2} anim="reveal">
            {t("speech")}
          </Speech>
          <h2 id="team-title" className={`${H2} mt-4`}>
            {t.rich("title", {
              ...RICH,
              m: (chunks) => <span className={MARKER_REVEAL}>{chunks}</span>,
            })}
          </h2>
          <p className={`${LEAD} mt-4`}>{t("lead1")}</p>
          <p className={`${LEAD} mt-4`}>{t("lead2")}</p>
        </Reveal>

        <figure className="relative m-0 w-full max-w-[596px] min-w-0 lg:order-first">
          <figcaption className="sr-only">
            {t("caption")}
          </figcaption>
          <ProjectStack />
          <MembersStack />
        </figure>
      </div>
    </section>
  );
}
