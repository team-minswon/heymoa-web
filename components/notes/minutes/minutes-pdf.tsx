import {
  Document,
  Font,
  Image as PdfImage,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";

import type { MinutesDocument, MinutesLine } from "@/lib/notes/minutes/model";

/**
 * 회의록 PDF 의 모양. **노트 화면 번들에 들지 않는다** — `render-minutes-pdf` 가 누를 때 워커를 띄워 그 안에서만
 * 이 모듈과 react-pdf · 한글 글꼴(약 6.5MB)을 읽는다. 모양의 원본은 회의록 양식 시안(A4, 공문서식 회의록)이다.
 *
 * 글꼴은 Noto Sans KR 전체 한글(KR) 판이다 — 이름에는 드문 음절이 나와서, 자주 쓰는 글자만 남긴 판으로는
 * 빈 네모가 찍힌다. 제목 「회의록」만 Noto Serif KR 이고, 그 세 글자만 남긴 판을 쓴다. 라이선스는 OFL 1.1
 * (`public/fonts/minutes/OFL.txt`).
 */

const SANS = "MinutesSans";
const TITLE = "MinutesTitle";

let registeredBase: string | null = null;

function registerFonts(base: string) {
  if (registeredBase === base) return;
  Font.register({
    family: SANS,
    fonts: [
      { src: `${base}/NotoSansKR-Regular.woff2`, fontWeight: 400 },
      { src: `${base}/NotoSansKR-Bold.woff2`, fontWeight: 700 },
    ],
  });
  Font.register({
    family: TITLE,
    src: `${base}/NotoSerifKR-SemiBold-title.ttf`,
  });
  Font.registerHyphenationCallback(breakableWord);
  registeredBase = base;
}

/**
 * 줄을 바꿀 수 있는 자리. react-pdf 는 빈칸에서만 줄을 바꿔, 빈칸 없이 긴 글(URL · 붙여 쓴 한글)은 칸 밖으로 넘쳐
 * 잘렸다(「가」 100자가 56자만 남았다). 긴 낱말은 글자마다 끊을 수 있게 하고 — 사이의 빈 조각이 하이픈 없이 끊으라는
 * 표시다 — 짧은 낱말은 그대로 둔다(한국어는 빈칸으로 띄어 쓰므로 보통 글은 대개 낱말 사이에서 바뀐다).
 */
/**
 * 좁은 칸(담당 · 기한 · 녹취록 화자)의 줄바꿈. 이 칸은 22mm 남짓이라 `ChristopherSmith` 같은 영문 이름 한 낱말도 넘쳐 옆 칸을
 * 덮었다. 이 칸의 글만 네 자 넘는 낱말을 글자마다 끊는다 — 본문까지 이렇게 끊으면 영문 낱말이 아무 데서나 갈린다
 */
const narrowBreak = (word: string) =>
  word.length <= 4 ? [word] : Array.from(word).flatMap((char) => [char, ""]);

export function breakableWord(word: string): string[] {
  // 한글이 든 낱말은 다섯 자부터 끊는다 — 담당 칸(22mm)에는 「크리스토퍼스미스」 같은 이름도 넘쳐 기한 칸을 덮었다.
  // 한국어 조판은 음절 사이에서 줄을 바꾸는 것이 보통이다. 나머지(영문 · URL)는 열일곱 자부터
  if (word.length <= (/[\uac00-\ud7a3]/.test(word) ? 4 : 16)) return [word];
  return Array.from(word).flatMap((char) => [char, ""]);
}

const mm = (value: number) => value * 2.835;

const color = {
  ink: "#0c0a09",
  body: "#3f3b38",
  muted: "#777169",
  rule: "#d6d3d1",
  ruleSoft: "#ebe9e7",
  label: "#f5f4f2",
  // 앱의 결정 · 할 일 · 열린 질문 색. 흑백으로 뽑아도 글자(구분 칸)로 갈린다
  decision: "#1d5fa8",
  task: "#13805a",
  open: "#b4501f",
};

/**
 * 줄 간격. **단위를 붙인다** — react-pdf 는 단위 없는 배수를 그 글자에 직접 준 크기로만 곱해서, 크기를 물려받는
 * 글자에서는 기본 18pt 로 곱해 줄 사이가 세 배로 벌어졌다. 본문 10pt × 1.65 다.
 */
const LINE = "16.5pt";

const s = StyleSheet.create({
  // 줄 간격은 쪽(`page`)이나 감싼 View 가 아니라 글자(Text)마다 준다(`LINE`). react-pdf 4.9 의 쪽 틀(`layout`)은
  // 쪽에 건 줄 간격으로 꼬리말 자리를 잘못 재 꼬리말이 쪽의 3/4 지점에 떴다.
  page: {
    fontFamily: SANS,
    fontSize: 10,
    color: color.body,
    paddingTop: mm(18),
    paddingHorizontal: mm(18),
    paddingBottom: mm(10),
  },
  title: {
    fontFamily: TITLE,
    fontSize: 20,
    letterSpacing: 12,
    textAlign: "center",
    color: color.ink,
    // 자간이 마지막 글자 뒤에도 붙어 왼쪽으로 쏠린다. 같은 만큼 밀어 가운데를 맞춘다
    paddingLeft: 12,
    marginBottom: mm(3.5),
  },
  documentStatus: {
    textAlign: "right",
    fontSize: 9,
    lineHeight: LINE,
    marginBottom: mm(2),
  },
  meta: {
    borderTopWidth: 1.5,
    borderTopColor: color.ink,
    borderBottomWidth: 1,
    borderBottomColor: color.rule,
  },
  metaRow: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: color.ruleSoft,
  },
  metaRowLast: { flexDirection: "row" },
  metaLabel: {
    width: mm(24),
    backgroundColor: color.label,
    paddingVertical: mm(2),
    paddingHorizontal: mm(3.5),
  },
  // 공문서 양식처럼 칸 제목 글자를 같은 폭에 고르게 편다
  metaLabelText: {
    width: mm(13),
    flexDirection: "row",
    justifyContent: "space-between",
    color: color.ink,
  },
  metaValue: {
    flex: 1,
    lineHeight: LINE,
    paddingVertical: mm(2),
    paddingHorizontal: mm(3.5),
    color: color.ink,
  },
  sub: { color: color.muted },
  section: { marginTop: mm(6.5) },
  heading: {
    fontSize: 11,
    fontWeight: 700,
    color: color.ink,
    paddingBottom: mm(1.8),
    marginBottom: mm(3),
    borderBottomWidth: 1,
    borderBottomColor: color.ink,
  },
  bold: { fontWeight: 700, color: color.ink },
  none: { lineHeight: LINE, color: color.muted },
  grid: { borderTopWidth: 1, borderTopColor: color.ink },
  head: {
    flexDirection: "row",
    backgroundColor: color.label,
    borderBottomWidth: 0.75,
    borderBottomColor: color.rule,
    color: color.muted,
    fontSize: 9,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: color.ruleSoft,
  },
  cell: { paddingVertical: mm(2), paddingHorizontal: mm(3) },
  // 본문 칸의 줄 간격. 되풀이되는 칸 머리(`fixed`)에는 걸지 않는다 — 걸면 4.9 의 새 쪽 나누기가 그 표의 줄을 통째로 잃었다
  body: { lineHeight: LINE },
  compact: {
    paddingVertical: mm(1),
    paddingHorizontal: mm(3),
    fontSize: 9,
    lineHeight: 1.5,
  },
  no: { width: mm(13), textAlign: "center", color: color.muted },
  who: { width: mm(22), color: color.ink },
  due: { width: mm(30) },
  tbd: { color: color.muted, fontSize: 9 },
  pending: { color: color.open, fontWeight: 700 },
  joined: { borderBottomWidth: 0 },
  time: { width: mm(19), color: color.muted },
  speaker: { width: mm(28), color: color.ink, fontWeight: 700 },
  unnamed: { color: color.muted, fontWeight: 400 },
  gap: {
    flex: 1,
    textAlign: "center",
    color: color.muted,
    backgroundColor: color.label,
  },
  // 1쪽 「핵심」
  pageLabel: {
    fontSize: 8,
    letterSpacing: 2,
    color: color.muted,
    marginBottom: mm(1.5),
  },
  verdict: {
    marginTop: mm(4),
    paddingVertical: mm(3),
    paddingHorizontal: mm(4),
    backgroundColor: color.label,
  },
  leadRow: { flexDirection: "row", marginTop: mm(1.5) },
  leadMark: { lineHeight: LINE, width: mm(4), color: color.muted },
  leadText: { lineHeight: LINE, flex: 1, color: color.ink },
  agendaTitleCell: { flex: 1, color: color.ink },
  // 1쪽 안건 표는 한 쪽에 들어야 해 칸 위아래를 줄인다
  tight: { paddingVertical: mm(1.4), paddingHorizontal: mm(2.5) },
  num: { width: mm(13), textAlign: "center" },
  start: { width: mm(15), color: color.muted },
  zero: { color: color.ruleSoft },
  owners: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: mm(2.5),
    paddingTop: mm(2),
    borderTopWidth: 0.75,
    borderTopColor: color.rule,
  },
  ownersLabel: {
    lineHeight: LINE,
    width: mm(17),
    fontSize: 9,
    color: color.muted,
  },
  owner: { lineHeight: LINE, marginRight: mm(4) },
  ownerCount: { fontWeight: 700, color: color.ink },
  // 상세
  agendaRef: { width: mm(13), color: color.muted, textAlign: "center" },
  at: { width: mm(15), color: color.muted, textAlign: "right" },
  // 부록
  agendaMark: {
    flexDirection: "row",
    backgroundColor: color.label,
    borderBottomWidth: 0.75,
    borderBottomColor: color.rule,
  },
  markerText: { flex: 1, fontWeight: 700, color: color.ink },
  refs: { width: mm(18), fontSize: 8, color: color.muted, textAlign: "right" },
  annexHead: {
    fontSize: 11,
    fontWeight: 700,
    color: color.ink,
    paddingBottom: mm(1.8),
    borderBottomWidth: 1,
    borderBottomColor: color.ink,
  },
  annexNote: {
    lineHeight: "14.85pt",
    marginTop: mm(2),
    marginBottom: mm(4),
    color: color.muted,
    fontSize: 9,
  },
  footer: {
    // 내용이 짧은 쪽에서도 꼬리말은 쪽 아래에 선다
    marginTop: "auto",
    paddingTop: mm(2.5),
    borderTopWidth: 0.75,
    borderTopColor: color.rule,
    flexDirection: "row",
    alignItems: "center",
    gap: mm(4),
    fontSize: 8,
    color: color.muted,
  },
  footerBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: mm(1.2),
    flexShrink: 0,
  },
  footerLogo: { width: mm(4.5), height: mm(4.5) },
  footerWordmark: { fontWeight: 700, fontSize: 8, color: color.body },
  footerTitle: { flex: 1, fontSize: 7, maxLines: 1, textOverflow: "ellipsis" },
  footerPage: { width: mm(15), textAlign: "right" },
});

