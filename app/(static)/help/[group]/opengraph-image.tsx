import { helpGroups } from "@/app/(static)/help/_content/groups";
import { helpGroupBySlug } from "@/app/(static)/help/_content/paths";
import { helpOgImage, helpOgSize } from "@/lib/help/og";
import { siteConfig } from "@/lib/site";

export const alt = `${siteConfig.brandLabel} 사용법`;
export const size = helpOgSize;
export const contentType = "image/png";

export const generateStaticParams = () =>
  helpGroups.map(({ slug }) => ({ group: slug }));

export default async function Image({
  params,
}: {
  params: Promise<{ group: string }>;
}) {
  const group = helpGroupBySlug((await params).group);
  return helpOgImage(group?.title ?? "사용법", group?.summary ?? "");
}
