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
import { createTranslator } from "next-intl";

import { messagesFor } from "@/i18n/messages";
import type { Locale } from "@/lib/i18n/locales";
import type { MinutesDocument, MinutesLine } from "@/lib/notes/minutes/model";

const pdfTranslator = (locale: Locale) =>
  createTranslator({
    locale,
    messages: messagesFor(locale),
    namespace: "notes.minutes.pdf",
  });
type PdfT = ReturnType<typeof pdfTranslator>;

/**
 * 글꼴은 Noto Sans KR 전체 한글 판이다 — 이름에 드문 음절이 나와 자주 쓰는 글자만 남긴 판으로는 빈 네모가 찍힌다.
 * 라이선스는 OFL 1.1(`public/fonts/minutes/OFL.txt`).
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

/** react-pdf 는 빈칸에서만 줄을 바꿔, 빈칸 없이 긴 글(URL · 붙여 쓴 한글)은 칸 밖으로 넘쳐 잘린다. 긴 낱말에 끊을 자리(빈 조각)를 넣는다. */
const narrowBreak = (word: string) =>
  word.length <= 4 ? [word] : Array.from(word).flatMap((char) => [char, ""]);

export function breakableWord(word: string): string[] {
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
  decision: "#1d5fa8",
  task: "#13805a",
  open: "#b4501f",
};

/** 줄 간격에 단위를 붙인다 — react-pdf 는 단위 없는 배수를 크기를 물려받는 글자에서 기본 18pt 로 곱해 줄 사이가 벌어진다. */
const LINE = "16.5pt";