function MetaRow({
  label,
  last,
  children,
}: {
  label: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={last ? s.metaRowLast : s.metaRow} wrap={false}>
      <View style={s.metaLabel}>
        <View style={s.metaLabelText}>
          {[...label].map((char, index) => (
            <Text key={index} style={{ lineHeight: LINE }}>
              {char}
            </Text>
          ))}
        </View>
      </View>
      <Text style={s.metaValue}>{children}</Text>
    </View>
  );
}

/**
 * A4 한 장의 틀. 꼬리말은 쪽마다 서야 하고 쪽 번호에는 전체 쪽 수가 든다 — react-pdf 의 `layout` 이 쪽마다 이 틀을
 * 다시 그린다. `layout` 은 새 쪽 나누기 엔진을 쓰는데, 내용을 한 번만 재고 쪽에 채워 넣어 3시간 녹취록(약 80쪽)도
 * 수 초에 끝난다. 옛 엔진은 쪽마다 남은 내용 전체를 다시 재서 같은 문서에 40초 가까이 걸렸다.
 */
function Sheet({
  footer,
  logoSrc,
  children,
}: {
  footer: string;
  logoSrc: string;
  children: React.ReactNode;
}) {
  return (
    <Page
      size="A4"
      style={s.page}
      layout={({ children: content, pageNumber, totalPages }) => (
        <>
          {content}
          <View style={s.footer}>
            <View style={s.footerBrand}>
              <PdfImage src={logoSrc} style={s.footerLogo} />
              <Text style={s.footerWordmark}>HeyMoa</Text>
            </View>
            <Text style={s.footerTitle}>{footer}</Text>
            <Text style={s.footerPage}>
              {pageNumber} / {totalPages}
            </Text>
          </View>
        </>
      )}
    >
      {children}
    </Page>
  );
}

