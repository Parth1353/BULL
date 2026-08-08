import {
  Circle,
  Document,
  G,
  Line,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { scaleLinear } from "d3-scale";
import { writeFile } from "node:fs/promises";
import React, { type ReactNode } from "react";

import { displayValue, type Cited, type LabelledRow, type ResearchReport } from "@/lib/report-schema";

/**
 * A four-page equity-research layout reverse-engineered from the supplied
 * Geojit sample: front page split into a reference column and a narrative
 * column over the quarterly table, a highlights-and-charts page, a consolidated
 * financials page, and a disclosures page. Where the sample prints market data
 * this template prints the evidence trail instead, because a company filing
 * does not disclose prices, ratings or broker estimates.
 */

const teal = "#0b7c72";
const tealDeep = "#075f57";
const tealBright = "#16b3a6";
const wash = "#eef4f3";
const gray = "#f2f4f5";
const rule = "#d5dbdd";
const ink = "#12211f";
const muted = "#5d6b6d";

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 34,
    paddingLeft: 32,
    paddingRight: 46,
    fontFamily: "Helvetica",
    fontSize: 7.4,
    color: ink,
    backgroundColor: "#ffffff",
  },
  tab: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: 22,
    backgroundColor: teal,
  },
  tabText: {
    color: "#ffffff",
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.7,
    transform: "rotate(90deg)",
    width: 220,
    textAlign: "right",
    position: "absolute",
    top: 108,
    left: -99,
  },
  banner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  brand: { flexDirection: "row", alignItems: "center" },
  brandMark: {
    width: 17,
    height: 17,
    backgroundColor: teal,
    color: "#fff",
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    textAlign: "center",
    paddingTop: 3.4,
    marginRight: 5,
  },
  brandName: { fontFamily: "Helvetica-Bold", fontSize: 12, letterSpacing: 1.4, color: ink },
  brandSub: { fontSize: 6.2, color: muted, letterSpacing: 0.6 },

  eyebrow: { color: teal, fontFamily: "Helvetica-Bold", fontSize: 14 },
  company: { fontFamily: "Helvetica-Bold", fontSize: 21, marginTop: 6 },
  subline: { color: muted, marginTop: 5, fontSize: 7.6 },

  badge: {
    backgroundColor: gray,
    minWidth: 116,
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottomWidth: 2.5,
    borderBottomColor: teal,
  },
  badgeLabel: { fontSize: 5.8, letterSpacing: 1, color: muted, fontFamily: "Helvetica-Bold" },
  badgeValue: { fontFamily: "Helvetica-Bold", fontSize: 15, marginTop: 2 },

  metaStrip: {
    marginTop: 10,
    borderTopWidth: 1.4,
    borderTopColor: teal,
    borderBottomWidth: 1.4,
    borderBottomColor: teal,
    flexDirection: "row",
    paddingVertical: 4.5,
  },
  metaCell: { flexGrow: 1, flexBasis: 0, alignItems: "center", borderRightWidth: 0.5, borderRightColor: rule, paddingHorizontal: 3 },
  metaLabel: { fontFamily: "Helvetica-Bold", fontSize: 6, color: muted, letterSpacing: 0.3 },
  metaValue: { marginTop: 2, fontSize: 7.2, textAlign: "center" },

  columns: { flexDirection: "row", marginTop: 9 },
  left: { width: "37%", paddingRight: 8 },
  right: { width: "63%" },

  sectionTitle: { color: teal, fontSize: 11.5, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  blockTitle: { fontFamily: "Helvetica-Bold", fontSize: 7.6, marginBottom: 3, marginTop: 7 },

  table: { borderWidth: 0.5, borderColor: rule },
  tHead: { flexDirection: "row", backgroundColor: teal, paddingVertical: 3.4, paddingHorizontal: 4 },
  tHeadCell: { color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 6.2 },
  tRow: { flexDirection: "row", paddingVertical: 2.6, paddingHorizontal: 4, borderBottomWidth: 0.4, borderBottomColor: "#e6eaeb" },
  tRowAlt: { backgroundColor: "#f7f9f9" },
  cell: { fontSize: 6.3 },
  cellStrong: { fontSize: 6.3, fontFamily: "Helvetica-Bold" },

  lead: { backgroundColor: wash, padding: 7, borderLeftWidth: 2.5, borderLeftColor: tealBright },
  leadText: { fontSize: 7.4, lineHeight: 1.45, fontFamily: "Helvetica-Bold" },
  body: { fontSize: 7.4, lineHeight: 1.5 },
  bulletRow: { flexDirection: "row", marginTop: 4 },
  bulletDot: { width: 8, color: teal, fontFamily: "Helvetica-Bold", fontSize: 7.4 },

  note: { fontSize: 6.4, color: muted, lineHeight: 1.35 },
  emptyBox: {
    backgroundColor: gray,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: rule,
  },

  chartGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  chartBox: { width: "48.5%", marginBottom: 8 },
  chartTitle: { color: teal, fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 1 },
  chartUnit: { fontSize: 5.8, color: muted, marginBottom: 2 },

  grid2: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  halfBlock: { width: "48.5%", marginBottom: 10 },

  footer: {
    position: "absolute",
    left: 32,
    right: 46,
    bottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: rule,
    paddingTop: 4,
  },
  footerText: { fontSize: 5.8, color: muted },
  small: { fontSize: 6, lineHeight: 1.35, color: ink },
  sourceLine: { fontSize: 5.9, lineHeight: 1.3, marginBottom: 2.2, color: "#33403f" },
});

