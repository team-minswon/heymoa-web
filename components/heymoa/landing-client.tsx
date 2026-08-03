"use client";

import { MotionConfig, motion, type Variants } from "motion/react";
import { Mic, MessageCircle, Play, Plug, Sparkles } from "lucide-react";

import { LandingCta } from "@/components/heymoa/landing-cta";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteConfig.name,
  alternateName: ["heymoa", "Hey Moa", "hey moa", "헤이모아", "헤이 모아"],
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: siteConfig.url,
  description: siteConfig.description,
  featureList: [
    "실시간 회의 기록",
    "회의 맥락과 결정사항 요약",
    "담당자별 액션 아이템 정리",
  ],
  inLanguage: "ko-KR",
};

/** 좌우 여백 64px(design.pen 정본)까지 단계로 벌린다. 마케팅 면은 전폭이고 max-width가 없다. */
const GUTTER = "px-6 sm:px-10 lg:px-16";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
  },
};

const stagger: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
};

/**
 * 스크롤에 맞춰 한 번만 올라온다. `margin`으로 화면 아래 100px 전에 시작해 사용자가 섹션에
 * 닿을 때쯤 이미 자리를 잡게 한다.
 */
const reveal = {
  variants: stagger,
  initial: "hidden",
  whileInView: "visible",
  viewport: { once: true, margin: "-100px" },
} as const;

/**
 * 앵커로 부드럽게 내려간다. `scroll-behavior: smooth`를 `html`에 걸지 않는 이유는 그러면
 * 라우트 이동의 맨 위로 복귀까지 애니메이션이 붙기 때문이다 — 이 페이지의 앵커에만 건다.
 * 움직임을 줄여 달라고 한 사람에게는 즉시 이동한다.
 */
function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
}

/**
 * 랜딩. design.pen `UWqm8`(/ · 기본 · 비로그인)가 정본이다 — 1440 기준 Hero 720 · Proof ·
 * Missions · Features · CTA 480.
 *
 * **정본에서 셋을 뺐다**(2026-08-03).
 * - 제품 샷(`v9rBG2`) — 정본에서도 지웠다.
 * - 상단바·푸터 — 이 페이지 것이 아니라 루트 레이아웃의 마케팅 크롬이고, 기존 것을 그대로
 *   쓴다. 정본의 평평한 바(`Nav`)와 한 줄 푸터(`Footer`)로 갈아 끼우지 않는다.
 */
export function LandingClient() {
  return (
    // reducedMotion="user"가 없으면 motion은 OS 설정을 무시한다(기본 "never").
    <MotionConfig reducedMotion="user">
      <div className="bg-[var(--el-canvas)] text-[var(--el-ink)]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <Hero />
        <Proof />
        <Missions />
        <Features />
        <ClosingCta />
      </div>
    </MotionConfig>
  );
}

/**
 * 그라데이션 오브. 브랜드의 유일한 색 모먼트라 위치·크기까지 정본을 따른다 — 값은 1440×720
 * (CTA는 1440×480) 기준 좌표를 비율로 옮긴 것이다.
 */
function Orb({
  color,
  alpha,
  style,
}: {
  color: string;
  alpha: number;
  style: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute rounded-full"
      style={{
        ...style,
        backgroundImage: `radial-gradient(ellipse 50% 50% at 50% 50%, color-mix(in srgb, var(${color}) ${alpha}%, transparent) 0%, transparent 100%)`,
      }}
    />
  );
}

