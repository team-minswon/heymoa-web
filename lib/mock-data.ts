import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Clock3,
  Eye,
  FileImage,
  ShieldCheck,
} from "lucide-react";

export type Decision = "allow" | "label_required" | "review_required" | "block";

export type ReviewRegion = {
  id: string;
  label: string;
  target: string;
  risk: number;
  severity: "medium" | "high";
  reason: string;
  evidence: string;
  box: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
};

export type ReviewEvent = {
  label: string;
  actor: string;
  time: string;
  note: string;
};

export const decisionMeta: Record<
  Decision,
  {
    label: string;
    tone: string;
    icon: typeof ShieldCheck;
  }
> = {
  allow: {
    label: "allow",
    tone: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    icon: ShieldCheck,
  },
  label_required: {
    label: "label required",
    tone: "bg-amber-50 text-amber-900 ring-amber-200",
    icon: BadgeCheck,
  },
  review_required: {
    label: "review required",
    tone: "bg-orange-50 text-orange-900 ring-orange-200",
    icon: Eye,
  },
  block: {
    label: "block",
    tone: "bg-red-50 text-red-800 ring-red-200",
    icon: Ban,
  },
};

export const summaryCards = [
  { label: "오늘 검사", value: "1,284", delta: "+18.4%", icon: FileImage },
  { label: "검수 대기", value: "37", delta: "-6건", icon: Clock3 },
  { label: "차단 판정", value: "82", delta: "6.4%", icon: AlertTriangle },
  { label: "Webhook 성공률", value: "98.7%", delta: "+1.1%", icon: ShieldCheck },
];

export const scans = [
  {
    id: "scan_9K2P1",
    fileName: "atelier-character.png",
    tenant: "contest-alpha",
    decision: "review_required" as Decision,
    aiScore: 0.84,
    nsfwScore: 0.03,
    metadata: "C2PA 없음, EXIF 소프트웨어 필드 제거됨",
    createdAt: "2026-06-15 10:42",
    regions: [
      {
        id: "region_hand",
        label: "R1",
        target: "손 구조",
        risk: 88,
        severity: "high",
        reason: "손가락 관절과 엄지 방향이 주변 팔 선화와 맞지 않습니다.",
        evidence: "세부 골격 경계가 흐려지고 손가락 사이 간격이 불규칙합니다.",
        box: { left: 31, top: 47, width: 20, height: 22 },
      },
      {
        id: "region_line",
        label: "R2",
        target: "선화 밀도",
        risk: 73,
        severity: "medium",
        reason: "얼굴 주변 선화는 또렷하지만 머리카락 끝 선이 갑자기 녹아듭니다.",
        evidence: "동일 조명 영역 안에서 선 두께와 채색 경계가 급격히 바뀝니다.",
        box: { left: 42, top: 18, width: 22, height: 26 },
      },
      {
        id: "region_bg",
        label: "R3",
        target: "배경 패턴",
        risk: 69,
        severity: "medium",
        reason: "창가 식물과 선반 소품의 반복 패턴이 원근과 맞지 않습니다.",
        evidence: "작은 장식물의 형태가 반복되지만 그림자 방향은 서로 다릅니다.",
        box: { left: 64, top: 27, width: 24, height: 31 },
      },
    ] satisfies ReviewRegion[],
    events: [
      {
        label: "자동 분석 완료",
        actor: "analysis-worker",
        time: "10:43",
        note: "국소 영역 3곳을 review_required 근거로 저장",
      },
      {
        label: "운영 검수 배정",
        actor: "ops-minsu",
        time: "10:45",
        note: "공모전 제출작 기준으로 라벨 요구 여부 확인 필요",
      },
    ] satisfies ReviewEvent[],
  },
  {
    id: "scan_8AD77",
    fileName: "profile-update.png",
    tenant: "marketplace-a",
    decision: "review_required" as Decision,
    aiScore: 0.62,
    nsfwScore: 0.31,
    metadata: "EXIF 제거됨",
    createdAt: "2026-06-15 10:38",
    regions: [
      {
        id: "region_texture",
        label: "R1",
        target: "피부 질감",
        risk: 64,
        severity: "medium",
        reason: "얼굴 경계와 배경 사이의 질감 해상도가 다릅니다.",
        evidence: "후보정 또는 생성 보정 가능성이 있어 수동 확인이 필요합니다.",
        box: { left: 38, top: 24, width: 18, height: 24 },
      },
    ] satisfies ReviewRegion[],
    events: [
      {
        label: "자동 분석 완료",
        actor: "analysis-worker",
        time: "10:39",
        note: "질감 불일치 근거로 검수 큐에 등록",
      },
    ] satisfies ReviewEvent[],
  },
  {
    id: "scan_51KLM",
    fileName: "ugc-product.jpg",
    tenant: "commerce-beta",
    decision: "block" as Decision,
    aiScore: 0.27,
    nsfwScore: 0.91,
    metadata: "위험 카테고리 감지",
    createdAt: "2026-06-15 10:31",
    regions: [] satisfies ReviewRegion[],
    events: [
      {
        label: "정책 차단",
        actor: "policy-engine",
        time: "10:31",
        note: "유해성 threshold 초과로 즉시 block 권고",
      },
    ] satisfies ReviewEvent[],
  },
  {
    id: "scan_47QPA",
    fileName: "review-photo.jpeg",
    tenant: "public",
    decision: "allow" as Decision,
    aiScore: 0.12,
    nsfwScore: 0.01,
    metadata: "카메라 EXIF 확인",
    createdAt: "2026-06-15 10:22",
    regions: [] satisfies ReviewRegion[],
    events: [
      {
        label: "자동 허용",
        actor: "policy-engine",
        time: "10:22",
        note: "검토 대상 영역 없음, allow 처리",
      },
    ] satisfies ReviewEvent[],
  },
];

export const webhookLogs = [
  {
    id: "wh_1029",
    tenant: "marketplace-a",
    endpoint: "https://client.example.com/hooks/content",
    status: "delivered",
    attempts: 1,
    latency: "184ms",
  },
  {
    id: "wh_1028",
    tenant: "commerce-beta",
    endpoint: "https://commerce.example.com/moderation",
    status: "retrying",
    attempts: 3,
    latency: "timeout",
  },
  {
    id: "wh_1027",
    tenant: "media-lab",
    endpoint: "https://media.example.com/webhook",
    status: "delivered",
    attempts: 2,
    latency: "221ms",
  },
];

export const apiKeys = [
  {
    name: "Production upload API",
    prefix: "cg_live_7nA",
    tenant: "marketplace-a",
    limit: "12,000 req/day",
    lastUsed: "4분 전",
  },
  {
    name: "Preview integration",
    prefix: "cg_test_2rQ",
    tenant: "commerce-beta",
    limit: "1,000 req/day",
    lastUsed: "어제",
  },
];
