import Link from "next/link";
import { ArrowLeft, CheckCircle2, ExternalLink, FileSearch, ShieldAlert } from "lucide-react";

import { AppShell } from "@/components/minswon/app-shell";
import { DecisionBadge, PageSection, Panel } from "@/components/minswon/primitives";
import { scans } from "@/lib/mock-data";

export default async function ScanResultPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const { scanId } = await params;
  const scan = scans.find((item) => item.id === scanId) ?? scans[0];

  return (
    <AppShell>
      <PageSection>
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-black/60">
          <ArrowLeft className="size-4" />
          검사 화면으로
        </Link>
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
          <Panel className="overflow-hidden">
            <div className="bg-[var(--cg-house)] p-6 text-white">
              <p className="text-sm font-semibold text-white/65">{scan.id}</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.01em]">{scan.fileName}</h1>
              <div className="mt-5">
                <DecisionBadge decision={scan.decision} />
              </div>
            </div>
            <div className="grid gap-px bg-black/10 sm:grid-cols-2">
              <ScoreBlock label="AI 생성 의심" value={scan.aiScore} />
              <ScoreBlock label="NSFW/유해성" value={scan.nsfwScore} />
            </div>
          </Panel>

          <Panel className="p-6">
            <div className="flex items-start gap-4">
              <span className="grid size-12 place-items-center rounded-full bg-[var(--cg-mint)] text-[var(--cg-green)]">
                <FileSearch className="size-6" />
              </span>
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.01em]">검사 근거</h2>
                <p className="mt-2 text-sm leading-6 text-black/58">
                  모델 결과는 확정 판정이 아니라 risk signal로 저장되고, 최종 decision은 정책 엔진이 만듭니다.
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {[
                ["파일 검증", "JPEG/PNG/WebP 허용 범위, 10MB 제한 통과"],
                ["메타데이터", scan.metadata],
                ["정책 엔진", "tenant threshold 기준으로 label_required 권고"],
                ["보관 정책", "원본 이미지는 24시간 TTL, 결과 메타데이터 보관"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-black/10 p-4">
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="mt-1 text-sm leading-6 text-black/58">{value}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel className="p-6">
            <ShieldAlert className="size-6 text-[var(--cg-green)]" />
            <h2 className="mt-4 text-xl font-semibold">추천 조치</h2>
            <p className="mt-2 text-sm leading-6 text-black/58">
              AI 생성 의심 점수가 높으므로 게시 전 AI 생성 라벨을 요구하고, 반복 업로드 tenant는 threshold를 낮춥니다.
            </p>
          </Panel>
          <Panel className="p-6">
            <CheckCircle2 className="size-6 text-[var(--cg-green)]" />
            <h2 className="mt-4 text-xl font-semibold">공유 가능한 결과 URL</h2>
            <p className="mt-2 text-sm leading-6 text-black/58">
              결과 URL은 고객 응대와 내부 검수 기록에 사용할 수 있습니다.
            </p>
            <Link
              href="/admin/review"
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-[var(--cg-green-accent)] px-4 text-sm font-semibold text-white"
            >
              검수 큐로 이동
              <ExternalLink className="size-4" />
            </Link>
          </Panel>
        </div>
      </PageSection>
    </AppShell>
  );
}

function ScoreBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-black/55">{label}</p>
          <p className="mt-2 text-4xl font-semibold tracking-[-0.01em]">{Math.round(value * 100)}</p>
        </div>
        <span className="mb-2 text-sm font-semibold text-black/45">/100</span>
      </div>
      <div className="mt-5 h-2 rounded-full bg-black/10">
        <div
          className="h-full rounded-full bg-[var(--cg-green-accent)]"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
    </div>
  );
}
