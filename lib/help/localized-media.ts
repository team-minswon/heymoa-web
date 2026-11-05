import { HELP_MEDIA } from "@/lib/help/media-manifest";
import { HELP_MEDIA_EN } from "@/lib/help/media-manifest-en";

export type HelpMediaKey = keyof typeof HELP_MEDIA;

type Size = { width: number; height: number };

/**
 * 가이드 이미지·영상을 페이지 언어로 고른다 (APP-1511).
 *
 * 영어 페이지는 영어 화면·영어 회의로 찍은 `public/help/en/<키>` 를 쓰고, 영어 파일이 없는 항목(데스크톱 앱 창처럼
 * 아직 한국어로만 찍을 수 있는 장면)은 한국어 파일 `public/help/<키>` 로 대체한다. 크기는 고른 파일의 목록에서 읽는다.
 *
 * `path` 는 `public/help/` 아래 경로다. 영상은 확장자를 뺀 키(`clips/new-meeting`)라 호출부가 `.webm` 등을 붙인다.
 */
export function localizedHelpMedia(key: HelpMediaKey, locale: string): Size & { path: string } {
  const english = locale === "en" ? (HELP_MEDIA_EN as Partial<Record<string, Size>>)[key] : undefined;
  if (english) return { path: `en/${key}`, width: english.width, height: english.height };
  const { width, height } = HELP_MEDIA[key];
  return { path: key, width, height };
}