/**
 * The built-in PDF fonts are WinAnsi-encoded and have no glyph for the rupee
 * sign, which renders as a stray superscript instead. Indian filings use it
 * constantly, so it is rewritten to the "Rs." form the sample report itself
 * uses rather than dropped.
 */
export const sanitize = (value: string) =>
  value
    .replace(/[₹₨]\s*/g, "Rs. ")
    .replace(/\bRs\.\s+(?=[.,)])/g, "Rs.")
    .replace(/ {2,}/g, " ");

/** Narrow numeric columns get a dash; the note under each table spells out what it means. */
const missing = "\u2014";

const clip = (value: string, max: number) => {
  const text = sanitize(value);
  return text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
};

function Chrome({ label, page }: { label: string; page: number }) {
  return (
    <>
      <View style={styles.tab} fixed>
        <Text style={styles.tabText}>{clip(label.toUpperCase(), 44)}</Text>
      </View>
      <View style={styles.banner}>
        <View style={styles.brand}>
          <Text style={styles.brandMark}>B</Text>
          <View>
            <Text style={styles.brandName}>BULL AI</Text>
            <Text style={styles.brandSub}>EVIDENCE-BACKED RESEARCH AUTOMATION</Text>
          </View>
        </View>
        <Text style={{ fontSize: 6.2, color: muted }}>Page {page} of 4</Text>
      </View>
    </>
  );
}

function Footer({ report }: { report: ResearchReport }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        Generated from {clip(report.sourceFile, 46)} · Not investment advice
      </Text>
      <Text style={styles.footerText}>Every figure is linked to a page of the source document</Text>
    </View>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.note}>{children}</Text>
    </View>
  );
}

/** Two-column label/value table, used for company data and shareholding. */
function KeyValueTable({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <View style={styles.table}>
      {rows.map((row, index) => (
        <View key={`${row.label}-${index}`} style={[styles.tRow, index % 2 ? styles.tRowAlt : {}]}>
          <Text style={[styles.cell, { width: "56%", paddingRight: 4 }]}>{clip(row.label, 34)}</Text>
          <Text style={[styles.cellStrong, { width: "44%", textAlign: "right" }]}>{clip(row.value, 26)}</Text>
        </View>
      ))}
    </View>
  );
}