function Hero() {
  return (
    // `pt`가 `py`보다 큰 것은 상단바 몫이다 — 떠 있는 알약(fixed top-4)이라 문서 흐름에
    // 자리를 차지하지 않는다. 히어로가 그 아래로 파고들면 배지가 알약에 가린다.
    <section className="relative isolate flex min-h-[640px] flex-col items-center justify-center overflow-hidden px-6 pt-32 pb-24 text-center sm:px-10 lg:h-[720px] lg:px-16 lg:pt-20 lg:pb-0">
      <Orb
        color="--el-gradient-mint"
        alpha={55}
        style={{ left: "-11.1%", top: "-19.4%", width: "52.8%", height: "77.8%" }}
      />
      <Orb
        color="--el-gradient-lavender"
        alpha={50}
        style={{ left: "61.1%", top: "-11.1%", width: "48.6%", height: "72.2%" }}
      />
      <Orb
        color="--el-gradient-peach"
        alpha={35}
        style={{ left: "36.1%", top: "52.8%", width: "43.1%", height: "58.3%" }}
      />
      <Orb
        color="--el-gradient-sky"
        alpha={30}
        style={{ left: "8.3%", top: "41.7%", width: "33.3%", height: "50%" }}
      />

      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="relative flex flex-col items-center"
      >
        <motion.p
          variants={fadeInUp}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--el-hairline)] bg-white/80 px-3.5 py-1.5 text-xs font-semibold tracking-[0.8px] text-[var(--el-body)]"
        >
          <span className="size-1.5 rounded-full bg-[var(--el-body)]" />
          회의에 함께 앉는 AI 에이전트
        </motion.p>

        <motion.h1
          variants={fadeInUp}
          className="mt-8 font-serif text-[52px] leading-[1.02] font-light tracking-[-1.7px] break-keep text-[var(--el-ink)] sm:text-[76px] sm:tracking-[-2.5px] lg:text-[104px] lg:leading-[106px] lg:tracking-[-3.4px]"
        >
          회의 시간을
          <br />
          가치있게.
        </motion.h1>

        <motion.p
          variants={fadeInUp}
          className="mt-7 max-w-[46rem] text-base leading-8 break-keep text-[var(--el-body)] sm:text-lg"
        >
          팀은 계속 바뀝니다. 그때마다 지난 회의의 맥락이 사라지고 같은 논의를
          다시 합니다.
          {/* 정본의 줄바꿈이다. 좁은 화면에서는 강제 줄바꿈이 오히려 어색해 접는다. */}
          <br className="hidden sm:inline" /> {siteConfig.name} 는 회의를
          기록하는 데서 멈추지 않고 전·후 맥락을 이어 붙입니다.
        </motion.p>

        <motion.div
          variants={fadeInUp}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <LandingCta label="Google 계정으로 시작" />
          <Button
            type="button"
            onClick={() => scrollToSection("how-it-works")}
            variant="outline"
            className="h-12 rounded-full border-[var(--el-muted)] bg-transparent px-6 text-[15px]"
          >
            작동 방식 보기
            <Play className="size-4" />
          </Button>
        </motion.div>

        <motion.p
          variants={fadeInUp}
          className="mt-4.5 text-[13px] text-[var(--el-body)]"
        >
          설치할 것 없음 · 신용카드 없음
        </motion.p>
      </motion.div>
    </section>
  );
}

const PROOF = [
  ["01", "회의 중", "말하는 동안 문단으로 쌓입니다"],
  ["02", "회의 직후", "개요 · 액션 · 인사이트로 갈립니다"],
  ["03", "그 다음", "Linear · GitHub 로 승인 후 나갑니다"],
] as const;

function Proof() {
  return (
    <motion.section
      {...reveal}
      id="how-it-works"
      className={`grid scroll-mt-24 gap-10 border-t border-[var(--el-hairline)] py-12 sm:grid-cols-3 sm:gap-0 ${GUTTER}`}
    >
      {PROOF.map(([step, title, detail], index) => (
        <motion.div
          key={step}
          variants={fadeInUp}
          className={
            index === 0
              ? "flex flex-col gap-2.5 sm:pr-10"
              : "flex flex-col gap-2.5 sm:border-l sm:border-[var(--el-hairline)] sm:px-10"
          }
        >
          <span className="font-serif text-[15px] font-light text-[var(--el-body)]">
            {step}
          </span>
          <h2 className="font-serif text-[30px] font-light tracking-[-0.5px] text-[var(--el-ink)]">
            {title}
          </h2>
          <p className="text-sm leading-[23px] text-[var(--el-body)]">
            {detail}
          </p>
        </motion.div>
      ))}
    </motion.section>
  );
}

