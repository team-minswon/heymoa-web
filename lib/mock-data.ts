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
    fileName: "campaign-hero.webp",
    tenant: "public",
    decision: "label_required" as Decision,
    aiScore: 0.84,
    nsfwScore: 0.03,
    metadata: "C2PA 없음, 생성툴 흔적",
    createdAt: "2026-06-15 10:42",
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
