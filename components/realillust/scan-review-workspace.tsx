"use client";

import { useMemo, useState } from "react";
import {
  Check,
  CircleAlert,
  ClipboardCheck,
  Eye,
  ListChecks,
  PauseCircle,
  ShieldAlert,
  Tag,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { Decision, ReviewEvent, ReviewRegion } from "@/lib/mock-data";
import { DecisionBadge } from "./primitives";

type ScanReviewWorkspaceProps = {
  scan: {
    id: string;
    fileName: string;
    tenant: string;
    decision: Decision;
    aiScore: number;
    nsfwScore: number;
    metadata: string;
    createdAt: string;
    regions?: ReviewRegion[];
    events?: ReviewEvent[];
  };
};

const actions = [
  { label: "승인", value: "approve", icon: Check },
  { label: "라벨 요구", value: "label", icon: Tag },
  { label: "보류", value: "hold", icon: PauseCircle },
  { label: "차단", value: "block", icon: X },
] as const;

type ReviewAction = (typeof actions)[number]["value"];

const actionLabels: Record<ReviewAction, string> = {
  approve: "승인",
  label: "라벨 요구",
  hold: "보류",
  block: "차단",
};

const emptyRegions: ReviewRegion[] = [];
const emptyEvents: ReviewEvent[] = [];

export function ScanReviewWorkspace({ scan }: ScanReviewWorkspaceProps) {
  const regions = scan.regions ?? emptyRegions;
  const events = scan.events ?? emptyEvents;
  const [activeRegionId, setActiveRegionId] = useState(regions[0]?.id);
  const [selectedAction, setSelectedAction] = useState<ReviewAction>("label");

  const activeRegion = useMemo(
    () => regions.find((region) => region.id === activeRegionId) ?? regions[0],
    [activeRegionId, regions]
  );

  return (
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)]">
      <Card className="min-w-0 gap-0 py-0 shadow-[0_1px_2px_rgba(0,0,0,0.12)]">
        <CardHeader className="border-b py-5 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-black/45">
              {scan.id}
            </p>
            <CardTitle className="mt-2 text-2xl font-semibold tracking-[-0.01em] sm:text-3xl">
              {scan.fileName}
            </CardTitle>
            <CardDescription className="mt-2">
              {scan.tenant} · {scan.createdAt}
            </CardDescription>
          </div>
          <CardAction className="col-start-1 row-start-2 mt-3 flex flex-wrap items-center gap-2 justify-self-start sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:justify-self-end">
            <DecisionBadge decision={scan.decision} />
            <Badge className="bg-[var(--cg-mint)] text-[var(--cg-green)] hover:bg-[var(--cg-mint)]">
              <ListChecks data-icon="inline-start" />
              국소 영역 {regions.length}
            </Badge>
          </CardAction>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[56px_1fr]">
            <div className="flex gap-2 lg:flex-col">
              {[
                { label: "영역", icon: Eye },
                { label: "근거", icon: CircleAlert },
                { label: "조치", icon: ClipboardCheck },
              ].map((item) => (
                <span
                  key={item.label}
                  className="grid size-11 place-items-center rounded-full bg-[var(--cg-cream)] text-[var(--cg-green)] transition hover:bg-[var(--cg-mint)]"
                  aria-label={item.label}
                  title={item.label}
                >
                  <item.icon className="size-5" />
                </span>
              ))}
            </div>

            <div className="relative overflow-hidden rounded-xl bg-[#243a35] p-3 shadow-inner">
              <div
                className="relative aspect-[4/3] overflow-hidden rounded-lg"
                aria-label="의심 영역이 표시된 샘플 일러스트"
              >
                <SampleIllustration />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_36%,transparent_0_18%,rgba(30,57,50,0.10)_45%,rgba(30,57,50,0.20)_100%)]" />
                {regions.map((region) => {
                  const isActive = region.id === activeRegion?.id;
                  return (
                    <button
                      key={region.id}
                      type="button"
                      onClick={() => setActiveRegionId(region.id)}
                      className={cn(
                        "absolute rounded-lg border-2 text-left transition",
                        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                        isActive
                          ? "border-red-500 bg-red-500/20 shadow-[0_0_0_999px_rgba(30,57,50,0.14)]"
                          : "border-amber-400 bg-amber-300/14 hover:bg-amber-300/24"
                      )}
                      style={{
                        left: `${region.box.left}%`,
                        top: `${region.box.top}%`,
                        width: `${region.box.width}%`,
                        height: `${region.box.height}%`,
                      }}
                      aria-label={`${region.target} 검토 영역`}
                    >
                      <span
                        className={cn(
                          "absolute -top-3 left-3 rounded-full px-2 py-0.5 text-[11px] font-bold shadow-sm",
                          isActive
                            ? "bg-red-600 text-white"
                            : "bg-amber-300 text-black/80"
                        )}
                      >
                        {region.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <aside className="min-w-0 space-y-5">
        <Card className="gap-0 bg-[var(--cg-house)] py-0 text-white shadow-[0_16px_40px_rgba(30,57,50,0.18)]">
          <CardHeader className="py-5">
            <CardTitle className="text-xl font-semibold tracking-[-0.01em] text-white">
            전체 분석 신호
            </CardTitle>
            <CardDescription className="text-white/70">
              단일 확률로 차단하지 않고, 모델 점수와 메타데이터를 함께 검토합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <SignalMeter label="AI 생성 의심" value={scan.aiScore} />
            <SignalMeter label="NSFW/유해성" value={scan.nsfwScore} />
          </div>
          <div className="mt-4 rounded-xl border border-white/12 bg-white/8 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--cg-gold)]">
              metadata
            </p>
            <p className="mt-2 text-sm leading-6 text-white/78">
              {scan.metadata}
            </p>
          </div>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0 shadow-[0_1px_2px_rgba(0,0,0,0.12)]">
          <CardHeader className="grid-cols-[auto_1fr] py-5">
            <span className="grid size-11 place-items-center rounded-full bg-[var(--cg-mint)] text-[var(--cg-green)]">
              <ShieldAlert className="size-5" />
            </span>
            <div>
              <CardTitle className="text-xl font-semibold tracking-[-0.01em]">
                영역별 검토 근거
              </CardTitle>
              <CardDescription className="mt-1">
                AI 여부를 단정하지 않고, 운영자가 확인할 지점을 분리해 기록합니다.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="pb-5">
          {activeRegion ? (
            <div className="mt-5 rounded-xl border border-black/10 bg-[var(--cg-cream)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-black/55">
                    {activeRegion.label} · {activeRegion.target}
                  </p>
                  <p className="mt-1 text-3xl font-semibold tracking-[-0.01em]">
                    {activeRegion.risk}
                    <span className="ml-1 text-sm text-black/45">/100</span>
                  </p>
                </div>
                <Badge
                  variant={activeRegion.severity === "high" ? "destructive" : "secondary"}
                  className={cn(
                    "capitalize",
                    activeRegion.severity === "high"
                      ? "bg-red-50 text-red-800"
                      : "bg-amber-50 text-amber-900"
                  )}
                >
                  {activeRegion.severity}
                </Badge>
              </div>
              <Progress
                value={activeRegion.risk}
                className="mt-4 [&_[data-slot=progress-indicator]]:bg-[var(--cg-green-accent)] [&_[data-slot=progress-track]]:h-2"
              />
              <p className="mt-4 text-sm leading-6 text-black/70">
                {activeRegion.reason}
              </p>
              <p className="mt-3 rounded-lg bg-white p-3 text-sm leading-6 text-black/58">
                {activeRegion.evidence}
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-black/10 p-4 text-sm text-black/58">
              검토가 필요한 국소 영역이 없습니다.
            </div>
          )}

          <div className="mt-4 grid gap-2">
            {regions.map((region) => (
              <Button
                key={region.id}
                type="button"
                variant="outline"
                onClick={() => setActiveRegionId(region.id)}
                className={cn(
                  "h-auto justify-between rounded-xl px-4 py-3 text-left",
                  region.id === activeRegion?.id
                    ? "border-[var(--cg-green)] bg-[var(--cg-mint)] hover:bg-[var(--cg-mint)]"
                    : "hover:bg-[var(--cg-cream)]"
                )}
              >
                <span>
                  <span className="block text-sm font-semibold">
                    {region.label} {region.target}
                  </span>
                  <span className="mt-0.5 block text-xs text-black/55">
                    위험도 {region.risk}
                  </span>
                </span>
                <span className="text-xs font-semibold text-black/45">
                  보기
                </span>
              </Button>
            ))}
          </div>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0 shadow-[0_1px_2px_rgba(0,0,0,0.12)]">
          <CardHeader className="py-5">
            <CardTitle className="text-xl font-semibold tracking-[-0.01em]">
            운영 조치
            </CardTitle>
            <CardDescription>
              분석 결과는 조치 후보이고, 최종 결정은 운영자가 남깁니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-5">
          <ToggleGroup
            value={[selectedAction]}
            onValueChange={(value) => {
              const next = value.at(-1) as ReviewAction | undefined;
              if (next) setSelectedAction(next);
            }}
            className="grid w-full grid-cols-2 gap-2"
            variant="outline"
            size="lg"
          >
            {actions.map((action) => (
              <ToggleGroupItem
                key={action.label}
                value={action.value}
                className={cn(
                  "w-full rounded-full data-[state=on]:bg-[var(--cg-house)] data-[state=on]:text-white",
                  action.value === "block" &&
                    "text-red-700 data-[state=on]:bg-red-700"
                )}
              >
                <action.icon data-icon="inline-start" />
                {action.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="mt-4 rounded-xl bg-[var(--cg-cream)] p-4 text-sm leading-6 text-black/65">
            현재 선택: <strong>{actionLabels[selectedAction]}</strong>. 선택한 조치는 사용자·작품
            이력에 남겨 분쟁 대응 근거로 사용됩니다.
          </div>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0 shadow-[0_1px_2px_rgba(0,0,0,0.12)]">
          <CardHeader className="py-5">
            <CardTitle className="text-xl font-semibold tracking-[-0.01em]">
            처리 이력
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pb-5">
            {events.map((event) => (
              <div key={`${event.label}-${event.time}`} className="flex gap-3">
                <span className="mt-1 size-2 rounded-full bg-[var(--cg-green-accent)]" />
                <div>
                  <p className="text-sm font-semibold">{event.label}</p>
                  <p className="mt-1 text-xs text-black/50">
                    {event.actor} · {event.time}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-black/58">
                    {event.note}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function SignalMeter({ label, value }: { label: string; value: number }) {
  const score = Math.round(value * 100);

  return (
    <div className="rounded-xl border border-white/12 bg-white/8 p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white/70">{label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-[-0.01em]">
            {score}
          </p>
        </div>
        <span className="mb-1 text-sm font-semibold text-white/45">/100</span>
      </div>
      <Progress
        value={score}
        className="mt-4 [&_[data-slot=progress-indicator]]:bg-[var(--cg-gold)] [&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-white/16"
      />
    </div>
  );
}

function SampleIllustration() {
  return (
    <div className="absolute inset-0 bg-[#efe2cc]">
      <div className="absolute inset-x-0 top-0 h-[58%] bg-[linear-gradient(180deg,#cfe3d6_0%,#f1dfc9_100%)]" />
      <div className="absolute left-[7%] top-[9%] h-[34%] w-[22%] rounded-b-2xl bg-white/55 shadow-inner">
        <div className="absolute left-1/2 top-0 h-full w-px bg-[#8da99a]/45" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-[#8da99a]/45" />
      </div>
      <div className="absolute right-[8%] top-[18%] h-[38%] w-[25%] rounded-lg bg-[#6f8a69]/35">
        <div className="absolute inset-x-[12%] top-[22%] h-2 rounded-full bg-[#394b37]/45" />
        <div className="absolute inset-x-[18%] top-[45%] h-2 rounded-full bg-[#394b37]/35" />
        <div className="absolute inset-x-[10%] top-[68%] h-2 rounded-full bg-[#394b37]/30" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[30%] bg-[linear-gradient(135deg,#7f674d_0%,#c5a67a_52%,#6e8f7f_100%)]" />
      <div className="absolute bottom-[18%] left-[15%] h-[19%] w-[25%] rounded-t-full bg-[#5b4635]/75 blur-[1px]" />
      <div className="absolute bottom-[11%] right-[14%] h-[17%] w-[32%] rounded-t-2xl bg-[#57402f]/70" />
      <div className="absolute left-[36%] top-[16%] h-[25%] w-[19%] rounded-full bg-[#5d3b31]" />
      <div className="absolute left-[38%] top-[23%] h-[22%] w-[15%] rounded-[42%] bg-[#f3c6a7]" />
      <div className="absolute left-[36%] top-[42%] h-[34%] w-[22%] rounded-t-[48%] bg-[#31564d]" />
      <div className="absolute left-[31%] top-[49%] h-[11%] w-[16%] rotate-[-18deg] rounded-full bg-[#f1bd9f]" />
      <div className="absolute left-[48%] top-[49%] h-[11%] w-[15%] rotate-[18deg] rounded-full bg-[#f1bd9f]" />
      <div className="absolute left-[33%] top-[59%] h-[18%] w-[29%] rounded-lg bg-[#e6d4b7] shadow-[0_10px_24px_rgba(43,35,25,0.22)]" />
      <div className="absolute left-[37%] top-[63%] h-1 w-[19%] rounded-full bg-[#8f7658]" />
      <div className="absolute left-[39%] top-[68%] h-1 w-[13%] rounded-full bg-[#8f7658]/70" />
      <div className="absolute left-[17%] top-[46%] h-[17%] w-[5%] rounded-full bg-[#6a8a5e]" />
      <div className="absolute left-[19%] top-[42%] h-[10%] w-[10%] rounded-full bg-[#7ba871]/80" />
      <div className="absolute right-[22%] top-[50%] h-[20%] w-[5%] rounded-full bg-[#597b57]" />
      <div className="absolute right-[19%] top-[47%] h-[12%] w-[12%] rounded-full bg-[#86ad77]/75" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_45%_34%,rgba(255,255,255,0.28),transparent_28%),linear-gradient(90deg,rgba(255,255,255,0.10),transparent_45%,rgba(30,57,50,0.12))]" />
    </div>
  );
}
