import { helpAxisOf } from "@/app/[lang]/help/_content/paths";
import { helpTopicsFor } from "@/app/[lang]/help/_content/topics";
import { buildHelpIndex } from "@/lib/help/search-index";
import { isLocale, LOCALES } from "@/lib/i18n/locales";

export const dynamic = "force-static";
export const dynamicParams = false;
export const generateStaticParams = () => LOCALES.map((lang) => ({ lang }));

/** Route Handler 는 `next/root-params` 를 못 써서 언어를 `[lang]` params 로 받습니다. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lang: string }> }
) {
  const { lang } = await params;
  if (!isLocale(lang)) return new Response(null, { status: 404 });
  return Response.json(buildHelpIndex(helpTopicsFor(lang), helpAxisOf, lang));
}
