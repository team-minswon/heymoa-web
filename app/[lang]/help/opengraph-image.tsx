import { helpOgImage, helpOgSize } from "@/lib/help/og";
import { siteConfig } from "@/lib/site";

export const alt = `${siteConfig.brandLabel} 사용법`;
export const size = helpOgSize;
export const contentType = "image/png";

export default function Image() {
  return helpOgImage(
    "사용 가이드",
    "회의 기록부터 요약 검토, 할 일, 내 에이전트까지 기능별·상황별로 찾아 읽어 보세요."
  );
}
