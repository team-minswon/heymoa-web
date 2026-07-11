"use client";

import { motion, type Variants } from "motion/react";
import { Mic, ListChecks, BrainCircuit } from "lucide-react";

import { PageSection, Panel } from "@/components/heymoa/primitives";
import { siteConfig } from "@/lib/site";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteConfig.name,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: siteConfig.url,
  description: siteConfig.description,
};

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export default function Home() {
  return (
    <div className="relative overflow-hidden bg-[var(--clay-canvas)] text-[var(--clay-primary)]">
      {/* JSON-LD for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero Section */}
      <section className="relative border-b border-[var(--clay-hairline)] bg-[var(--clay-surface-soft)] py-16 sm:py-24">
        {/* Subtle grid background */}
        <div className="absolute inset-0 z-0 bg-[radial-gradient(var(--clay-hairline)_1px,transparent_1px)] [background-size:24px_24px] opacity-70" />
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent to-[var(--clay-canvas)]" />

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="flex flex-col items-center"
          >
            <motion.div
              variants={fadeInUp}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] px-3 py-1 text-xs font-semibold text-[var(--clay-brand-teal)]"
            >
              <BrainCircuit className="size-3.5" />
              <span>회의의 패러다임을 바꿉니다</span>
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="mt-8 text-4xl font-semibold tracking-[-0.03em] text-[var(--clay-primary)] sm:text-5xl lg:text-6xl lg:leading-[1.1] break-keep max-w-4xl mx-auto"
            >
              대화를 실제 업무로 연결하는<br />
              <span className="text-[var(--clay-brand-teal)]">참여형 AI Agent</span>
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="mt-6 max-w-2xl mx-auto text-base leading-8 text-[var(--clay-body)] sm:text-lg"
            >
              HeyMoa는 회의 중 함께 듣고, 필요한 순간 호출되어 현재 회의 맥락을 정리하고 후속 업무까지 연결하는 AI 회의 운영 에이전트 서비스입니다.
            </motion.p>

            <motion.div
              variants={fadeInUp}
              className="mt-10 flex flex-wrap justify-center gap-4"
            >
              <button
                onClick={() => {
                  const el = document.getElementById("features");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-[var(--clay-primary)] px-6 text-sm font-semibold text-white transition-all hover:bg-[var(--clay-brand-teal)] hover:shadow-lg focus:outline-none"
              >
                기능 소개 보기
              </button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Core Features Section */}
      <PageSection
        id="features"
        className="py-20 bg-[var(--clay-canvas)]"
      >
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--clay-primary)] sm:text-4xl">
            결과가 있는 회의를 만드세요
          </h2>
          <p className="mt-4 text-[var(--clay-body)]">
            AI를 호출하여 지금까지의 결정사항, 보류사항, 담당자별 할 일과 마감일을 즉시 확인할 수 있습니다.
          </p>
        </div>

        <motion.div
          className="mt-16 grid gap-6 md:grid-cols-3"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <motion.div variants={fadeInUp}>
            <Panel className="h-full border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] p-6 shadow-none">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--clay-surface-soft)] text-[var(--clay-primary)]">
                <Mic className="size-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-[var(--clay-primary)]">
                실시간 회의 참여
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--clay-body)]">
                단순히 녹음하는 것이 아니라 회의의 흐름을 이해하고 대화의 맥락을 파악하며 조용히 함께합니다.
              </p>
            </Panel>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <Panel className="h-full border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] p-6 shadow-none">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--clay-surface-soft)] text-[var(--clay-primary)]">
                <BrainCircuit className="size-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-[var(--clay-primary)]">
                즉각적인 맥락 정리
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--clay-body)]">
                회의가 겉돌거나 결론이 나지 않을 때 AI를 호출하세요. 지금까지 논의된 결정사항과 보류사항을 명확히 짚어줍니다.
              </p>
            </Panel>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <Panel className="h-full border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] p-6 shadow-none">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--clay-surface-soft)] text-[var(--clay-primary)]">
                <ListChecks className="size-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-[var(--clay-primary)]">
                액션 아이템 구조화
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--clay-body)]">
                회의 후 담당자별 할 일과 마감일을 정리하여 실행 가능한 업무로 즉시 변환합니다.
              </p>
            </Panel>
          </motion.div>
        </motion.div>
      </PageSection>

      {/* Usage Flow Section */}
      <PageSection id="how-it-works" className="py-20 bg-[var(--clay-surface-soft)] border-t border-[var(--clay-hairline)]">
        <div className="mx-auto max-w-3xl text-center mb-16">
          <h2 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--clay-primary)] sm:text-4xl">
            자연스럽게 회의에 스며듭니다
          </h2>
          <p className="mt-4 text-[var(--clay-body)]">
            기존의 회의 방식을 바꾸지 않아도 됩니다. 필요한 순간에만 개입합니다.
          </p>
        </div>

        <div className="mx-auto max-w-4xl space-y-4">
          <div className="flex items-start gap-4 rounded-xl border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] p-6">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--clay-primary)] text-white font-bold text-sm">
              1
            </div>
            <div>
              <h4 className="font-semibold text-[var(--clay-primary)]">회의 시작 및 청취</h4>
              <p className="mt-1 text-sm text-[var(--clay-body)]">HeyMoa를 회의에 초대하면 대화를 조용히 기록하며 문맥을 파악하기 시작합니다.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 rounded-xl border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] p-6">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--clay-primary)] text-white font-bold text-sm">
              2
            </div>
            <div>
              <h4 className="font-semibold text-[var(--clay-primary)]">AI 호출 및 피드백</h4>
              <p className="mt-1 text-sm text-[var(--clay-body)]">결정이 필요하거나 내용 정리가 필요할 때 언제든 AI를 호출하여 현재까지의 요약을 확인합니다.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 rounded-xl border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] p-6">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--clay-primary)] text-white font-bold text-sm">
              3
            </div>
            <div>
              <h4 className="font-semibold text-[var(--clay-primary)]">업무 할당 및 공유</h4>
              <p className="mt-1 text-sm text-[var(--clay-body)]">회의가 끝나면 도출된 Action Item이 담당자와 기한에 맞춰 구조화되어 정리됩니다.</p>
            </div>
          </div>
        </div>
      </PageSection>
    </div>
  );
}