const MISSIONS = [
  {
    step: "01",
    title: "맥락이 사람과 함께 사라진다",
    tag: "지금 되는 것 · 전사 · 요약 · 프로젝트별 묶기",
    problem:
      "팀 구성원의 변경과 이탈이 잦고, 그때마다 지난 회의의 맥락이 통째로 사라집니다. 새로 온 사람은 왜 그렇게 정해졌는지를 모른 채 같은 논의를 다시 시작합니다.",
    solution:
      "전사와 요약으로 지난 회의를 찾을 수 있게 하고, 프로젝트 단위 타임라인과 사람 사이의 관계로 전·후 맥락을 잇습니다.",
  },
  {
    step: "02",
    title: "회의 중에 이해가 막힌다",
    tag: "지금 되는 것 · 회의 중 질의 · Linear · GitHub 연동",
    problem:
      "모르는 용어가 나와도 회의를 멈추고 물어보기 어렵습니다. 회의 밖 프로젝트의 맥락도 그 자리에서는 확인할 수 없습니다.",
    solution:
      "회의 내용을 실시간으로 이해하는 에이전트를 옆에 둡니다. 용어를 풀어 주고, 연동된 도구에서 회의 밖 맥락까지 끌어옵니다.",
  },
  {
    step: "03",
    title: "회의가 원치 않는 방향으로 흐른다",
    tag: "방향 · 계약 추가가 먼저 필요합니다",
    problem:
      "누군가 딴 이야기를 하거나 이미 한 말을 반복해도 아무도 끊지 못합니다. 흐름과 이력을 관리하는 사람이 없습니다.",
    solution:
      "에이전트가 관전자가 아니라 참여자로 들어갑니다. 흐름을 짚고, 반복을 알아채고, 필요하면 안건으로 되돌립니다.",
  },
] as const;

function Missions() {
  return (
    <section
      className={`flex flex-col gap-12 bg-[var(--el-surface-strong)] py-20 lg:py-26 ${GUTTER}`}
    >
      <motion.div
        {...reveal}
        className="flex flex-col gap-8 lg:flex-row lg:items-end lg:gap-16"
      >
        <motion.div variants={fadeInUp} className="flex max-w-[700px] flex-col gap-5">
          <p className="text-[11px] font-semibold tracking-[1.6px] text-[var(--el-body)]">
            우리가 푸는 문제
          </p>
          <h2 className="font-serif text-[36px] leading-[1.14] font-light tracking-[-1px] break-keep text-[var(--el-ink)] lg:text-[52px] lg:leading-[59px] lg:tracking-[-1.4px]">
            회의는 끝나도
            <br />
            맥락은 끝나지 않는다.
          </h2>
        </motion.div>
        <motion.p
          variants={fadeInUp}
          className="text-sm leading-6 break-keep text-[var(--el-body)]"
        >
          아래 셋이 우리가 붙들고 있는 문제입니다.
          <br />
          전부 지금 되는 건 아니고, 순서대로 만들고 있습니다.
        </motion.p>
      </motion.div>

      <motion.div {...reveal} className="border-t border-[var(--el-hairline)]">
        {MISSIONS.map((mission) => (
          <motion.article
            key={mission.step}
            variants={fadeInUp}
            className="flex flex-col gap-6 border-b border-[var(--el-hairline)] py-8 lg:flex-row lg:gap-12"
          >
            <span className="font-serif text-[17px] font-light text-[var(--el-body)]">
              {mission.step}
            </span>
            <div className="flex flex-col gap-2.5 lg:w-[400px] lg:shrink-0">
              <h3 className="font-serif text-[28px] leading-[35px] font-light tracking-[-0.5px] break-keep text-[var(--el-ink)]">
                {mission.title}
              </h3>
              <p className="text-[11px] font-semibold text-[var(--el-body)]">
                {mission.tag}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-sm leading-[25px] break-keep text-[var(--el-body)]">
                {mission.problem}
              </p>
              <p className="text-sm leading-[25px] break-keep text-[var(--el-ink)]">
                {mission.solution}
              </p>
            </div>
          </motion.article>
        ))}
      </motion.div>
    </section>
  );
}

