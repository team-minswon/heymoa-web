import { helpAxisOf } from "@/app/[lang]/help/_content/paths";
import { helpTopics } from "@/app/[lang]/help/_content/topics";
import { buildHelpIndex } from "@/lib/help/search-index";

export const dynamic = "force-static";

/** 가이드 전 페이지의 검색 색인. 빌드 때 한 번 만들고, 검색창을 처음 쓸 때만 내려받는다(페이지마다 싣지 않는다). */
export const GET = () => Response.json(buildHelpIndex(helpTopics, helpAxisOf));
