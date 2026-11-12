import { useTranslations } from "next-intl";

import { BUSINESS_INFO, type BusinessInfo } from "@/lib/business-info";
import { cn } from "@/lib/utils";

const HANGUL = /[가-힣]/;

/** 상호 · 대표자 · 주소는 등록증에 적힌 한글 그대로라 영어 페이지에서도 옮기지 않고 그 언어를 밝힌다. */
const langOf = (value: string) => (HANGUL.test(value) ? "ko" : undefined);

/** 푸터에서 한 줄에 함께 적는 묶음: 등록 정보 → 주소 → 연락처. */
const LINES: ReadonlyArray<ReadonlyArray<keyof BusinessInfo>> = [
  ["owner", "registration", "mailOrder"],
  ["address"],
  ["email", "phone"],
];

/** 라벨을 보이는 항목. 누구이고 무슨 번호인지는 적어야 알고, 주소 · 메일 · 전화는 값이 스스로 말한다. */
const LABELED: ReadonlySet<keyof BusinessInfo> = new Set([
  "owner",
  "registration",
  "mailOrder",
]);

/**
 * 랜딩 푸터 하단의 사업자 정보. 상호를 굵게 한 줄 두고, 그 아래 등록 정보 · 주소 · 연락처를 줄로 나눠 가운뎃점으로
 * 이어 쓴다. 상호가 없으면 그리지 않고 값이 빈 항목(신고 전의 통신판매업 신고번호)은 건너뛴다. 라벨을 감춘 항목도
 * 읽어 주는 도구에는 라벨이 들린다.
 */
export function BusinessInfoBlock({
  info = BUSINESS_INFO,
}: {
  info?: BusinessInfo;
}) {
  const t = useTranslations("landing.footer.business");
  if (!info.name) return null;
  return (
    <div
      role="group"
      aria-label={t("label")}
      className="text-[13px] leading-[1.7] text-[var(--tv-muted)]"
    >
      <p
        className="m-0 text-[14px] font-bold text-[var(--tv-ink)]"
        lang={langOf(info.name)}
      >
        {info.name}
      </p>
      {LINES.map((keys) => {
        const shown = keys.filter((key) => info[key]);
        if (shown.length === 0) return null;
        return (
          <dl key={keys[0]} className="m-0 mt-1 flex flex-wrap gap-x-2">
            {shown.map((key) => (
              <div
                key={key}
                className="flex gap-1.5 not-first:before:content-['·']"
              >
                <dt className={LABELED.has(key) ? undefined : "sr-only"}>
                  {t(key)}
                </dt>
                <dd className="m-0" lang={langOf(info[key])}>
                  {info[key]}
                </dd>
              </div>
            ))}
          </dl>
        );
      })}
    </div>
  );
}

/**
 * 「라벨 값」을 한 줄로 이어 쓰는 사업자 정보 목록. 라벨과 글자 색을 밖에서 받아, 랜딩 문구 묶음(`landing`)이
 * 실리지 않는 면(결제 페이지)이 같은 값을 그린다.
 */
export function BusinessInfoList({
  info = BUSINESS_INFO,
  label,
  labelOf,
  className,
}: {
  info?: BusinessInfo;
  label: string;
  labelOf: (key: keyof BusinessInfo) => string;
  className?: string;
}) {
  if (!info.name) return null;
  const rows = (Object.keys(info) as Array<keyof BusinessInfo>).filter(
    (key) => info[key]
  );
  return (
    <dl
      aria-label={label}
      className={cn(
        "m-0 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] leading-[1.6]",
        className
      )}
    >
      {rows.map((key) => (
        <div key={key} className="flex gap-1.5">
          <dt>{labelOf(key)}</dt>
          <dd className="m-0" lang={langOf(info[key])}>
            {info[key]}
          </dd>
        </div>
      ))}
    </dl>
  );
}