// 4.9의 런타임은 Text bookmark를 지원하지만 공개 TextProps에서만 빠져 있습니다.
function BookmarkText(
  props: React.ComponentProps<typeof Text> & { bookmark: string }
) {
  return <Text {...props} />;
}

function Section({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      {/* 머리가 쪽 끝에 홀로 남지 않게 아래 내용이 조금이라도 따라올 자리를 본다 */}
      <BookmarkText
        id={id}
        bookmark={title}
        style={s.heading}
        minPresenceAhead={mm(12)}
      >
        {title}
      </BookmarkText>
      {children}
    </View>
  );
}

/**
 * 표 한 칸의 글을 여러 행으로 나눈다. react-pdf 는 가로로 늘어선 표 행 안의 글을 쪽 사이에서 가르지 못해, 한 쪽보다
 * 긴 행(항목 수정에는 길이 · 줄바꿈 제한이 없다)은 뒤가 쪽 밖으로 잘렸다. 행 하나를 [maxLines] 줄 · [maxChars] 자로
 * 묶고, 그보다 긴 한 줄은 낱말 사이에서 끊는다. 첫 행에만 번호 · 담당 같은 칸을 적는다.
 */
export function pieces(text: string, maxLines = 8, maxChars = 320): string[] {
  const lines = text.split("\n").flatMap((line) => {
    const parts: string[] = [];
    let rest = line;
    while (rest.length > maxChars) {
      const space = rest.lastIndexOf(" ", maxChars);
      const cut = space > maxChars / 2 ? space : maxChars;
      parts.push(rest.slice(0, cut));
      rest = rest.slice(cut).trimStart();
    }
    parts.push(rest);
    return parts;
  });
  const out: string[] = [];
  let current: string[] = [];
  let length = 0;
  for (const line of lines) {
    if (
      current.length > 0 &&
      (current.length >= maxLines || length + line.length > maxChars)
    ) {
      out.push(current.join("\n"));
      current = [];
      length = 0;
    }
    current.push(line);
    length += line.length;
  }
  out.push(current.join("\n"));
  return out;
}