const s = StyleSheet.create({
  // 줄 간격은 쪽(`page`)이 아니라 글자(Text)마다 준다 — react-pdf 4.9 의 `layout` 은 쪽에 건 줄 간격으로 꼬리말 자리를 잘못 잰다.
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
  titleLatin: {
    fontWeight: 700,
    fontSize: 20,
    textAlign: "center",
    color: color.ink,
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
  // 되풀이되는 칸 머리(`fixed`)에는 줄 간격을 걸지 않는다 — 걸면 react-pdf 4.9 의 쪽 나누기가 그 표의 줄을 통째로 잃는다
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
  tight: { paddingVertical: mm(1.4), paddingHorizontal: mm(2.5) },
  num: { width: mm(13), textAlign: "center" },
  numLatin: { width: mm(20), textAlign: "center" },
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
  agendaRef: { width: mm(13), color: color.muted, textAlign: "center" },
  agendaRefLatin: { width: mm(18), color: color.muted, textAlign: "center" },
  at: { width: mm(15), color: color.muted, textAlign: "right" },
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
  spread,
  last,
  children,
}: {
  label: string;
  spread: boolean;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={last ? s.metaRowLast : s.metaRow} wrap={false}>
      <View style={s.metaLabel}>
        {spread ? (
          <View style={s.metaLabelText}>
            {[...label].map((char, index) => (
              <Text key={index} style={{ lineHeight: LINE }}>
                {char}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={{ lineHeight: LINE, color: color.ink }}>{label}</Text>
        )}
      </View>
      <Text style={s.metaValue}>{children}</Text>
    </View>
  );
}

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

/** react-pdf 는 가로로 늘어선 표 행 안의 글을 쪽 사이에서 가르지 못해 한 쪽보다 긴 행이 잘린다. 행을 [maxLines] 줄 · [maxChars] 자로 나눈다. */
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

function Count({ value, wide }: { value: number | null; wide: boolean }) {
  return (
    <Text
      style={[
        s.tight,
        s.body,
        wide ? s.numLatin : s.num,
        value === 0 ? s.zero : { color: color.ink },
      ]}
    >
      {value === null ? "" : countText(value)}
    </Text>
  );
}

function Owners({ owners, t }: { owners: MinutesDocument["owners"]; t: PdfT }) {
  return (
    <View style={s.owners}>
      <Text style={s.ownersLabel}>{t("owners")}</Text>
      {owners.map((owner) => (
        <Text key={owner.name ?? ""} style={[s.owner, owner.name ? {} : s.tbd]}>
          {owner.name ?? t("unassigned")}{" "}
          <Text style={s.ownerCount}>
            {t("ownerCount", { count: owner.count })}
          </Text>
        </Text>
      ))}
    </View>
  );
}

function TranscriptTable({
  lines,
  truncated,
  t,
}: {
  lines: MinutesLine[];
  truncated: boolean;
  t: PdfT;
}) {
  return (
    <View style={s.grid}>
      <View style={s.head} fixed>
        <Text style={[s.cell, s.time]}>{t("columns.time")}</Text>
        <Text
          style={[s.cell, s.speaker, { color: color.muted, fontWeight: 400 }]}
        >
          {t("columns.speaker")}
        </Text>
        <Text style={[s.cell, { flex: 1 }]}>{t("columns.line")}</Text>
        <Text style={[s.cell, s.refs, { color: color.muted }]}>
          {t("columns.refs")}
        </Text>
      </View>
      {lines.length === 0 ? (
        <Text style={[s.cell, s.none]}>{t("noLines")}</Text>
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
                {t("agendaBookmark", { no: line.no, title: line.title })}
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
            <Text style={[s.compact, s.refs]}>
              {line.refs.map((ref) => ref.replaceAll(" ", "\u00a0")).join(", ")}
            </Text>
          </View>
        );
      })}
      {truncated ? (
        <View style={s.row} wrap={false}>
          <Text style={[s.compact, s.gap]}>{t("truncated")}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Transcript({
  lines,
  truncated,
  t,
}: {
  lines: MinutesLine[];
  truncated: boolean;
  t: PdfT;
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
          t={t}
        />
      ))}
    </>
  );
}

export function MinutesPdf({
  doc,
  logoSrc,
  locale,
}: {
  doc: MinutesDocument;
  logoSrc: string;
  locale: Locale;
}) {
  const t = pdfTranslator(locale);
  const hangul = locale === "ko";
  const numStyle = hangul ? s.num : s.numLatin;
  const agendaRef = hangul ? s.agendaRef : s.agendaRefLatin;
  const openHasOwner = doc.open.some((item) => item.assignee !== null);
  return (
    <Document
      title={t("documentTitle", { title: doc.title })}
      author="HeyMoa"
      creator="HeyMoa"
      language={locale}
    >
      <Sheet footer={doc.footer} logoSrc={logoSrc}>
        <Text style={hangul ? s.title : s.titleLatin}>{t("title")}</Text>
        <Text style={[s.documentStatus, doc.confirmed ? s.sub : s.pending]}>
          {doc.confirmed ? t("confirmed") : t("inReview")}
        </Text>
        <View style={s.meta}>
          <MetaRow label={t("meta.title")} spread={hangul}>
            {doc.title}
          </MetaRow>
          <MetaRow label={t("meta.when")} spread={hangul}>
            {doc.dateLabel}
            {doc.durationLabel ? (
              <Text style={s.sub}>{`   ${doc.durationLabel}`}</Text>
            ) : null}
          </MetaRow>
          <MetaRow label={t("meta.attendees")} spread={hangul} last>
            {doc.attendees.length > 0 ? doc.attendees.join(", ") : null}
            {doc.attendeeCount > 0 ? (
              <Text
                style={s.sub}
              >{`${doc.attendees.length > 0 ? "   " : ""}${t("attendeeCount", { count: doc.attendeeCount })}`}</Text>
            ) : (
              <Text style={s.tbd}>{t("attendeesUnknown")}</Text>
            )}
            {doc.unnamedSpeakers > 0 ? (
              <Text
                style={s.sub}
              >{` · ${t("unnamedSpeakers", { count: doc.unnamedSpeakers })}`}</Text>
            ) : null}
          </MetaRow>
        </View>

        {doc.lead.length > 0 ? (
          <View style={s.verdict}>
            <Text style={s.pageLabel}>{t("lead")}</Text>
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
            {doc.owners.length > 0 ? (
              <Owners owners={doc.owners} t={t} />
            ) : null}
          </View>
        ) : doc.owners.length > 0 ? (
          <View style={s.verdict} wrap={false}>
            <Owners owners={doc.owners} t={t} />
          </View>
        ) : null}

        <Section title={t("index")} id="minutes-index">
          {doc.agendas.length === 0 ? (
            <Text style={s.none}>{t("noAgendas")}</Text>
          ) : (
            <View style={s.grid}>
              <View style={s.head} fixed>
                <Text style={[s.tight, s.no]}>{t("columns.no")}</Text>
                <Text style={[s.tight, { flex: 1 }]}>
                  {t("columns.agenda")}
                </Text>
                <Text style={[s.tight, s.start]}>{t("columns.start")}</Text>
                <Text style={[s.tight, numStyle]}>
                  {t("columns.decisions")}
                </Text>
                <Text style={[s.tight, numStyle]}>{t("columns.tasks")}</Text>
                <Text style={[s.tight, numStyle]}>{t("columns.open")}</Text>
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
                      <Count
                        value={first ? agenda.decisions : null}
                        wide={!hangul}
                      />
                      <Count
                        value={first ? agenda.actions : null}
                        wide={!hangul}
                      />
                      <Count
                        value={first ? agenda.open : null}
                        wide={!hangul}
                      />
                    </>
                  )}
                />
              ))}
            </View>
          )}
        </Section>

        {doc.agendas.length > 0 ? (
          <View break>
            <Section title={t("agendaSummaries")} id="minutes-agendas">
              {doc.agendas.map((agenda, index) => (
                <View key={index} style={{ marginBottom: mm(5) }}>
                  <BookmarkText
                    id={agendaDestination(agenda.no)}
                    bookmark={t("agendaBookmark", {
                      no: agendaLabel(agenda.no),
                      title: agenda.title,
                    })}
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

        <View break>
          <Section title={t("decisions")} id="minutes-decisions">
            {doc.decisions.length === 0 ? (
              <Text style={s.none}>{t("none")}</Text>
            ) : (
              <View style={s.grid}>
                <View style={s.head} fixed>
                  <Text style={[s.cell, s.no]}>{t("columns.no")}</Text>
                  <Text style={[s.cell, { flex: 1 }]}>
                    {t("columns.content")}
                  </Text>
                  <Text style={[s.cell, agendaRef]}>{t("columns.agenda")}</Text>
                  <Text style={[s.cell, s.at]}>{t("columns.time")}</Text>
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
                        <Text style={[s.cell, s.body, agendaRef]}>
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

        <Section title={t("actions")} id="minutes-actions">
          {doc.actions.length === 0 ? (
            <Text style={s.none}>{t("none")}</Text>
          ) : (
            <View style={s.grid}>
              <View style={s.head} fixed>
                <Text style={[s.cell, s.no]}>{t("columns.no")}</Text>
                <Text style={[s.cell, { flex: 1 }]}>
                  {t("columns.content")}
                </Text>
                <Text style={[s.cell, s.who, { color: color.muted }]}>
                  {t("columns.owner")}
                </Text>
                <Text style={[s.cell, s.due]}>{t("columns.due")}</Text>
                <Text style={[s.cell, agendaRef]}>{t("columns.agenda")}</Text>
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
                      <Text
                        style={[
                          s.cell,
                          s.body,
                          s.who,
                          action.assignee ? {} : s.tbd,
                        ]}
                        hyphenationCallback={narrowBreak}
                      >
                        {first ? (action.assignee ?? t("unassigned")) : ""}
                      </Text>
                      <Text
                        style={[s.cell, s.body, s.due, action.due ? {} : s.tbd]}
                        hyphenationCallback={narrowBreak}
                      >
                        {first ? (action.due ?? t("noDue")) : ""}
                      </Text>
                      <Text style={[s.cell, s.body, agendaRef]}>
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
          <Section title={t("open")} id="minutes-open">
            <View style={s.grid}>
              <View style={s.head} fixed>
                <Text style={[s.cell, s.no]}>{t("columns.no")}</Text>
                <Text style={[s.cell, { flex: 1 }]}>
                  {t("columns.content")}
                </Text>
                {openHasOwner ? (
                  <Text style={[s.cell, s.who, { color: color.muted }]}>
                    {t("columns.owner")}
                  </Text>
                ) : null}
                <Text style={[s.cell, agendaRef]}>{t("columns.agenda")}</Text>
                <Text style={[s.cell, s.at]}>{t("columns.time")}</Text>
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
                          {first ? (item.assignee ?? t("unassigned")) : ""}
                        </Text>
                      ) : null}
                      <Text style={[s.cell, s.body, agendaRef]}>
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

      {doc.transcript ? (
        <Sheet footer={doc.footer} logoSrc={logoSrc}>
          <BookmarkText
            id="minutes-transcript"
            bookmark={t("annex")}
            style={s.annexHead}
          >
            {t("annex")}
          </BookmarkText>
          <Text style={s.annexNote}>{t("annexNote")}</Text>
          <Transcript
            lines={doc.transcript}
            truncated={doc.transcriptTruncated}
            t={t}
          />
        </Sheet>
      ) : null}
    </Document>
  );
}

export async function renderMinutesPdfInline(
  doc: MinutesDocument,
  fontBase: string,
  locale: Locale
): Promise<Blob> {
  registerFonts(fontBase);
  const logoSrc = `${fontBase}/../../apple-touch-icon.png`;
  return pdf(
    <MinutesPdf doc={doc} logoSrc={logoSrc} locale={locale} />
  ).toBlob();
}
