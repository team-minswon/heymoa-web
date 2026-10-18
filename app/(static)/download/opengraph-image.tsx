import { helpOgImage, helpOgSize } from "@/lib/help/og";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-static";
export const alt = `${siteConfig.brandLabel} 데스크톱 앱 다운로드`;
export const size = helpOgSize;
export const contentType = "image/png";

export default function Image() {
  return helpOgImage(
    "데스크톱 앱 다운로드",
    "Mac · Windows에서 화상회의 상대방 소리까지 녹음해요",
    "헤이모아 데스크톱 앱"
  );
}
