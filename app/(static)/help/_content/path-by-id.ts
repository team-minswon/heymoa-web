import { HELP_PAGES, type HelpPageId } from "@/app/(static)/help/_content/ids";

/** id 만 알 때의 주소(`HelpLink`·본문 안 링크). 페이지 목록을 불러오지 않아 순환이 없다. */
export const helpPathById = (id: HelpPageId) => `/help/${HELP_PAGES[id]}/${id}`;
