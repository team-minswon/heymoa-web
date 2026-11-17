import { Ask } from "./ask";
import { Closing } from "./closing";
import { Evidence } from "./evidence";
import { Faq } from "./faq";
import { Hero } from "./hero";
import { MeetingCards } from "./meeting-cards";
import { TvMotionStyles } from "./motion";
import { Safety } from "./safety";
import { Team } from "./team";
import { TV_VARS } from "./tokens";
import { WorksWith } from "./works-with";

export function Landing() {
  return (
    <div
      className="tv-root w-full overflow-x-clip bg-white font-sans text-[var(--tv-ink)]"
      style={TV_VARS}
    >
      <TvMotionStyles />
      <Hero />
      <MeetingCards />
      <Evidence />
      <Team />
      <Ask />
      <Safety />
      <Faq />
      <WorksWith />
      <Closing />
    </div>
  );
}