/** Period-column table used for every multi-period statement. */
function PeriodTable({
  rows,
  periods,
  labelWidth = 34,
  maxRows = 16,
  maxColumns = 5,
}: {
  rows: LabelledRow[];
  periods: string[];
  labelWidth?: number;
  maxRows?: number;
  maxColumns?: number;
}) {
  // Columns come from the data, not from the declared period list. A document
  // often reports different statements over different periods — a balance sheet
  // as of FY25 and Q2 FY26, a cashflow year-to-date — and rendering the declared
  // list blindly would print a table of empty cells while dropping real
  // extracted values on the floor.
  const present = new Set(rows.flatMap((row) => row.values.filter((v) => v.cell.value).map((v) => v.period)));
  const declared = periods.filter((period) => present.has(period));
  const extra = [...present].filter((period) => !periods.includes(period));
  const columns = [...declared, ...extra];
  const shown = (columns.length ? columns : periods).slice(0, maxColumns);
  // A row whose only figures sit in a period that did not make the column cut
  // would render as a line of dashes, which reads as "not disclosed" when it is
  // really "not shown". Drop those rows instead of printing an empty line.
  const visible = rows.filter((row) => row.values.some((v) => v.cell.value && shown.includes(v.period)));
  const width = `${(100 - labelWidth) / Math.max(shown.length, 1)}%`;

  return (
    <View style={styles.table}>
      <View style={styles.tHead}>
        <Text style={[styles.tHeadCell, { width: `${labelWidth}%` }]}>Metric</Text>
        {shown.map((period) => (
          <Text key={period} style={[styles.tHeadCell, { width, textAlign: "right", paddingLeft: 4 }]}>
            {clip(period, 9)}
          </Text>
        ))}
      </View>
      {visible.slice(0, maxRows).map((row, index) => (
        <View key={`${row.label}-${index}`} style={[styles.tRow, index % 2 ? styles.tRowAlt : {}]}>
          <Text style={[styles.cellStrong, { width: `${labelWidth}%`, paddingRight: 4 }]}>{clip(row.label, 44)}</Text>
          {shown.map((period) => {
            const cell = row.values.find((value) => value.period === period)?.cell;
            return (
              <Text key={period} style={[styles.cell, { width, textAlign: "right", paddingLeft: 4 }]}>
                {cell?.value ? clip(cell.value, 13) : missing}
              </Text>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function QuarterlyTable({ report }: { report: ResearchReport }) {
  const { quarterly } = report;
  const headers = [
    quarterly.currentLabel || "Current",
    quarterly.priorYearLabel || "Prior year",
    "YoY",
    quarterly.previousQuarterLabel || "Prev. qtr",
    "QoQ",
  ];
  return (
    <View style={styles.table}>
      <View style={styles.tHead}>
        <Text style={[styles.tHeadCell, { width: "28%" }]}>{clip(quarterly.unit || "Metric", 24)}</Text>
        {headers.map((header, index) => (
          <Text key={`${header}-${index}`} style={[styles.tHeadCell, { width: "14.4%", textAlign: "right" }]}>
            {clip(header, 10)}
          </Text>
        ))}
      </View>
      {quarterly.rows.slice(0, 13).map((row, index) => (
        <View key={`${row.metric}-${index}`} style={[styles.tRow, index % 2 ? styles.tRowAlt : {}]}>
          <Text style={[styles.cellStrong, { width: "28%", paddingRight: 4 }]}>{clip(row.metric, 44)}</Text>
          {[row.current, row.priorYear, row.yoy, row.previousQuarter, row.qoq].map((cell, cellIndex) => (
            <Text key={cellIndex} style={[styles.cell, { width: "14.4%", textAlign: "right" }]}>
              {(cell as Cited).value ? clip((cell as Cited).value as string, 12) : missing}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * Bar series with an optional secondary line on its own right-hand axis — the
 * combination the sample uses for revenue-with-growth and EBITDA-with-margin.
 */
function ComboChart({ chart }: { chart: ResearchReport["charts"]["charts"][number] }) {
  const width = 264;
  const height = 150;
  const left = 30;
  const right = 30;
  const top = 12;
  const baseline = height - 26;

  const barValues = chart.bars.map((bar) => bar.value);
  const barMax = Math.max(...barValues, 0);
  const barMin = Math.min(...barValues, 0);
  const barScale = scaleLinear()
    .domain([barMin < 0 ? barMin : 0, barMax || 1])
    .range([baseline, top])
    .nice();
  const zeroY = barScale(0);

  const plotWidth = width - left - right;
  const step = plotWidth / Math.max(chart.bars.length, 1);
  const barWidth = Math.min(20, step * 0.52);
  const centre = (index: number) => left + step * index + step / 2;

  const hasLine = chart.line.length >= 2;
  const lineValues = chart.line.map((point) => point.value);
  const lineScale = scaleLinear()
    .domain([Math.min(...lineValues, 0), Math.max(...lineValues, 1)])
    .range([baseline, top])
    .nice();
  const linePath = hasLine
    ? chart.line
        .map((point, index) => `${index === 0 ? "M" : "L"} ${centre(index)} ${lineScale(point.value)}`)
        .join(" ")
    : null;

  const ticks = barScale.ticks(4);

  return (
    <View style={styles.chartBox}>
      <Text style={styles.chartTitle}>{clip(chart.title, 44)}</Text>
      <Text style={styles.chartUnit}>
        {clip(chart.unit, 26)}
        {hasLine && chart.lineLabel ? `  ·  line: ${clip(chart.lineLabel, 22)}` : ""}
      </Text>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {ticks.map((tick) => (
          <G key={`t${tick}`}>
            <Line x1={left - 3} y1={barScale(tick)} x2={width - right} y2={barScale(tick)} stroke="#eaeeef" strokeWidth={0.5} />
            <Text x={left - 5} y={barScale(tick) + 2} style={{ fontSize: 5, fill: muted, textAnchor: "end" }}>
              {formatTick(tick)}
            </Text>
          </G>
        ))}
        <Line x1={left - 3} y1={zeroY} x2={width - right} y2={zeroY} stroke="#9fabad" strokeWidth={0.7} />

        {chart.bars.map((bar, index) => {
          const y = bar.value >= 0 ? barScale(bar.value) : zeroY;
          const barHeight = Math.max(Math.abs(barScale(bar.value) - zeroY), 0.6);
          return (
            <G key={`${bar.label}-${index}`}>
              <Rect x={centre(index) - barWidth / 2} y={y} width={barWidth} height={barHeight} fill={tealBright} />
              <Text x={centre(index)} y={baseline + 9} style={{ fontSize: 5, fill: muted, textAnchor: "middle" }}>
                {clip(bar.label, 9)}
              </Text>
            </G>
          );
        })}

        {linePath && <Path d={linePath} stroke="#e08b3a" strokeWidth={1.2} fill="none" />}
        {hasLine &&
          chart.line.map((point, index) => (
            <G key={`l${point.label}-${index}`}>
              <Circle cx={centre(index)} cy={lineScale(point.value)} r={1.6} fill="#e08b3a" />
              {/* The line usually crosses the bars, so each label gets a plate
                  behind it — orange on teal is otherwise unreadable. */}
              <Rect
                x={centre(index) - 9}
                y={lineScale(point.value) - 9.2}
                width={18}
                height={6.4}
                fill="#ffffff"
                opacity={0.88}
              />
              <Text
                x={centre(index)}
                y={lineScale(point.value) - 4.4}
                style={{ fontSize: 4.7, fill: "#b46a1f", textAnchor: "middle" }}
              >
                {formatTick(point.value)}
              </Text>
            </G>
          ))}

        {hasLine &&
          lineScale.ticks(4).map((tick) => (
            <Text
              key={`r${tick}`}
              x={width - right + 4}
              y={lineScale(tick) + 2}
              style={{ fontSize: 5, fill: "#b46a1f" }}
            >
              {formatTick(tick)}
            </Text>
          ))}
      </Svg>
    </View>
  );
}

function formatTick(value: number) {
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  if (Math.abs(value) >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return value.toFixed(1);
}

function StatementBlock({
  title,
  rows,
  periods,
}: {
  title: string;
  rows: LabelledRow[];
  periods: string[];
}) {
  return (
    <View style={styles.halfBlock}>
      <Text style={styles.blockTitle}>{title}</Text>
      {rows.length ? (
        <PeriodTable rows={rows} periods={periods} labelWidth={40} maxRows={14} />
      ) : (
        <Empty>Not disclosed in the source document.</Empty>
      )}
    </View>
  );
}

/** Per-section row counts and the source pages each section was drawn from. */
function coverage(report: ResearchReport) {
  const { profile, quarterly, statements, charts } = report;

  const pagesOf = (pages: Array<number | null>) => {
    const unique = [...new Set(pages.filter((page): page is number => Boolean(page)))].sort((a, b) => a - b);
    return unique.length ? unique.map((page) => `p${page}`).join(", ") : "";
  };
  const tablePages = (rows: LabelledRow[]) => pagesOf(rows.flatMap((row) => row.values.map((v) => v.cell.page)));

  return [
    {
      section: "Company data",
      rows: profile.companyData.filter((entry) => entry.cell.value).length,
      pages: pagesOf(profile.companyData.map((entry) => entry.cell.page)),
    },
    { section: "Shareholding", rows: profile.shareholding.length, pages: tablePages(profile.shareholding) },
    {
      section: "Quarterly financials",
      rows: quarterly.rows.length,
      pages: pagesOf(quarterly.rows.flatMap((row) => [row.current.page, row.priorYear.page, row.previousQuarter.page])),
    },
    { section: "Profit & loss", rows: statements.profitAndLoss.length, pages: tablePages(statements.profitAndLoss) },
    { section: "Balance sheet", rows: statements.balanceSheet.length, pages: tablePages(statements.balanceSheet) },
    { section: "Cashflow", rows: statements.cashflow.length, pages: tablePages(statements.cashflow) },
    { section: "Ratios", rows: statements.ratios.length, pages: tablePages(statements.ratios) },
    { section: "Segments", rows: statements.segments.length, pages: tablePages(statements.segments) },
    {
      section: "Charted series",
      rows: charts.charts.length,
      pages: pagesOf(charts.charts.flatMap((chart) => chart.bars.map((bar) => bar.page))),
    },
    {
      section: "Narrative highlights",
      rows: profile.highlights.length + profile.keyHighlights.length,
      pages: pagesOf([...profile.highlights, ...profile.keyHighlights].map((item) => item.page)),
    },
  ];
}

export function ResearchReportDocument({ report }: { report: ResearchReport }) {
  const { profile, quarterly, statements, charts } = report;
  const tabLabel = `${profile.reportingPeriod} ${profile.documentType ?? "Result update"}`;

  const companyRows = profile.companyData
    .slice(0, 11)
    .map((entry) => ({ label: entry.label, value: displayValue(entry.cell) }));

  const summaryRows = statements.profitAndLoss.length ? statements.profitAndLoss : statements.segments;
  const summaryPeriods = statements.profitAndLoss.length ? statements.periods : statements.segmentPeriods;

  return (
    <Document
      title={`${report.companyName} — ${profile.reportingPeriod} research report`}
      author="Bull AI"
      subject={`Evidence-backed research report generated from ${report.sourceFile}`}
      creator="Bull AI Financial Research Generator"
    >
      {/* ------------------------------------------------------- page 1 */}
      <Page size="A4" style={styles.page}>
        <Chrome label={tabLabel} page={1} />

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ width: "68%" }}>
            <Text style={styles.eyebrow}>Company Research</Text>
            <Text style={styles.company}>{clip(report.companyName, 42)}</Text>
            <Text style={styles.subline}>
              Sector: {clip(profile.sector ?? "Not disclosed", 40)}   |   Period: {clip(profile.reportingPeriod, 18)}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>RESULT UPDATE</Text>
              <Text style={styles.badgeValue}>{clip(profile.reportingPeriod, 12)}</Text>
            </View>
            <Text style={{ marginTop: 4, fontSize: 7, color: muted }}>
              {clip(profile.reportDate ?? "Date not disclosed", 30)}
            </Text>
          </View>
        </View>

        <View style={styles.metaStrip}>
          {[
            ["SOURCE DOCUMENT", clip(report.sourceFile, 26)],
            ["DOCUMENT TYPE", clip(profile.documentType ?? "Company filing", 24)],
            ["RATING", "Not rated"],
            ["TARGET / CMP", "Not disclosed"],
            ["EVIDENCE LINKS", String(report.sources.length)],
          ].map(([label, value]) => (
            <View key={label} style={styles.metaCell}>
              <Text style={styles.metaLabel}>{label}</Text>
              <Text style={styles.metaValue}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.columns}>
          <View style={styles.left}>
            <Text style={[styles.blockTitle, { marginTop: 2 }]}>Company Data</Text>
            {companyRows.length ? (
              <KeyValueTable rows={companyRows} />
            ) : (
              <Empty>The source document does not disclose company reference data.</Empty>
            )}

            <Text style={styles.blockTitle}>Shareholding (%)</Text>
            {profile.shareholding.length ? (
              <PeriodTable rows={profile.shareholding} periods={profile.shareholdingPeriods} labelWidth={40} maxRows={8} maxColumns={3} />
            ) : (
              <Empty>Shareholding pattern is not disclosed in this document.</Empty>
            )}

            <Text style={styles.blockTitle}>
              {statements.profitAndLoss.length ? "Financial Summary" : "Segment Summary"}
            </Text>
            {summaryRows.length ? (
              <PeriodTable rows={summaryRows} periods={summaryPeriods} labelWidth={40} maxRows={10} maxColumns={4} />
            ) : (
              <Empty>No multi-period statement is disclosed in this document.</Empty>
            )}

            {statements.ratios.length > 0 && (
              <>
                <Text style={styles.blockTitle}>Key Ratios</Text>
                <PeriodTable rows={statements.ratios} periods={statements.periods} labelWidth={40} maxRows={8} maxColumns={4} />
              </>
            )}
          </View>

          <View style={styles.right}>
            <Text style={styles.sectionTitle}>{clip(profile.headline, 78)}</Text>
            <View style={styles.lead}>
              <Text style={styles.leadText}>{clip(profile.description.text, 520)}</Text>
            </View>

            {profile.highlights.slice(0, 5).map((item, index) => (
              <View key={index} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={[styles.body, { flex: 1 }]}>{clip(item.text, 260)}</Text>
              </View>
            ))}

            <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Outlook</Text>
            <Text style={styles.body}>
              {profile.outlook
                ? clip(profile.outlook.text, 620)
                : "The source document does not disclose forward-looking guidance, and this report does not generate one."}
            </Text>

            {/* Kept in the narrative column, as in the sample layout, so the
                reference tables opposite do not leave a band of dead space. */}
            <Text style={[styles.sectionTitle, { marginTop: 11 }]}>
              Quarterly Financials {quarterly.unit ? `(${clip(quarterly.unit, 22)})` : ""}
            </Text>
            {quarterly.rows.length ? (
              <QuarterlyTable report={report} />
            ) : (
              <Empty>No quarterly income statement could be verified in this document.</Empty>
            )}
            <Text style={[styles.note, { marginTop: 4 }]}>
              A dash means the document does not disclose that cell. Growth columns are printed only where
              the document states them and they reconcile with the reported figures.
            </Text>
          </View>
        </View>

        <Footer report={report} />
      </Page>

      {/* ------------------------------------------------------- page 2 */}
      <Page size="A4" style={styles.page}>
        <Chrome label={tabLabel} page={2} />

        <Text style={styles.sectionTitle}>Key Highlights</Text>
        {profile.keyHighlights.length ? (
          <View style={[styles.lead, { borderLeftColor: teal }]}>
            {profile.keyHighlights.slice(0, 7).map((item, index) => (
              <View key={index} style={[styles.bulletRow, { marginTop: index ? 5 : 0 }]}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={[styles.body, { flex: 1, fontFamily: "Helvetica" }]}>{clip(item.text, 400)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Empty>No additional verifiable highlights were found in this document.</Empty>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Disclosed Trends</Text>
        {charts.charts.length ? (
          <View style={styles.chartGrid}>
            {charts.charts.map((chart, index) => (
              <ComboChart key={`${chart.title}-${index}`} chart={chart} />
            ))}
          </View>
        ) : (
          <Empty>The document does not disclose a multi-period series that can be charted.</Empty>
        )}

        {statements.segments.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 6 }]}>Segment Performance</Text>
            <PeriodTable rows={statements.segments} periods={statements.segmentPeriods} labelWidth={30} maxRows={10} />
          </>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Stated Targets & Guidance</Text>
        {charts.guidance.length ? (
          <View style={styles.lead}>
            {charts.guidance.slice(0, 6).map((item, index) => (
              <View key={index} style={[styles.bulletRow, { marginTop: index ? 4 : 0 }]}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={[styles.body, { flex: 1, fontFamily: "Helvetica" }]}>{clip(item.text, 320)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Empty>
            The document states no forward-looking targets. This template leaves the slot empty rather than
            substituting an estimate.
          </Empty>
        )}

        <Footer report={report} />
      </Page>

      {/* ------------------------------------------------------- page 3 */}
      <Page size="A4" style={styles.page}>
        <Chrome label={tabLabel} page={3} />

        <Text style={styles.sectionTitle}>Consolidated Financials</Text>
        <Text style={[styles.note, { marginBottom: 8 }]}>
          Every cell below was matched back to a page of {report.sourceFile}. Columns follow the periods each
          statement is actually reported over, which may differ between statements. A dash means that cell is
          not disclosed; a quarterly document typically discloses only part of the full statement set, and the
          gaps are left rather than filled from outside sources.
        </Text>

        <View style={styles.grid2}>
          <StatementBlock title="Profit & Loss" rows={statements.profitAndLoss} periods={statements.periods} />
          <StatementBlock title="Balance Sheet" rows={statements.balanceSheet} periods={statements.periods} />
          <StatementBlock title="Cashflow" rows={statements.cashflow} periods={statements.periods} />
          <StatementBlock title="Ratios" rows={statements.ratios} periods={statements.periods} />
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 4 }]}>Source Coverage</Text>
        <Text style={[styles.note, { marginBottom: 4 }]}>
          What this particular document did and did not disclose. Blocks marked “Not disclosed” are absent from
          the source; they are not gaps in the extraction.
        </Text>
        <View style={styles.table}>
          <View style={styles.tHead}>
            <Text style={[styles.tHeadCell, { width: "34%" }]}>Report section</Text>
            <Text style={[styles.tHeadCell, { width: "18%", textAlign: "right", paddingRight: 10 }]}>
              Rows extracted
            </Text>
            <Text style={[styles.tHeadCell, { width: "48%" }]}>Source pages cited</Text>
          </View>
          {coverage(report).map((entry, index) => (
            <View key={entry.section} style={[styles.tRow, index % 2 ? styles.tRowAlt : {}]}>
              <Text style={[styles.cellStrong, { width: "34%" }]}>{entry.section}</Text>
              <Text style={[styles.cell, { width: "18%", textAlign: "right", paddingRight: 10 }]}>
                {entry.rows || "Not disclosed"}
              </Text>
              <Text style={[styles.cell, { width: "48%" }]}>{entry.pages || "—"}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.blockTitle, { marginTop: 8 }]}>Reporting unit</Text>
        <Text style={styles.note}>
          {sanitize(statements.unit || quarterly.unit || "As stated in the source document")}. Figures are reproduced in
          the unit the company reported; no rescaling or currency conversion has been applied.
        </Text>

        <Footer report={report} />
      </Page>

      {/* ------------------------------------------------------- page 4 */}
      <Page size="A4" style={styles.page}>
        <Chrome label={tabLabel} page={4} />

        <Text style={styles.sectionTitle}>How This Report Was Produced</Text>
        <View style={{ flexDirection: "row", marginTop: 2 }}>
          {[
            ["1. Parse", "The document is read page by page and its table rows are reconstructed from the page layout."],
            ["2. Extract", "Gemini returns schema-constrained JSON, quoting the page and passage behind every fact."],
            ["3. Reconcile", "Each quote is matched back to the page, and each figure back to the document text."],
            ["4. Render", "Only values that survive that check are typeset. Everything else prints as “Not disclosed”."],
          ].map(([title, body]) => (
            <View key={title} style={{ width: "25%", paddingRight: 7 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 7, color: teal, marginBottom: 2 }}>{title}</Text>
              <Text style={styles.note}>{body}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Scope & Limitations</Text>
        <View style={styles.table}>
          {[
            ["Ratings and target prices", "Not produced. This system does not issue investment recommendations."],
            ["Market data", "Not fetched. Prices, market capitalisation and valuation multiples appear only if the uploaded document states them."],
            ["Estimates and forecasts", "Not produced. Forward-looking lines are reproduced only where the company itself published them."],
            ["Derived growth rates", "Printed only when the document states them and they reconcile with the reported figures."],
            ["Missing data", "Rendered as “Not disclosed”. No value is inferred, interpolated or carried over from another period."],
          ].map(([label, body], index) => (
            <View key={label} style={[styles.tRow, index % 2 ? styles.tRowAlt : {}]}>
              <Text style={[styles.cellStrong, { width: "26%" }]}>{label}</Text>
              <Text style={[styles.cell, { width: "74%" }]}>{body}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Source Evidence</Text>
        <Text style={[styles.note, { marginBottom: 5 }]}>
          Passages from {report.sourceFile} that back the figures and statements in this report.
        </Text>
        <View wrap>
          {report.sources.slice(0, 40).map((source, index) => (
            <Text key={index} style={styles.sourceLine}>
              <Text style={{ fontFamily: "Helvetica-Bold", color: teal }}>[p{source.page}] </Text>
              {clip(source.quote, 210)}
            </Text>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Disclaimer</Text>
        <Text style={styles.small}>
          This document was generated automatically from a public company filing supplied by the user. It is not
          investment research, an offer, a solicitation, a recommendation or personalised financial advice, and no
          part of it should be relied on for an investment decision. Bull AI does not verify the accuracy of the
          underlying filing. Figures are reproduced from that filing and may be restated by the company.
          Readers should consult the original document and take independent professional advice.
        </Text>

        <Footer report={report} />
      </Page>
    </Document>
  );
}

export async function renderReportToBuffer(report: ResearchReport) {
  return renderToBuffer(<ResearchReportDocument report={report} />);
}

export async function renderReportToFile(report: ResearchReport, outputPath: string) {
  await writeFile(outputPath, await renderReportToBuffer(report));
}
