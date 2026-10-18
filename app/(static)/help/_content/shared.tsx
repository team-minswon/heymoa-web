import Link from "next/link";

import { LINK } from "@/app/(static)/legal-document";
import type { HelpPageId } from "@/app/(static)/help/_content/ids";
import { helpPathById } from "@/app/(static)/help/_content/path-by-id";
import { HelpClip } from "@/components/help/help-clip";
import { HelpFigure } from "@/components/help/help-figure";
import { HelpSteps } from "@/components/help/help-steps";
import type { HelpTopic } from "@/app/(static)/help/_content/types";

/** 다른 페이지로 가는 글 속 링크. 앵커 글자는 페이지 이름이다(「여기」 금지). */
export const go = (id: HelpPageId, label: string, hash?: string) => (
  <Link href={`${helpPathById(id)}${hash ? `#${hash}` : ""}`} className={LINK}>
    {label}
  </Link>
);

export const ext = (href: string, label: string) => (
  <Link href={href} className={LINK}>
    {label}
  </Link>
);

export { HelpClip, HelpFigure };

/**
 * 상황별 레시피. 구조는 늘 같다: 이런 상황이에요(문제) → 먼저 확인할 곳 → 이렇게 해 보세요(단계) → 관련 기능 페이지.
 * 단계는 한 단계에 한 동작만 적고, 같은 글이 JSON-LD `HowTo` 에도 들어간다. 설명은 기능 페이지가 원본이고 여기는 링크로 잇는다.
 */
export function recipe(input: {
  slug: HelpPageId;
  title: string;
  summary: string;
  problem: readonly string[];
  where: string;
  steps: readonly string[];
  /** `facts` 는 따라 하는 순서가 아니라 사실 목록이다(번호 대신 점, JSON-LD HowTo 없음). */
  kind?: "steps" | "facts";
  /** 단계 앞에 두는 영상 등 */
  media?: React.ReactNode;
  after?: readonly React.ReactNode[];
  related: readonly { id: HelpPageId; label: string; note: string }[];
}): HelpTopic {
  return {
    slug: input.slug,
    group: "situations",
    title: input.title,
    summary: input.summary,
    howTo: input.kind === "facts" ? undefined : input.steps,
    related: input.related.map((r) => r.id),
    sections: [
      { id: "problem", title: "이런 상황이에요", body: input.problem },
      { id: "where", title: "먼저 확인할 곳", body: [input.where] },
      {
        id: "steps",
        title:
          input.kind === "facts" ? "이렇게 처리됩니다" : "이렇게 해 보세요",
        body: [
          ...(input.media ? [input.media] : []),
          input.kind === "facts" ? (
            <ul key="steps" className="m-0 flex list-disc flex-col gap-2 pl-5">
              {input.steps.map((step) => (
                <li key={step} className="break-keep">
                  {step}
                </li>
              ))}
            </ul>
          ) : (
            <HelpSteps key="steps">{input.steps}</HelpSteps>
          ),
          ...(input.after ?? []),
        ],
      },
      {
        id: "related",
        title: "관련 기능 페이지",
        body: [
          <ul key="related" className="m-0 flex list-none flex-col gap-2 p-0">
            {input.related.map(({ id, label, note }) => (
              <li key={id} className="break-keep">
                {go(id, label)} — {note}
              </li>
            ))}
          </ul>,
        ],
      },
    ],
  };
}
