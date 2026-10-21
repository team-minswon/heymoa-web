import { helpAxisOf } from "@/app/[lang]/help/_content/paths";
import { helpTopicsFor } from "@/app/[lang]/help/_content/topics";
import { buildHelpIndex } from "@/lib/help/search-index";
import { isLocale, LOCALES } from "@/lib/i18n/locales";

export const dynamic = "force-static";
export const dynamicParams = false;
export const generateStaticParams = () => LOCALES.map((lang) => ({ lang }));

/**
 * 가이드 전 페이지의 검색 색인. 언어판마다 한 벌(`/help/search-index.json`, `/en/help/search-index.json`)이고 결과 주소도
 * 그 언어판이다. 빌드 때 한 번 만들고, 검색창을 처음 쓸 때만 내려받는다(페이지마다 싣지 않는다).
 * Route Handler 는 `next/root-params` 를 못 쓰므로 언어는 `[lang]` 세그먼트의 params 로 받는다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lang: string }> }
) {
  const { lang } = await params;
  if (!isLocale(lang)) return new Response(null, { status: 404 });
  return Response.json(buildHelpIndex(helpTopicsFor(lang), helpAxisOf, lang));
}
