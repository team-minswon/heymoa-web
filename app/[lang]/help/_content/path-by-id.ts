import { HELP_PAGES, type HelpPageId } from "@/app/[lang]/help/_content/ids";

export const helpPathById = (id: HelpPageId) => `/help/${HELP_PAGES[id]}/${id}`;