const FEATURES = [
  {
    icon: Mic,
    title: "실시간 전사",
    detail:
      "말하는 동안 문단으로 정리되고, 워크스페이스 멤버 전원이 같은 화면을 실시간으로 봅니다.",
  },
  {
    icon: MessageCircle,
    title: "회의 중 질의",
    detail:
      "「아까 그 결론이 뭐였지」를 회의 도중에 물어봅니다. 답은 스레드에 남아 모두가 봅니다.",
  },
  {
    icon: Sparkles,
    title: "자동 정리",
    detail: "회의가 끝나면 개요 · 액션 아이템 · 인사이트 세 갈래로 정리됩니다.",
  },
  {
    icon: Plug,
    title: "도구로 내보내기",
    detail:
      "액션 아이템을 Linear · GitHub 로 보냅니다. 실행 전에 반드시 승인을 받습니다.",
  },
] as const;

function Features() {
  return (
    <section
      id="features"
      className={`flex flex-col gap-12 border-t border-[var(--el-hairline)] py-20 lg:py-26 ${GUTTER}`}
    >
      <motion.div {...reveal} className="flex max-w-[760px] flex-col gap-5">
        <motion.p
          variants={fadeInUp}
          className="text-[11px] font-semibold tracking-[1.6px] text-[var(--el-body)]"
        >
          기능
        </motion.p>
        <motion.h2
          variants={fadeInUp} className="font-serif text-[36px] leading-[1.14] font-light tracking-[-1px] break-keep text-[var(--el-ink)] lg:text-[52px] lg:leading-[59px] lg:tracking-[-1.4px]">
          기록이 아니라
          <br />
          결과를 남깁니다.
        </motion.h2>
      </motion.div>

      <motion.div
        {...reveal}
        className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
      >
        {FEATURES.map(({ icon: Icon, title, detail }) => (
          <motion.div
            key={title}
            variants={fadeInUp}
            className="flex flex-col gap-4 border-l border-[var(--el-hairline)] pl-5"
          >
            <Icon className="size-4.5 text-[var(--el-ink)]" />
            <h3 className="font-serif text-2xl font-light tracking-[-0.4px] text-[var(--el-ink)]">
              {title}
            </h3>
            <p className="text-[13px] leading-[23px] break-keep text-[var(--el-body)]">
              {detail}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="relative isolate flex min-h-[400px] flex-col items-center justify-center overflow-hidden border-t border-[var(--el-hairline)] px-6 py-20 text-center sm:px-10 lg:h-[480px] lg:px-16 lg:py-0">
      <Orb
        color="--el-gradient-rose"
        alpha={45}
        style={{ left: "-6.9%", top: "25%", width: "45.8%", height: "95.8%" }}
      />
      <Orb
        color="--el-gradient-sky"
        alpha={42}
        style={{ left: "62.5%", top: "12.5%", width: "44.4%", height: "91.7%" }}
      />
      <Orb
        color="--el-gradient-mint"
        alpha={30}
        style={{ left: "29.2%", top: "45.8%", width: "38.9%", height: "79.2%" }}
      />

      <div className="relative flex flex-col items-center">
        <h2 className="font-serif text-[44px] leading-[1.1] font-light tracking-[-1.4px] text-[var(--el-ink)] lg:text-[68px] lg:leading-[75px] lg:tracking-[-2.2px]">
          다음 회의부터.
        </h2>
        <p className="mt-5 text-base leading-[30px] break-keep text-[var(--el-body)] lg:text-[17px]">
          Google 계정으로 로그인하고 회의를 하나 만들면 끝입니다.
          <br />
          설치할 것도, 팀에 새로 배울 것도 없습니다.
        </p>
        <LandingCta label="무료로 시작" className="mt-8" />
      </div>
    </section>
  );
}
