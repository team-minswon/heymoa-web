import type { Metadata } from "next";

import { HelpCodeBlock } from "@/components/help/md/client";
import { MdBlock } from "@/components/help/md/render";
import { HELP_SAMPLES } from "@/components/help/md/samples";
import { HELP_VARS } from "@/components/help/help-vars";

export const dynamic = "force-static";

/** 가이드 마크다운 표현 샘플. 내부용이라 검색에 잡히지 않고 sitemap 에도 없다. */
export const metadata: Metadata = {
  title: { absolute: "가이드 표현 샘플" },
  robots: { index: false, follow: false },
};

export default function HelpSamplesPage() {
  return (
    <main
      style={HELP_VARS}
      className="mx-auto flex max-w-[760px] flex-col gap-10 px-4 py-12 text-[16px] leading-[1.8] text-[var(--tv-body)]"
    >
      <h1 className="m-0 text-[28px] font-extrabold text-[var(--tv-ink)]">
        가이드 표현 샘플
      </h1>
      <p className="m-0">
        왼쪽 코드를 마크다운에 쓰면 아래 모양으로 보여요. 문법은{" "}
        <code>content/help/README.md</code> 에 있어요.
      </p>
      {HELP_SAMPLES.map(({ name, source }) => (
        <section key={name} className="flex flex-col gap-3">
          <h2 className="m-0 text-[20px] font-extrabold text-[var(--tv-ink)]">
            {name}
          </h2>
          <HelpCodeBlock text={source} />
          <div className="flex flex-col gap-3 rounded-[16px] border border-[var(--tv-rule)] bg-white p-5">
            <MdBlock source={source} />
          </div>
        </section>
      ))}
    </main>
  );
}
