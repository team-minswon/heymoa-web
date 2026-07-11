"use client";

import { motion, type Variants } from "motion/react";
import { Mic, ListChecks, BrainCircuit, Play, Pause, Check } from "lucide-react";
import { useState } from "react";

import { PageSection } from "@/components/heymoa/primitives";
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
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
  },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

export function LandingClient() {
  const [isPlaying, setIsPlaying] = useState(true);

  // Mock Voice Library/Agents List
  const agents = [
    { id: "plan", name: "Moa Plan", role: "기획 맥락 요약 & 보류사항 정리", initial: "P" },
    { id: "dev", name: "Moa Dev", role: "개발 스펙 정의 & 액션 아이템 구조화", initial: "D" },
    { id: "design", name: "Moa Design", role: "디자인 피드백 취합 & 마일스톤 생성", initial: "A" },
  ];

  return (
    <div className="relative overflow-hidden bg-[var(--el-canvas)] text-[var(--el-ink)] min-h-screen">
      {/* JSON-LD for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Atmospheric Gradient Orbs (ElevenLabs brand voltage) */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Orb 1: Mint (Top Left) */}
        <div className="absolute -top-[20%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-[radial-gradient(circle_at_center,var(--el-gradient-mint)_0%,transparent_70%)] opacity-35 blur-[120px]" />
        {/* Orb 2: Peach (Top Right) */}
        <div className="absolute -top-[10%] -right-[10%] w-[45vw] h-[45vw] rounded-full bg-[radial-gradient(circle_at_center,var(--el-gradient-peach)_0%,transparent_70%)] opacity-30 blur-[100px]" />
        {/* Orb 3: Lavender (Center Left) */}
        <div className="absolute top-[40%] -left-[20%] w-[60vw] h-[60vw] rounded-full bg-[radial-gradient(circle_at_center,var(--el-gradient-lavender)_0%,transparent_70%)] opacity-25 blur-[150px]" />
        {/* Orb 4: Sky (Bottom Right) */}
        <div className="absolute bottom-[10%] -right-[15%] w-[55vw] h-[55vw] rounded-full bg-[radial-gradient(circle_at_center,var(--el-gradient-sky)_0%,transparent_70%)] opacity-30 blur-[130px]" />
      </div>

      {/* Hero Section */}
      <section className="relative z-10 py-20 sm:py-32">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="flex flex-col items-center"
          >
            <motion.div
              variants={fadeInUp}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--el-hairline)] bg-white px-3.5 py-1 text-xs font-semibold text-[var(--el-muted)] tracking-wider uppercase"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>HeyMoa AI Agent Platform</span>
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="mt-8 font-serif font-light text-5xl tracking-[-0.03em] leading-[1.08] text-[var(--el-ink)] sm:text-6xl lg:text-7xl break-keep max-w-4xl"
            >
              대화를 실제 업무로 연결하는<br />
              참여형 AI 에이전트
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="mt-8 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed text-[var(--el-body)] tracking-[0.16px]"
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
                className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--el-primary)] px-6 text-[15px] font-medium text-white transition hover:bg-[var(--el-primary-active)] shadow-sm focus:outline-none"
              >
                자세히 알아보기
              </button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Core Features Section */}
      <PageSection
        id="features"
        className="relative z-10 py-24 border-t border-[var(--el-hairline)]"
      >
        <div className="mx-auto max-w-3xl text-center mb-16">
          <h2 className="font-serif font-light text-3xl sm:text-4xl tracking-[-0.02em] text-[var(--el-ink)]">
            결과가 있는 회의를 만드세요
          </h2>
          <p className="mt-4 text-[15px] text-[var(--el-body)] tracking-[0.16px]">
            AI를 호출하여 지금까지의 결정사항, 보류사항, 담당자별 할 일과 마감일을 즉시 확인하고 구조화할 수 있습니다.
          </p>
        </div>

        <motion.div
          className="grid gap-8 md:grid-cols-3"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          {/* Feature 1: Real-time Audio Waveform */}
          <motion.div variants={fadeInUp} className="flex flex-col">
            <div className="flex-1 rounded-2xl border border-[var(--el-hairline)] bg-white p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)] flex flex-col justify-between min-h-[300px]">
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--el-surface-strong)] text-[var(--el-ink)]">
                  <Mic className="size-5" />
                </div>
                <h3 className="mt-5 font-serif font-light text-2xl text-[var(--el-ink)]">
                  실시간 회의 경청
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--el-body)] tracking-[0.16px]">
                  회의의 흐름을 이해하고 대화의 맥락을 분석하며 조용히 대화를 기록합니다.
                </p>
              </div>

              {/* Audio Waveform Graphic (ElevenLabs signature) */}
              <div className="mt-6 p-4 rounded-xl bg-[var(--el-canvas-soft)] border border-[var(--el-hairline-soft)] flex items-center gap-3">
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--el-primary)] text-white hover:bg-[var(--el-primary-active)] transition shrink-0"
                >
                  {isPlaying ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current translate-x-[1px]" />}
                </button>
                <div className="flex-1 flex items-end gap-[3px] h-8 px-2">
                  {[0.3, 0.6, 0.9, 0.4, 0.7, 0.2, 0.5, 0.8, 0.6, 0.3, 0.7, 0.9, 0.4, 0.8, 0.5, 0.2, 0.6, 0.9, 0.3, 0.7, 0.5].map((val, idx) => (
                    <motion.div
                      key={idx}
                      className="w-[3px] bg-[var(--el-primary)] rounded-full"
                      animate={{
                        height: isPlaying ? `${val * 100}%` : "15%",
                      }}
                      transition={{
                        repeat: Infinity,
                        repeatType: "reverse",
                        duration: 0.6 + (idx % 3) * 0.15,
                        ease: "easeInOut",
                      }}
                      style={{ height: "15%" }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Feature 2: Context Summarization */}
          <motion.div variants={fadeInUp} className="flex flex-col">
            <div className="flex-1 rounded-2xl border border-[var(--el-hairline)] bg-white p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)] flex flex-col justify-between min-h-[300px]">
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--el-surface-strong)] text-[var(--el-ink)]">
                  <BrainCircuit className="size-5" />
                </div>
                <h3 className="mt-5 font-serif font-light text-2xl text-[var(--el-ink)]">
                  즉각적인 맥락 정리
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--el-body)] tracking-[0.16px]">
                  결정이 필요하거나 맥락이 꼬일 때 AI를 호출하세요. 결정사항과 보류사항을 명확히 요약합니다.
                </p>
              </div>

              {/* Editorial UI Fragment */}
              <div className="mt-6 p-4 rounded-xl bg-[var(--el-canvas-soft)] border border-[var(--el-hairline-soft)] text-xs space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-emerald-600">결정</span>
                  <span className="text-[var(--el-ink)] truncate font-medium">서비스 디자인 톤앤매너를 ElevenLabs 스타일로 변경</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-amber-600">보류</span>
                  <span className="text-[var(--el-ink)] truncate font-medium">실시간 다국어 번역 탑재 여부 (다음 주 재논의)</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Feature 3: Action Items */}
          <motion.div variants={fadeInUp} className="flex flex-col">
            <div className="flex-1 rounded-2xl border border-[var(--el-hairline)] bg-white p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)] flex flex-col justify-between min-h-[300px]">
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--el-surface-strong)] text-[var(--el-ink)]">
                  <ListChecks className="size-5" />
                </div>
                <h3 className="mt-5 font-serif font-light text-2xl text-[var(--el-ink)]">
                  액션 아이템 구조화
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--el-body)] tracking-[0.16px]">
                  회의 후 도출된 담당자별 업무와 마감일을 자동으로 분류하여 실행 가능한 테스크로 연결합니다.
                </p>
              </div>

              {/* Task UI Fragment */}
              <div className="mt-6 p-4 rounded-xl bg-[var(--el-canvas-soft)] border border-[var(--el-hairline-soft)] text-xs space-y-2">
                <div className="flex items-center justify-between border-b border-[var(--el-hairline-soft)] pb-1.5">
                  <span className="font-semibold text-[var(--el-ink)]">할 일 목록</span>
                  <span className="text-[var(--el-muted)]">기한</span>
                </div>
                <div className="flex items-center justify-between text-[var(--el-body)]">
                  <span className="truncate flex items-center gap-1.5"><Check className="size-3 text-emerald-500" /> 랜딩 페이지 리뉴얼</span>
                  <span className="shrink-0 text-red-500 font-medium">오늘</span>
                </div>
                <div className="flex items-center justify-between text-[var(--el-body)]">
                  <span className="truncate flex items-center gap-1.5"><Check className="size-3 text-emerald-500" /> OAuth API 연동 테스트</span>
                  <span className="shrink-0">내일</span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </PageSection>

      {/* Voice/Agent Showroom Section (ElevenLabs signature layout) */}
      <PageSection id="agents" className="relative z-10 py-24 border-t border-[var(--el-hairline)] bg-[var(--el-canvas-soft)]">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr] items-center">
          <div>
            <h2 className="font-serif font-light text-3xl sm:text-4xl tracking-[-0.02em] leading-tight text-[var(--el-ink)]">
              필요에 맞는<br />회의 운영 에이전트 라이브러리
            </h2>
            <p className="mt-4 text-[15px] text-[var(--el-body)] tracking-[0.16px] leading-relaxed">
              회의의 어젠다와 주제에 따라 특화된 전문 AI 에이전트를 호출하여 보다 깊이 있고 구조화된 대화 기록을 구축할 수 있습니다.
            </p>
          </div>

          <div className="space-y-4">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between rounded-xl border border-[var(--el-hairline)] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-center gap-4">
                  {/* Voice Circular Icon (ElevenLabs component) */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--el-surface-strong)] text-sm font-semibold text-[var(--el-ink)]">
                    {agent.initial}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-[var(--el-ink)]">{agent.name}</h4>
                    <p className="text-xs text-[var(--el-muted)] mt-0.5">{agent.role}</p>
                  </div>
                </div>
                <button className="flex h-8 px-3 items-center justify-center rounded-full border border-[var(--el-hairline-strong)] text-[12px] font-medium text-[var(--el-ink)] bg-transparent hover:bg-[var(--el-canvas-soft)] transition">
                  선택
                </button>
              </div>
            ))}
          </div>
        </div>
      </PageSection>

      {/* Usage Flow Section */}
      <PageSection id="how-it-works" className="relative z-10 py-24 border-t border-[var(--el-hairline)]">
        <div className="mx-auto max-w-3xl text-center mb-16">
          <h2 className="font-serif font-light text-3xl sm:text-4xl tracking-[-0.02em] text-[var(--el-ink)]">
            자연스럽게 회의에 스며듭니다
          </h2>
          <p className="mt-4 text-[15px] text-[var(--el-body)] tracking-[0.16px]">
            기존의 대화 방식을 바꾸지 않아도 됩니다. 필요한 순간에만 활성화됩니다.
          </p>
        </div>

        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex items-start gap-5 rounded-2xl border border-[var(--el-hairline)] bg-white p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--el-primary)] text-white font-medium text-xs">
              1
            </div>
            <div>
              <h4 className="font-medium text-base text-[var(--el-ink)]">회의 시작 및 청취</h4>
              <p className="mt-1.5 text-sm text-[var(--el-body)] tracking-[0.16px]">HeyMoa 에이전트가 회의실에 참여하여 대화를 자연스럽게 기록하고 흐름을 읽기 시작합니다.</p>
            </div>
          </div>
          <div className="flex items-start gap-5 rounded-2xl border border-[var(--el-hairline)] bg-white p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--el-primary)] text-white font-medium text-xs">
              2
            </div>
            <div>
              <h4 className="font-medium text-base text-[var(--el-ink)]">AI 호출 및 즉각 요약</h4>
              <p className="mt-1.5 text-sm text-[var(--el-body)] tracking-[0.16px]">결정이 필요하거나 정리가 필요할 때 에이전트를 호출하여 현재까지의 합의된 내용과 논의를 확인합니다.</p>
            </div>
          </div>
          <div className="flex items-start gap-5 rounded-2xl border border-[var(--el-hairline)] bg-white p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--el-primary)] text-white font-medium text-xs">
              3
            </div>
            <div>
              <h4 className="font-medium text-base text-[var(--el-ink)]">실행 업무 연동</h4>
              <p className="mt-1.5 text-sm text-[var(--el-body)] tracking-[0.16px]">회의 종료 후 최종 도출된 액션 아이템이 담당자별 기한에 맞춰 체계적으로 구조화되어 저장됩니다.</p>
            </div>
          </div>
        </div>
      </PageSection>
    </div>
  );
}
