import { HELP_MEDIA } from "@/lib/help/media-manifest";
import { HELP_MEDIA_EN } from "@/lib/help/media-manifest-en";

type HelpMediaKey = keyof typeof HELP_MEDIA;

type Size = { width: number; height: number };

export function localizedHelpMedia(key: HelpMediaKey, locale: string): Size & { path: string } {
  const english = locale === "en" ? (HELP_MEDIA_EN as Partial<Record<string, Size>>)[key] : undefined;
  if (english) return { path: `en/${key}`, width: english.width, height: english.height };
  const { width, height } = HELP_MEDIA[key];
  return { path: key, width, height };
}
