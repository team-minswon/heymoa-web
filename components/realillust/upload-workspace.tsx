"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, FileImage, Loader2, UploadCloud } from "lucide-react";

const steps = ["업로드 수신", "S3 저장", "AI/NSFW 분석", "정책 판정"];

export function UploadWorkspace() {
  const [fileName, setFileName] = useState("campaign-hero.webp");
  const [isScanning, setIsScanning] = useState(false);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
      <div className="rounded-2xl bg-[var(--cg-house)] p-6 text-white shadow-[0_16px_40px_rgba(30,57,50,0.18)] sm:p-8">
        <div className="flex min-h-[420px] flex-col justify-between gap-10">
          <div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.01em] sm:text-5xl">
              이미지 업로드부터 정책 판정까지 한 화면에서 확인합니다.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/78">
              AI 생성 의심, NSFW/유해성, 메타데이터 신호를 조합해 allow, label_required,
              review_required, block 중 하나로 비동기 판정하는 MVP 콘솔입니다.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step} className="rounded-xl border border-white/14 bg-white/8 p-4">
                <div className="text-sm font-semibold text-[var(--cg-gold)]">0{index + 1}</div>
                <div className="mt-3 text-sm font-semibold text-white">{step}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.1)]">
        <label
          htmlFor="image-upload"
          className="flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--cg-green)]/35 bg-[var(--cg-cream)] px-6 py-10 text-center transition hover:bg-[var(--cg-ceramic)]"
        >
          <UploadCloud className="size-12 text-[var(--cg-green-accent)]" />
          <span className="mt-5 text-xl font-semibold">검사할 이미지를 선택하세요</span>
          <span className="mt-2 max-w-sm text-sm leading-6 text-black/58">
            JPEG, PNG, WebP. MVP 제한은 10MB이며 원본 이미지는 기본 24시간 후 삭제됩니다.
          </span>
          <input
            id="image-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) setFileName(file.name);
            }}
          />
        </label>

        <div className="mt-5 rounded-xl border border-black/10 p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-[var(--cg-mint)] text-[var(--cg-green)]">
              <FileImage className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{fileName}</p>
              <p className="text-xs text-black/55">익명 검사 · public tenant</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsScanning(true);
              window.setTimeout(() => setIsScanning(false), 900);
            }}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--cg-green-accent)] px-5 text-sm font-semibold text-white transition active:scale-95"
          >
            {isScanning ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
            검사 job 생성
          </button>
          <Link
            href="/scans/scan_9K2P1"
            className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--cg-green)] px-5 text-sm font-semibold text-[var(--cg-green)] transition hover:bg-[var(--cg-green)] hover:text-white"
          >
            샘플 결과 보기
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
