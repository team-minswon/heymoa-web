import type { ReactNode } from "react";

/**
 * 계약이 쓰는 마크다운만 그린다 — **제목(`#`~`######`), 문단, `-` 목록, `1.` 목록**.
 * 표·코드블록·인라인 강조(`**bold**`)는 계약 예시에 없어 미지원한다.
 *
 * ponytail: 계약이 표/코드블록/인라인 강조를 쓰기 시작하면 여기를 늘리거나 라이브러리로
 * 승격한다 — 지금은 이 넷이 요약(overview·actionItems·insights)의 전부라 의존성을 더하지 않는다.
 */
const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^-\s+(.*)$/;
const NUMBERED = /^\d+\.\s+(.*)$/;

const LIST_CLASS = "space-y-1.5 pl-5 text-[15px] leading-7 text-[var(--el-body)]";

export function renderMarkdown(source: string): ReactNode {
  const lines = source.split("\n");
  const nodes: ReactNode[] = [];
  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      nodes.push(
        <Heading key={key++} level={heading[1].length} text={heading[2]} />
      );
      index += 1;
      continue;
    }

    if (BULLET.test(line)) {
      const items: string[] = [];
      while (index < lines.length && BULLET.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(BULLET, "$1"));
        index += 1;
      }
      nodes.push(
        <ul key={key++} className={`list-disc ${LIST_CLASS}`}>
          {items.map((item, li) => (
            <li key={li}>{item}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (NUMBERED.test(line)) {
      const items: string[] = [];
      while (index < lines.length && NUMBERED.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(NUMBERED, "$1"));
        index += 1;
      }
      nodes.push(
        <ol key={key++} className={`list-decimal ${LIST_CLASS}`}>
          {items.map((item, li) => (
            <li key={li}>{item}</li>
          ))}
        </ol>
      );
      continue;
    }

    // 문단 — 특수 줄이 아닌 연속 줄을 한 문단으로 잇는다.
    const paragraph: string[] = [];
    while (index < lines.length) {
      const current = lines[index].trim();
      if (
        !current ||
        HEADING.test(current) ||
        BULLET.test(current) ||
        NUMBERED.test(current)
      ) {
        break;
      }
      paragraph.push(current);
      index += 1;
    }
    nodes.push(
      <p key={key++} className="text-[15px] leading-7 text-[var(--el-body)]">
        {paragraph.join(" ")}
      </p>
    );
  }

  return nodes;
}

function Heading({ level, text }: { level: number; text: string }) {
  // 요약 본문 안의 제목이라 시각 위계는 절제한다 — h1/h2는 섹션 라벨(개요·액션·인사이트)이 쓴다.
  if (level <= 1) {
    return (
      <h3 className="font-serif text-lg font-light tracking-[-0.02em] text-[var(--el-ink)]">
        {text}
      </h3>
    );
  }
  return (
    <h4 className="text-sm font-semibold text-[var(--el-body-strong)]">{text}</h4>
  );
}
