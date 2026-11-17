import { navTitleOf } from "@/app/[lang]/help/_content/paths";
import {
  helpGroupsFor,
  helpTopicsFor,
  situationClustersFor,
} from "@/app/[lang]/help/_content/topics";
import { HelpAnalytics } from "@/components/help/help-analytics";
import { HelpMotion } from "@/components/help/help-motion";
import { HelpSidebar } from "@/components/help/help-sidebar";
import { HELP_VARS } from "@/components/help/help-vars";
import { marketingLocale } from "@/lib/i18n/current";

export default async function HelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await marketingLocale();
  const topics = helpTopicsFor(locale).map((topic) => ({
    slug: topic.slug,
    group: topic.group,
    title: navTitleOf(topic),
    badge: topic.badge,
  }));
  return (
    <div
      style={HELP_VARS}
      data-help-root=""
      className="w-full flex-1 bg-white text-[var(--tv-ink)]"
    >
      <HelpMotion />
      <HelpAnalytics />
      <div className="mx-auto flex w-full max-w-[1800px]">
        <HelpSidebar
          groups={helpGroupsFor(locale)}
          clusters={situationClustersFor(locale)}
          topics={topics}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
