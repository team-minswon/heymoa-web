import { useTranslations } from "next-intl";

import { BUSINESS_INFO, type BusinessInfo } from "@/lib/business-info";

const HANGUL = /[가-힣]/;

/**
 * 푸터 하단의 사업자 정보. 상호가 없으면 그리지 않고, 있으면 값이 있는 항목만 「라벨 값」으로 이어 쓴다.
 * 상호 · 대표자 · 주소는 등록증에 적힌 한글 그대로라 영어 페이지에서도 옮기지 않고 `lang="ko"` 를 단다
 * (푸터 언어 선택의 「한국어」와 같은 처리).
 */
export function BusinessInfoLine({
  info = BUSINESS_INFO,
}: {
  info?: BusinessInfo;
}) {
  const t = useTranslations("landing.footer.business");
  if (!info.name) return null;
  const rows = (Object.keys(info) as Array<keyof BusinessInfo>).filter(
    (key) => info[key]
  );
  return (
    <dl
      aria-label={t("label")}
      className="m-0 flex basis-full flex-wrap gap-x-4 gap-y-0.5 text-[12px] leading-[1.6] text-[var(--tv-muted)]"
    >
      {rows.map((key) => (
        <div key={key} className="flex gap-1.5">
          <dt>{t(key)}</dt>
          <dd className="m-0" lang={HANGUL.test(info[key]) ? "ko" : undefined}>
            {info[key]}
          </dd>
        </div>
      ))}
    </dl>
  );
}