/** 항목 하나를 [pieces] 대로 여러 행에 그린다. 이어지는 행 사이에는 줄을 긋지 않아 한 항목으로 읽힌다 */
function ItemRows({
  text,
  cells,
  id,
}: {
  text: string;
  id?: string;
  cells: (piece: string, first: boolean) => React.ReactNode;
}) {
  const parts = pieces(text);
  return (
    <>
      {parts.map((piece, index) => (
        <View
          key={index}
          id={index === 0 ? id : undefined}
          style={[s.row, index < parts.length - 1 ? s.joined : {}]}
          wrap={false}
        >
          {cells(piece, index === 0)}
        </View>
      ))}
    </>
  );
}

const agendaLabel = (no: number | null) => (no === null ? "—" : String(no));
const agendaDestination = (no: number) => `minutes-agenda-${no}`;
const countText = (count: number) => (count > 0 ? String(count) : "–");

/** 1쪽 표의 수 칸. 0 은 흐리게 — 숫자 사이에서 「없음」이 먼저 읽히지 않게 한다 */
function Count({ value }: { value: number | null }) {
  return (
    <Text
      style={[
        s.tight,
        s.body,
        s.num,
        value === 0 ? s.zero : { color: color.ink },
      ]}
    >
      {value === null ? "" : countText(value)}
    </Text>
  );
}

