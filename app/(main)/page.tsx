"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Code,
  FileSignature,
  FileText,
  Fingerprint,
  Info,
  Layers,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Upload,
  Webhook,
} from "lucide-react";
import { AnimatePresence, motion, type Variants } from "motion/react";

import { PageSection, Panel } from "@/components/realillust/primitives";
import { siteConfig } from "@/lib/site";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteConfig.name,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  url: siteConfig.url,
  description: siteConfig.description,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "KRW",
  },
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
  // Interactive Upload Mockup State
  const [uploadStep, setUploadStep] = useState<
    "upload" | "analyzing" | "result"
  >("upload");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (uploadStep === "analyzing") {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => setUploadStep("result"), 500);
            return 100;
          }
          return prev + 8;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [uploadStep]);

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

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            {/* Left Content */}
            <motion.div
              className="lg:col-span-7"
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              <motion.div
                variants={fadeInUp}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] px-3 py-1 text-xs font-semibold text-[var(--clay-brand-teal)]"
              >
                <Info className="size-3.5" />
                <span>AI 여부 확정이 아닌 검토 보조</span>
              </motion.div>

              <motion.h1
                variants={fadeInUp}
                className="mt-6 text-4xl font-semibold tracking-[-0.03em] text-[var(--clay-primary)] sm:text-5xl lg:text-6xl lg:leading-[1.1] break-keep"
              >
                일러스트의 AI 생성 의심 신호를<span> </span>
                <span className="text-[var(--clay-brand-pink)]">
                  한눈에 확인하세요
                </span>
              </motion.h1>

              <motion.p
                variants={fadeInUp}
                className="mt-6 max-w-2xl text-base leading-8 text-[var(--clay-body)] sm:text-lg"
              >
                이미지를 업로드하면 메타데이터, 전체 이미지 특징, 국소 의심
                영역을 종합해 추가 검토가 필요한 근거를 시각적으로 제공합니다.
              </motion.p>

              <motion.div
                variants={fadeInUp}
                className="mt-10 flex flex-wrap gap-4"
              >
                <button
                  onClick={() => {
                    const el = document.getElementById("analyze-box");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-[var(--clay-primary)] px-6 text-sm font-semibold text-white transition-all hover:bg-[var(--clay-brand-teal)] hover:shadow-lg focus:outline-none"
                >
                  무료로 이미지 분석하기
                </button>
                <button
                  onClick={() => {
                    const el = document.getElementById("example-section");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-[var(--clay-hairline)] bg-[var(--clay-canvas)] px-6 text-sm font-semibold text-[var(--clay-primary)] transition-all hover:bg-[var(--clay-surface-soft)] focus:outline-none"
                >
                  결과 예시 보기
                </button>
              </motion.div>
            </motion.div>

            {/* Right Interactive Mockup Card */}
            <motion.div
              className="lg:col-span-5"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.8,
                ease: "easeOut",
                delay: 0.2,
              }}
              id="analyze-box"
            >
              <div className="rounded-2xl border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] p-6 shadow-sm">
                <AnimatePresence mode="wait">
                  {uploadStep === "upload" && (
                    <motion.div
                      key="upload-zone"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--clay-surface-soft)] text-[var(--clay-primary)]">
                        <Upload className="size-6" />
                      </div>
                      <h3 className="mt-4 text-base font-semibold text-[var(--clay-primary)]">
                        검토할 이미지 업로드
                      </h3>
                      <p className="mt-1 text-xs text-[var(--clay-muted)]">
                        일러스트 파일을 드래그하거나 선택하세요
                      </p>

                      <div className="mt-5 w-full rounded-xl border border-dashed border-[var(--clay-hairline)] bg-[var(--clay-canvas)] p-8 text-center transition-colors hover:bg-[var(--clay-surface-soft)]">
                        <Upload className="mx-auto size-8 text-[var(--clay-muted-soft)]" />
                        <span className="mt-3 block text-xs text-[var(--clay-muted)]">
                          JPG, PNG, WEBP 지원 · 최대 20MB
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          setProgress(0);
                          setUploadStep("analyzing");
                        }}
                        className="mt-6 flex w-full h-11 items-center justify-center gap-2 rounded-xl bg-[var(--clay-primary)] text-sm font-semibold text-white transition hover:bg-[var(--clay-brand-teal)]"
                      >
                        분석 시작하기
                        <ArrowRight className="size-4" />
                      </button>

                      <div className="mt-4 flex gap-2 rounded-lg bg-[var(--clay-surface-soft)] border border-[var(--clay-hairline)] p-3 text-left">
                        <AlertCircle className="size-4 shrink-0 text-[var(--clay-brand-ochre)]" />
                        <span className="text-[11px] leading-relaxed text-[var(--clay-body)]">
                          분석 결과는 AI 생성 여부를 확정하지 않으며, 의심
                          근거를 확인하기 위한 참고 자료입니다.
                        </span>
                      </div>
                    </motion.div>
                  )}

                  {uploadStep === "analyzing" && (
                    <motion.div
                      key="analyzing-zone"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center py-10"
                    >
                      <div className="relative flex items-center justify-center">
                        <RefreshCw className="size-12 animate-spin text-[var(--clay-primary)]" />
                        <span className="absolute text-xs font-bold text-[var(--clay-primary)]">
                          {progress}%
                        </span>
                      </div>
                      <h3 className="mt-6 text-base font-semibold text-[var(--clay-primary)]">
                        이미지 분석 진행 중
                      </h3>
                      <p className="mt-1 text-xs text-[var(--clay-muted)]">
                        메타데이터 분석 및 국소 영역을 스캔하고 있습니다.
                      </p>

                      <div className="mt-8 w-full max-w-xs space-y-2">
                        <div className="h-1.5 w-full rounded-full bg-[var(--clay-surface-soft)] overflow-hidden">
                          <div
                            className="h-full bg-[var(--clay-brand-pink)] transition-all duration-100 ease-out"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] font-semibold text-[var(--clay-muted)]">
                          <span>Metadata Extraction</span>
                          <span>{progress > 40 ? "Done" : "Scanning..."}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {uploadStep === "result" && (
                    <motion.div
                      key="result-zone"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col"
                    >
                      <div className="flex items-center justify-between border-b border-[var(--clay-hairline)] pb-4">
                        <div>
                          <span className="text-xs font-bold text-[var(--clay-muted-soft)] uppercase">
                            Analysis Complete
                          </span>
                          <h3 className="text-base font-semibold text-[var(--clay-primary)]">
                            검사 결과 리포트
                          </h3>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-semibold text-[var(--clay-brand-pink)] bg-[var(--clay-brand-pink)]/10 border border-[var(--clay-brand-pink)]/20 px-2 py-0.5 rounded-full">
                            확인 필요
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 space-y-4">
                        {/* Score Indicator */}
                        <div className="flex items-center justify-between rounded-xl border border-[var(--clay-hairline)] bg-[var(--clay-surface-soft)] p-4">
                          <div>
                            <span className="text-xs font-semibold text-[var(--clay-body)]">
                              검토 필요 지수
                            </span>
                            <p className="text-[11px] text-[var(--clay-muted)] leading-tight">
                              AI 생성 신호의 세기를 계산한 수치
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-bold text-[var(--clay-primary)]">
                              72
                            </span>
                            <span className="text-xs text-[var(--clay-muted)]">
                              {" "}
                              / 100
                            </span>
                          </div>
                        </div>

                        {/* Evidence Checklist */}
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[var(--clay-body)] flex items-center gap-2">
                              <CheckCircle2 className="size-3.5 text-[var(--clay-brand-teal)]" />
                              메타데이터 분석
                            </span>
                            <span className="font-semibold text-[var(--clay-primary)]">
                              추출 완료 (수정 의심)
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[var(--clay-body)] flex items-center gap-2">
                              <CheckCircle2 className="size-3.5 text-[var(--clay-brand-teal)]" />
                              전체 이미지 특징 분석
                            </span>
                            <span className="font-semibold text-[var(--clay-primary)]">
                              패턴 감지됨
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[var(--clay-body)] flex items-center gap-2">
                              <CheckCircle2 className="size-3.5 text-[var(--clay-brand-teal)]" />
                              국소 의심 영역 해석
                            </span>
                            <span className="font-semibold text-[var(--clay-primary)]">
                              손/배경 확인 필요
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setUploadStep("upload")}
                        className="mt-6 flex w-full h-11 items-center justify-center gap-2 rounded-xl border border-[var(--clay-hairline)] text-sm font-semibold text-[var(--clay-primary)] bg-[var(--clay-canvas)] transition hover:bg-[var(--clay-surface-soft)]"
                      >
                        <RefreshCw className="size-4" />새 이미지 검사하기
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Problem Setting Section */}
      <PageSection className="py-20 bg-[var(--clay-canvas)]">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--clay-primary)] sm:text-4xl">
            AI 일러스트인지, 감으로만 판단하기 어려워졌습니다
          </h2>
          <p className="mt-4 text-[var(--clay-body)]">
            기술의 발전으로 정교해진 이미지 파일은 육안 관찰만으로 생성 흔적을
            식별하는 데 한계가 있습니다.
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
                <FileSignature className="size-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-[var(--clay-primary)]">
                메타데이터 누락 및 위조
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--clay-body)]">
                카메라 정보나 소프트웨어 기록이 누락되거나 위조된 경우, 창작
                출처나 편집 이력을 명확히 증명하기 어렵습니다.
              </p>
            </Panel>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <Panel className="h-full border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] p-6 shadow-none">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--clay-surface-soft)] text-[var(--clay-primary)]">
                <Sparkles className="size-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-[var(--clay-primary)]">
                정교한 전체 구도
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--clay-body)]">
                얼핏 보기에 구도와 라이팅이 자연스러워 보이지만, AI 고유의
                반복적 브러시 결이나 픽셀 왜곡 패턴이 숨어있을 수 있습니다.
              </p>
            </Panel>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <Panel className="h-full border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] p-6 shadow-none">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--clay-surface-soft)] text-[var(--clay-primary)]">
                <Fingerprint className="size-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-[var(--clay-primary)]">
                일부 국소 영역 이상
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--clay-body)]">
                전체적인 인상은 완벽하지만, 세부적인 손가락 묘사, 선화 결합부,
                복잡한 장식 패턴 등에서 비논리적인 구조적 모순이 관찰됩니다.
              </p>
            </Panel>
          </motion.div>
        </motion.div>
      </PageSection>

      {/* Core Features Section */}
      <PageSection
        id="features-section"
        className="py-20 bg-[var(--clay-surface-soft)] border-y border-[var(--clay-hairline)]"
      >
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--clay-primary)] sm:text-4xl">
            업로드 한 번으로 3단계 Evidence 분석
          </h2>
          <p className="mt-4 text-[var(--clay-body)]">
            진짜그림은 3가지 독립적인 레이어에서 추출한 데이터를 종합하여
            과학적인 분석 리포트를 제공합니다.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          <div className="relative flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--clay-surface-card)] border border-[var(--clay-hairline)] text-[var(--clay-primary)]">
              <FileText className="size-7" />
            </div>
            <span className="mt-4 text-xs font-bold text-[var(--clay-brand-pink)] uppercase tracking-wider">
              1단계
            </span>
            <h3 className="mt-2 text-xl font-semibold text-[var(--clay-primary)]">
              메타데이터 추출
            </h3>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--clay-body)]">
              EXIF, 생성 도구 흔적, 수정 여부 등 이미지 파일에 고스란히 남아
              있는 구조적 파일 정보를 먼저 판독합니다.
            </p>
          </div>

          <div className="relative flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--clay-surface-card)] border border-[var(--clay-hairline)] text-[var(--clay-primary)]">
              <Layers className="size-7" />
            </div>
            <span className="mt-4 text-xs font-bold text-[var(--clay-brand-pink)] uppercase tracking-wider">
              2단계
            </span>
            <h3 className="mt-2 text-xl font-semibold text-[var(--clay-primary)]">
              전체 이미지 분석
            </h3>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--clay-body)]">
              이미지 전반의 텍스처 질감, 구도, 시각적 일관성 및 필터링 흔적을
              정밀 검사해 AI 생성 알고리즘 신호를 탐지합니다.
            </p>
          </div>

          <div className="relative flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--clay-surface-card)] border border-[var(--clay-hairline)] text-[var(--clay-primary)]">
              <Sliders className="size-7" />
            </div>
            <span className="mt-4 text-xs font-bold text-[var(--clay-brand-pink)] uppercase tracking-wider">
              3단계
            </span>
            <h3 className="mt-2 text-xl font-semibold text-[var(--clay-primary)]">
              국소 영역 히트맵
            </h3>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--clay-body)]">
              손가락 묘사, 부자연스러운 선화, 기하학적 배경 장식 등 정밀 육안
              검토가 요구되는 스팟을 히트맵으로 도식화합니다.
            </p>
          </div>
        </div>
      </PageSection>

      {/* Example Results Section */}
      <PageSection
        className="py-20 bg-[var(--clay-canvas)]"
        id="example-section"
      >
        <div className="mx-auto max-w-3xl text-center mb-16">
          <h2 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--clay-primary)] sm:text-4xl">
            명확하게 시각화된 판독 Evidence 제공
          </h2>
          <p className="mt-4 text-[var(--clay-body)]">
            이상 징후 강도에 따라 세분화된 스캔 정보와 정성적 신호 요약을
            직관적으로 제공합니다.
          </p>
        </div>

        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          {/* Left Canvas showing Evidence Strength instead of image illustration */}
          <div className="lg:col-span-6">
            <div className="rounded-2xl border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] p-6">
              <h3 className="font-semibold text-lg text-[var(--clay-primary)]">
                분석 레이어별 탐지 신호 (Evidence Layer)
              </h3>
              <p className="text-xs text-[var(--clay-muted)] mt-1">
                파일의 각 계층별 탐지 신호 강도 상세
              </p>
              <div className="mt-6 space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>메타데이터 수정 흔적</span>
                    <span className="text-[var(--clay-brand-pink)]">
                      높음 (85%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--clay-canvas)] overflow-hidden border border-[var(--clay-hairline)]">
                    <div
                      className="h-full bg-[var(--clay-brand-pink)]"
                      style={{ width: "85%" }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>텍스처 알고리즘 패턴</span>
                    <span className="text-[var(--clay-brand-ochre)]">
                      의심 (65%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--clay-canvas)] overflow-hidden border border-[var(--clay-hairline)]">
                    <div
                      className="h-full bg-[var(--clay-brand-ochre)]"
                      style={{ width: "65%" }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>국소 기하 불일치 신호</span>
                    <span className="text-[var(--clay-brand-pink)]">
                      검토 (75%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--clay-canvas)] overflow-hidden border border-[var(--clay-hairline)]">
                    <div
                      className="h-full bg-[var(--clay-brand-pink)]"
                      style={{ width: "75%" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Summary Details */}
          <div className="lg:col-span-6 space-y-6">
            <div className="rounded-2xl border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] p-6">
              <div className="flex items-center justify-between pb-4 border-b border-[var(--clay-hairline)]">
                <h3 className="text-lg font-semibold text-[var(--clay-primary)]">
                  검토 의심 영역 분석 요약
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--clay-brand-pink)]/10 px-2.5 py-0.5 text-xs font-semibold text-[var(--clay-brand-pink)] border border-[var(--clay-brand-pink)]/20">
                  확인 필요 (72 / 100)
                </span>
              </div>

              {/* Steps completed */}
              <div className="mt-5 space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-[var(--clay-muted-soft)] uppercase tracking-wider">
                    Evidence Status
                  </h4>
                  <ul className="mt-3 space-y-2">
                    <li className="flex items-center justify-between text-sm">
                      <span className="text-[var(--clay-body)]">
                        · 메타데이터 추출 완료
                      </span>
                      <span className="font-semibold text-[var(--clay-primary)]">
                        Done
                      </span>
                    </li>
                    <li className="flex items-center justify-between text-sm">
                      <span className="text-[var(--clay-body)]">
                        · 전체 이미지 판단 완료
                      </span>
                      <span className="font-semibold text-[var(--clay-primary)]">
                        Done
                      </span>
                    </li>
                    <li className="flex items-center justify-between text-sm">
                      <span className="text-[var(--clay-body)]">
                        · 국소 영역 판단 완료
                      </span>
                      <span className="font-semibold text-[var(--clay-primary)]">
                        Done
                      </span>
                    </li>
                    <li className="flex items-center justify-between text-sm">
                      <span className="text-[var(--clay-body)]">
                        · Evidence 요약 생성 완료
                      </span>
                      <span className="font-semibold text-[var(--clay-primary)]">
                        Done
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="border-t border-[var(--clay-hairline)] pt-4">
                  <h4 className="text-xs font-bold text-[var(--clay-muted-soft)] uppercase tracking-wider">
                    Spot Analysis
                  </h4>
                  <ul className="mt-3 space-y-2">
                    <li className="flex items-center justify-between text-sm">
                      <span className="text-[var(--clay-body)]">
                        손/묘사 영역
                      </span>
                      <span className="font-semibold text-[var(--clay-brand-pink)]">
                        확인 필요
                      </span>
                    </li>
                    <li className="flex items-center justify-between text-sm">
                      <span className="text-[var(--clay-body)]">
                        배경/구도 영역
                      </span>
                      <span className="font-semibold text-[var(--clay-brand-pink)]">
                        확인 필요
                      </span>
                    </li>
                    <li className="flex items-center justify-between text-sm">
                      <span className="text-[var(--clay-body)]">
                        선화/결합 영역
                      </span>
                      <span className="font-semibold text-[var(--clay-muted)]">
                        낮음
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex gap-3 rounded-xl bg-[var(--clay-surface-soft)] border border-[var(--clay-hairline)] p-4">
              <Info className="size-5 shrink-0 text-[var(--clay-muted)] mt-0.5" />
              <p className="text-xs leading-relaxed text-[var(--clay-body)]">
                <strong>결과 해석 안내</strong>: 이 점수는 AI 생성 확률을
                나타내지 않습니다. 판정에 혼란을 줄 수 있는 이상 징후 특징 및
                메타데이터 변형 등 추가 확인이 요구되는 시각적 신호의 복합적
                강도를 의미합니다.
              </p>
            </div>
          </div>
        </div>
      </PageSection>

      {/* Usage Flow Section */}
      <PageSection className="py-20 bg-[var(--clay-surface-soft)] border-t border-[var(--clay-hairline)]">
        <div className="mx-auto max-w-3xl text-center mb-16">
          <h2 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--clay-primary)] sm:text-4xl">
            복잡한 설정 없이 바로 분석할 수 있습니다
          </h2>
          <p className="mt-4 text-[var(--clay-body)]">
            업로드부터 분석 결과 확인까지의 간단하고 직관적인 흐름을 안내합니다.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-5">
          {[
            {
              step: "01",
              title: "이미지 업로드",
              desc: "분석할 일러스트 파일 등록",
            },
            {
              step: "02",
              title: "분석 요청",
              desc: "스캔 단추로 3단계 검사 개시",
            },
            {
              step: "03",
              title: "파일 및 이미지 스캔",
              desc: "메타데이터 및 시각 패턴 감별",
            },
            {
              step: "04",
              title: "의심 영역 확인",
              desc: "히트맵 정보와 상세 리포트 판독",
            },
            {
              step: "05",
              title: "결과 저장 / 재분석",
              desc: "이력 보존 또는 신규 작업",
            },
          ].map((flow) => (
            <div
              key={flow.step}
              className="relative rounded-xl border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] p-5 shadow-none text-center"
            >
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center justify-center size-7 rounded-full bg-[var(--clay-primary)] text-xs font-bold text-white shadow-none">
                {flow.step}
              </span>
              <h4 className="mt-4 font-semibold text-[var(--clay-primary)] text-sm">
                {flow.title}
              </h4>
              <p className="mt-2 text-xs leading-relaxed text-[var(--clay-muted)]">
                {flow.desc}
              </p>
            </div>
          ))}
        </div>
      </PageSection>

      {/* Free Usage Policy Section */}
      <PageSection
        id="policy-section"
        className="py-20 bg-[var(--clay-canvas)]"
      >
        <div className="mx-auto max-w-4xl rounded-2xl border border-[var(--clay-hairline)] bg-gradient-to-tr from-[var(--clay-primary)] to-[var(--clay-brand-teal)] p-8 text-white shadow-none sm:p-12 relative overflow-hidden">
          <div className="absolute right-0 top-0 size-72 bg-white/5 blur-3xl rounded-full" />
          <div className="relative z-10 grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                로그인 없이 먼저 사용해보세요
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-300">
                회원가입의 불편함 없이 무료로 신속하게 첫 분석을 개시할 수
                있습니다. 추가 이력 조회가 필요할 때만 구글로 간편 로그인하세요.
              </p>
              <div className="mt-6 flex gap-2 items-center text-xs text-slate-400">
                <Lock className="size-4 text-[var(--clay-brand-peach)]" />
                <span>
                  비로그인 사용량 정보는 암호화된 접속 식별 데이터를 기반으로
                  철저하고 안전하게 보호됩니다.
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <h3 className="font-semibold text-sm">비로그인 무료 체험</h3>
                <p className="mt-1 text-xs text-slate-400">
                  계정 등록 없이 최대 3회 무료 일러스트 분석 가능
                </p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <h3 className="font-semibold text-sm">Google 로그인 혜택</h3>
                <p className="mt-1 text-xs text-slate-400">
                  한도 증가 혜택 및 업로드한 분석 히스토리 안전 보관
                </p>
              </div>
            </div>
          </div>
        </div>
      </PageSection>

      {/* Future Expansion Section */}
      <PageSection className="py-20 bg-[var(--clay-surface-soft)] border-t border-[var(--clay-hairline)]">
        <div className="mx-auto max-w-3xl text-center mb-16">
          <span className="text-xs font-bold text-[var(--clay-brand-pink)] uppercase tracking-widest">
            Coming Soon
          </span>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-[var(--clay-primary)] sm:text-4xl">
            웹 서비스에서 API 검수 엔진으로 확장됩니다
          </h2>
          <p className="mt-4 text-[var(--clay-body)]">
            대용량 이미지 모니터링이 필요한 플랫폼과 기업을 위한 B2B 확장 연동
            기술을 준비 중입니다.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] p-6 shadow-none">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--clay-surface-soft)] text-[var(--clay-primary)]">
              <Code className="size-5" />
            </div>
            <h3 className="mt-4 font-semibold text-[var(--clay-primary)]">
              이미지 분석 API
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--clay-muted)]">
              Public URL 전달, Multipart FormData 업로드, AWS S3 Presigned URL
              지원을 통해 어떤 인프라 환경이든 쉽게 이미지 데이터를 전달할 수
              있도록 준비 중입니다.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] p-6 shadow-none">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--clay-surface-soft)] text-[var(--clay-primary)]">
              <Webhook className="size-5" />
            </div>
            <h3 className="mt-4 font-semibold text-[var(--clay-primary)]">
              비동기 분석 & Webhook
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--clay-muted)]">
              대량의 유저 업로드 이미지를 대기 시간 없이 비동기로 수집하고,
              분석이 완료되는 즉시 콜백 Webhook을 받아 자동 후처리를 엮을 수
              있습니다.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] p-6 shadow-none">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--clay-surface-soft)] text-[var(--clay-primary)]">
              <Sliders className="size-5" />
            </div>
            <h3 className="mt-4 font-semibold text-[var(--clay-primary)]">
              정책 기반 자동 검수
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--clay-muted)]">
              서비스 운영 기준치에 따라 검토 필요도가 높은 이미지는 즉시 공개
              임시 보류, 수동 검토 대기, 또는 자동 차단 정책을 적용하도록 정교한
              설정 기능을 갖출 예정입니다.
            </p>
          </div>
        </div>
      </PageSection>

      {/* Trust and Limits Disclosure Section */}
      <PageSection className="py-20 bg-[var(--clay-canvas)] border-t border-[var(--clay-hairline)]">
        <div className="mx-auto max-w-4xl rounded-2xl border border-[var(--clay-hairline)] bg-[var(--clay-surface-soft)] p-8 sm:p-10">
          <div className="flex flex-col md:flex-row md:items-start gap-8">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--clay-surface-card)] border border-[var(--clay-hairline)] text-[var(--clay-primary)]">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--clay-primary)]">
                진짜그림은 확정 판정기가 아니라 검토 보조 도구입니다
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--clay-body)]">
                진짜그림의 핵심 철학은 AI 이미지 판별의 기술적 한계를 인정하는
                데서 시작합니다. 어떠한 시스템도 AI 생성 여부를 100% 확정 지어
                단언할 수 없습니다.
              </p>
              <ul className="mt-6 space-y-3 text-xs text-[var(--clay-body)]">
                <li className="flex items-start gap-2.5">
                  <span className="inline-block size-1.5 rounded-full bg-[var(--clay-brand-pink)] mt-1.5 shrink-0" />
                  <span>
                    AI 생성 확률이나 정답을 도출하는 판정기가 아니며, 시각적
                    기하 신호 강도와 파일 구조 정보를 보여주는 검토 도구입니다.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="inline-block size-1.5 rounded-full bg-[var(--clay-brand-pink)] mt-1.5 shrink-0" />
                  <span>
                    최종 게재 및 통과 여부는 플랫폼의 서비스 운영 기준과 담당
                    전문가의 세부 검토 단계가 병행되어야 합니다.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="inline-block size-1.5 rounded-full bg-[var(--clay-brand-pink)] mt-1.5 shrink-0" />
                  <span>
                    저희는 창작자 필터링 또는 검열이 아닌, 불투명했던 시각 이상
                    징후에 대해 구체적이고 객관적인 데이터 해석 근거를 투명하게
                    제공함을 목표합니다.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </PageSection>

      {/* Final CTA Section */}
      <section className="relative bg-[var(--clay-surface-soft)] border-t border-[var(--clay-hairline)] py-16 sm:py-24 text-center">
        {/* Subtle grid background */}
        <div className="absolute inset-0 z-0 bg-[radial-gradient(var(--clay-hairline)_0.5px,transparent_0.5px)] [background-size:24px_24px] opacity-30" />
        <div className="relative z-10 mx-auto max-w-4xl px-4">
          <h2 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--clay-primary)] sm:text-4xl">
            지금 일러스트를 업로드하고 의심 영역을 확인해보세요
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[var(--clay-body)] text-sm">
            복잡한 설치 과정 없이 무료로 바로 테스트해 볼 수 있습니다.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <button
              onClick={() => {
                const el = document.getElementById("analyze-box");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-[var(--clay-primary)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--clay-brand-teal)] focus:outline-none"
            >
              이미지 분석 시작하기
            </button>
            <button
              onClick={() => {
                const el = document.getElementById("example-section");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-[var(--clay-hairline)] bg-[var(--clay-canvas)] px-6 text-sm font-semibold text-[var(--clay-primary)] transition hover:bg-[var(--clay-surface-soft)] focus:outline-none"
            >
              결과 예시 보기
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
