import { useTranslations } from "next-intl";

import { BUSINESS_INFO, type BusinessInfo } from "@/lib/business-info";
import { cn } from "@/lib/utils";

const HANGUL = /[가-힣]/;

const langOf = (value: string) => (HANGUL.test(value) ? "ko" : undefined);

const LINES: ReadonlyArray<ReadonlyArray<keyof BusinessInfo>> = [
  ["owner", "registration", "mailOrder"],
  ["address"],
  ["email", "phone"],
];

const LABELED: ReadonlySet<keyof BusinessInfo> = new Set([
  "owner",
  "registration",
  "mailOrder",
]);

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