/** 할 일 담당별 수. 누가 몇 개를 들고 나갔는지가 1쪽에서 읽혀야 한다 — 항목은 상세의 할 일 표에 있다 */
function Owners({ owners }: { owners: MinutesDocument["owners"] }) {
  return (
    <View style={s.owners}>
      <Text style={s.ownersLabel}>담당</Text>
      {owners.map((owner) => (
        <Text key={owner.name ?? ""} style={[s.owner, owner.name ? {} : s.tbd]}>
          {owner.name ?? "미지정"}{" "}
          <Text style={s.ownerCount}>{owner.count}건</Text>
        </Text>
      ))}
    </View>
  );
}

function TranscriptTable({
  lines,
  truncated,
}: {
  lines: MinutesLine[];
  truncated: boolean;
}) {
  return (
    <View style={s.grid}>
      {/* `fixed` 라 쪽이 넘어가도 칸 머리가 다시 선다 */}
      <View style={s.head} fixed>
        <Text style={[s.cell, s.time]}>시각</Text>
        <Text
          style={[s.cell, s.speaker, { color: color.muted, fontWeight: 400 }]}
        >
          화자
        </Text>
        <Text style={[s.cell, { flex: 1 }]}>발언</Text>
        <Text style={[s.cell, s.refs, { color: color.muted }]}>본문</Text>
      </View>
      {lines.length === 0 ? (
        <Text style={[s.cell, s.none]}>기록된 발언이 없습니다.</Text>
      ) : null}
      {lines.map((line, index) => {
        if (line.type === "agenda") {
          return (
            <View
              key={index}
              style={s.agendaMark}
              wrap={false}
              minPresenceAhead={mm(8)}
            >
              <Text style={[s.compact, s.time]}>{line.at}</Text>
              <Text style={[s.compact, s.markerText]}>
                안건 {line.no} · {line.title}
              </Text>
            </View>
          );
        }
        if (line.type === "gap") {
          return (
            <View key={index} style={s.row} wrap={false}>
              <Text style={[s.compact, s.gap]}>
                {line.at} · {line.text}
              </Text>
            </View>
          );
        }
        return (
          <View key={index} style={s.row} wrap={false}>
            <Text style={[s.compact, s.time]}>{line.at}</Text>
            {/* 누가 말했는지 모르는 발언. 빈칸이면 빠뜨린 것처럼 읽힌다 */}
            <Text
              style={[
                s.compact,
                s.speaker,
                line.unnamed || line.speaker === null ? s.unnamed : {},
              ]}
              hyphenationCallback={narrowBreak}
            >
              {line.speaker ?? "—"}
            </Text>
            <Text style={[s.compact, { flex: 1 }]}>{line.text}</Text>
            {/* 본문 참조가 낱말 사이에서 꺾이지 않게 번호 안의 빈칸은 붙여 쓴다 */}
            <Text style={[s.compact, s.refs]}>
              {line.refs.map((ref) => ref.replaceAll(" ", "\u00a0")).join(", ")}
            </Text>
          </View>
        );
      })}
      {truncated ? (
        <View style={s.row} wrap={false}>
          <Text style={[s.compact, s.gap]}>
            기록이 끝까지 저장되지 못했습니다
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Transcript({
  lines,
  truncated,
}: {
  lines: MinutesLine[];
  truncated: boolean;
}) {
  // 수천 행을 한 Yoga 표에 넣으면 고정 칸 머리의 높이가 부풀어 발언이 쪽 밖으로 밀립니다.
  // 각 표의 측정 크기를 제한하되 쪽 넘김은 기존 렌더러가 맡습니다.
  const batches: MinutesLine[][] = [];
  for (let start = 0; start < lines.length; start += 100)
    batches.push(lines.slice(start, start + 100));
  if (batches.length === 0) batches.push([]);
  return (
    <>
      {batches.map((batch, index) => (
        <TranscriptTable
          key={index}
          lines={batch}
          truncated={truncated && index === batches.length - 1}
        />
      ))}
    </>
  );
}

export function MinutesPdf({
  doc,
  logoSrc,
}: {
  doc: MinutesDocument;
  logoSrc: string;
}) {
  const openHasOwner = doc.open.some((item) => item.assignee !== null);
  return (
    <Document
      title={`${doc.title} 회의록`}
      author="HeyMoa"
      creator="HeyMoa"
      language="ko"
    >
      <Sheet footer={doc.footer} logoSrc={logoSrc}>
        {/* ── 1쪽 핵심: 이 쪽만 읽어도 회의를 안다 ── */}
        <Text style={s.title}>회의록</Text>
        <Text style={[s.documentStatus, doc.confirmed ? s.sub : s.pending]}>
          {doc.confirmed ? "확정됨" : "검토 중(확정 전)"}
        </Text>
        <View style={s.meta}>
          <MetaRow label="회의명">{doc.title}</MetaRow>
          <MetaRow label="일시">
            {doc.dateLabel}
            {doc.durationLabel ? (
              <Text style={s.sub}>{`   ${doc.durationLabel}`}</Text>
            ) : null}
          </MetaRow>
          <MetaRow label="참석자" last>
            {doc.attendees.length > 0 ? doc.attendees.join(", ") : null}
            {doc.attendeeCount > 0 ? (
              <Text
                style={s.sub}
              >{`${doc.attendees.length > 0 ? "   " : ""}${doc.attendeeCount}명`}</Text>
            ) : (
              <Text style={s.tbd}>확인 필요</Text>
            )}
            {/* 녹취록의 「화자 N」이 참석자 밖의 사람처럼 읽히지 않게 함께 센다 */}
            {doc.unnamedSpeakers > 0 ? (
              <Text
                style={s.sub}
              >{` · 이름 미확인 화자 ${doc.unnamedSpeakers}`}</Text>
            ) : null}
          </MetaRow>
        </View>

        {doc.lead.length > 0 ? (
          <View style={s.verdict}>
            <Text style={s.pageLabel}>회의 요약</Text>
            {doc.lead.map((line, index) => (
              <View key={index}>
                {pieces(line).map((piece, part) => (
                  <View key={part} style={s.leadRow} wrap={false}>
                    <Text style={s.leadMark}>{part === 0 ? "·" : ""}</Text>
                    <Text style={s.leadText}>{piece}</Text>
                  </View>
                ))}
              </View>
            ))}
            {doc.owners.length > 0 ? <Owners owners={doc.owners} /> : null}
          </View>
        ) : doc.owners.length > 0 ? (
          <View style={s.verdict} wrap={false}>
            <Owners owners={doc.owners} />
          </View>
        ) : null}

        <Section title="안건 목차" id="minutes-index">
          {doc.agendas.length === 0 ? (
            <Text style={s.none}>정리된 안건이 없습니다.</Text>
          ) : (
            <View style={s.grid}>
              {/* 안건이 많아 다음 쪽으로 이어지면 칸 머리도 다시 선다 */}
              <View style={s.head} fixed>
                <Text style={[s.tight, s.no]}>번호</Text>
                <Text style={[s.tight, { flex: 1 }]}>안건</Text>
                <Text style={[s.tight, s.start]}>시작</Text>
                <Text style={[s.tight, s.num]}>결정</Text>
                <Text style={[s.tight, s.num]}>할 일</Text>
                <Text style={[s.tight, s.num]}>미결</Text>
              </View>
              {doc.agendas.map((agenda, index) => (
                <ItemRows
                  key={index}
                  text={agenda.title}
                  cells={(piece, first) => (
                    <>
                      <Text style={[s.tight, s.body, s.no]}>
                        {first ? agendaLabel(agenda.no) : ""}
                      </Text>
                      <Text style={[s.tight, s.body, s.agendaTitleCell]}>
                        {piece}
                      </Text>
                      <Text style={[s.tight, s.body, s.start]}>
                        {first ? (agenda.start ?? "") : ""}
                      </Text>
                      <Count value={first ? agenda.decisions : null} />
                      <Count value={first ? agenda.actions : null} />
                      <Count value={first ? agenda.open : null} />
                    </>
                  )}
                />
              ))}
            </View>
          )}
        </Section>

        {doc.agendas.length > 0 ? (
          <View break>
            <Section title="안건별 요약" id="minutes-agendas">
              {doc.agendas.map((agenda, index) => (
                <View key={index} style={{ marginBottom: mm(5) }}>
                  <BookmarkText
                    id={agendaDestination(agenda.no)}
                    bookmark={`안건 ${agendaLabel(agenda.no)} · ${agenda.title}`}
                    style={[s.bold, s.body]}
                    minPresenceAhead={mm(12)}
                  >
                    {agendaLabel(agenda.no)}. {agenda.title}
                  </BookmarkText>
                  {pieces(agenda.text)
                    .filter(Boolean)
                    .map((piece, part) => (
                      <Text
                        key={part}
                        style={[s.body, { marginTop: mm(2) }]}
                        wrap={false}
                      >
                        {piece}
                      </Text>
                    ))}
                </View>
              ))}
            </Section>
          </View>
        ) : null}

        {/* 상세 항목은 한 번씩만 싣고 안건 번호를 병기한다. */}
        <View break>
          <Section title="1. 결정 사항" id="minutes-decisions">
            {doc.decisions.length === 0 ? (
              <Text style={s.none}>없음</Text>
            ) : (
              <View style={s.grid}>
                <View style={s.head} fixed>
                  <Text style={[s.cell, s.no]}>번호</Text>
                  <Text style={[s.cell, { flex: 1 }]}>내용</Text>
                  <Text style={[s.cell, s.agendaRef]}>안건</Text>
                  <Text style={[s.cell, s.at]}>시각</Text>
                </View>
                {doc.decisions.map((decision) => (
                  <ItemRows
                    key={decision.no}
                    id={`minutes-decision-${decision.no}`}
                    text={decision.text}
                    cells={(piece, first) => (
                      <>
                        <Text style={[s.cell, s.body, s.no]}>
                          {first ? decision.no : ""}
                        </Text>
                        <Text
                          style={[
                            s.cell,
                            s.body,
                            { flex: 1, color: color.ink },
                          ]}
                        >
                          {piece}
                        </Text>
                        <Text style={[s.cell, s.body, s.agendaRef]}>
                          {first ? agendaLabel(decision.agendaNo) : ""}
                        </Text>
                        <Text style={[s.cell, s.body, s.at]}>
                          {first ? (decision.at ?? "") : ""}
                        </Text>
                      </>
                    )}
                  />
                ))}
              </View>
            )}
          </Section>
        </View>

        <Section title="2. 할 일" id="minutes-actions">
          {doc.actions.length === 0 ? (
            <Text style={s.none}>없음</Text>
          ) : (
            <View style={s.grid}>
              <View style={s.head} fixed>
                <Text style={[s.cell, s.no]}>번호</Text>
                <Text style={[s.cell, { flex: 1 }]}>내용</Text>
                <Text style={[s.cell, s.who, { color: color.muted }]}>
                  담당
                </Text>
                <Text style={[s.cell, s.due]}>기한</Text>
                <Text style={[s.cell, s.agendaRef]}>안건</Text>
              </View>
              {doc.actions.map((action) => (
                <ItemRows
                  key={action.no}
                  id={`minutes-action-${action.no}`}
                  text={action.content}
                  cells={(piece, first) => (
                    <>
                      <Text style={[s.cell, s.body, s.no]}>
                        {first ? action.no : ""}
                      </Text>
                      <Text
                        style={[s.cell, s.body, { flex: 1, color: color.ink }]}
                      >
                        {piece}
                      </Text>
                      {/* 담당·기한이 없는 항목은 미지정으로 표시한다. */}
                      <Text
                        style={[
                          s.cell,
                          s.body,
                          s.who,
                          action.assignee ? {} : s.tbd,
                        ]}
                        hyphenationCallback={narrowBreak}
                      >
                        {first ? (action.assignee ?? "미지정") : ""}
                      </Text>
                      <Text
                        style={[s.cell, s.body, s.due, action.due ? {} : s.tbd]}
                        hyphenationCallback={narrowBreak}
                      >
                        {first ? (action.due ?? "미지정") : ""}
                      </Text>
                      <Text style={[s.cell, s.body, s.agendaRef]}>
                        {first ? agendaLabel(action.agendaNo) : ""}
                      </Text>
                    </>
                  )}
                />
              ))}
            </View>
          )}
        </Section>

        {doc.open.length > 0 ? (
          <Section title="3. 미결 사항" id="minutes-open">
            <View style={s.grid}>
              <View style={s.head} fixed>
                <Text style={[s.cell, s.no]}>번호</Text>
                <Text style={[s.cell, { flex: 1 }]}>내용</Text>
                {/* 담당이 지정된 미결 사항이 있을 때만 담당 칸을 표시한다. */}
                {openHasOwner ? (
                  <Text style={[s.cell, s.who, { color: color.muted }]}>
                    담당
                  </Text>
                ) : null}
                <Text style={[s.cell, s.agendaRef]}>안건</Text>
                <Text style={[s.cell, s.at]}>시각</Text>
              </View>
              {doc.open.map((item) => (
                <ItemRows
                  key={item.no}
                  id={`minutes-open-${item.no}`}
                  text={item.content}
                  cells={(piece, first) => (
                    <>
                      <Text style={[s.cell, s.body, s.no]}>
                        {first ? item.no : ""}
                      </Text>
                      <Text
                        style={[s.cell, s.body, { flex: 1, color: color.ink }]}
                      >
                        {piece}
                      </Text>
                      {openHasOwner ? (
                        <Text
                          style={[
                            s.cell,
                            s.body,
                            s.who,
                            item.assignee ? {} : s.tbd,
                          ]}
                          hyphenationCallback={narrowBreak}
                        >
                          {first ? (item.assignee ?? "미지정") : ""}
                        </Text>
                      ) : null}
                      <Text style={[s.cell, s.body, s.agendaRef]}>
                        {first ? agendaLabel(item.agendaNo) : ""}
                      </Text>
                      <Text style={[s.cell, s.body, s.at]}>
                        {first ? (item.at ?? "") : ""}
                      </Text>
                    </>
                  )}
                />
              ))}
            </View>
          </Section>
        ) : null}
      </Sheet>

      {/* 부록은 새 쪽에서 시작한다 */}
      {doc.transcript ? (
        <Sheet footer={doc.footer} logoSrc={logoSrc}>
          <BookmarkText
            id="minutes-transcript"
            bookmark="부록 A. 녹취록"
            style={s.annexHead}
          >
            부록 A. 녹취록
          </BookmarkText>
          <Text style={s.annexNote}>
            발언 시각은 녹음 시작 기준입니다. 본문 번호는 해당 발언을 근거로 한
            결정·할 일·미결 사항을 가리킵니다.
          </Text>
          <Transcript
            lines={doc.transcript}
            truncated={doc.transcriptTruncated}
          />
        </Sheet>
      ) : null}
    </Document>
  );
}

/**
 * 이 스레드에서 바로 만든다. 화면에서는 `render-minutes-pdf` 의 `renderMinutesPdf` 를 쓴다 — 3시간 회의는 수 초가
 * 걸려 화면이 멈춘다. [fontBase] 는 글꼴을 읽을 자리다: 브라우저는 절대 URL, node(검사)는 파일 경로를 준다.
 */
export async function renderMinutesPdfInline(
  doc: MinutesDocument,
  fontBase: string
): Promise<Blob> {
  registerFonts(fontBase);
  // 브라우저·워커·Node 모두 글꼴과 같은 public 디렉터리의 기존 브랜드 자산을 읽습니다.
  const logoSrc = `${fontBase}/../../apple-touch-icon.png`;
  return pdf(<MinutesPdf doc={doc} logoSrc={logoSrc} />).toBlob();
}
