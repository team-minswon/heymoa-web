import { helpTopicByPath } from "@/app/[lang]/help/_content/paths";
import { helpTopics } from "@/app/[lang]/help/_content/topics";
import { helpOgImage, helpOgSize } from "@/lib/help/og";
import { siteConfig } from "@/lib/site";

export const alt = `${siteConfig.brandLabel} 사용법`;
export const size = helpOgSize;
export const contentType = "image/png";

export const generateStaticParams = () =>
  helpTopics.map(({ group, slug }) => ({ group, page: slug }));

export default async function Image({
  params,
}: {
  params: Promise<{ group: string; page: string }>;
}) {
  const { group, page } = await params;
  const topic = helpTopicByPath(group, page);
  return helpOgImage(topic?.title ?? "사용법", topic?.summary ?? "");
}
