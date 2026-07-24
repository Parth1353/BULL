import { Document, G, Line, Page, Path, Rect, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { scaleLinear } from "d3-scale";
import { writeFile } from "node:fs/promises";
import React, { type ReactNode } from "react";
import { displayValue, type ResearchReport } from "@/lib/report-schema";

const teal = "#078d86";
const tealDark = "#05736e";
const tealLight = "#e7f5f3";
const gray = "#f1f3f4";
const ink = "#101820";

const styles = StyleSheet.create({
  page: { paddingTop: 42, paddingBottom: 30, paddingHorizontal: 30, fontFamily: "Helvetica", fontSize: 7.5, color: ink, backgroundColor: "#ffffff" },
  brand: { position: "absolute", top: 0, left: 0, right: 0, height: 23, backgroundColor: teal, paddingHorizontal: 30, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandText: { color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 13, letterSpacing: 1.1 },
  brandSub: { color: "#d9fffa", fontSize: 6.5 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, height: 20, backgroundColor: teal, paddingHorizontal: 30, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  footerText: { color: "#fff", fontSize: 6.5 },
  eyebrow: { color: teal, fontFamily: "Helvetica-Bold", fontSize: 16, marginTop: 6 },
  company: { fontFamily: "Helvetica-Bold", fontSize: 24, marginTop: 9 },
  muted: { color: "#56616b" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  ratingBox: { backgroundColor: gray, minWidth: 108, alignItems: "center", paddingVertical: 8, paddingHorizontal: 9, borderBottomWidth: 2, borderBottomColor: teal },
  rating: { fontFamily: "Helvetica-Bold", fontSize: 18 },
  metadata: { marginTop: 9, borderTopWidth: 1.5, borderTopColor: teal, borderBottomWidth: 1.5, borderBottomColor: teal, flexDirection: "row", paddingVertical: 5 },
  metaCell: { flexGrow: 1, alignItems: "center", borderRightWidth: 0.5, borderRightColor: "#d7dadd", paddingHorizontal: 3 },
  metaLabel: { fontFamily: "Helvetica-Bold", fontSize: 6.4 },
  metaValue: { marginTop: 2, fontSize: 7 },
  twoColumns: { flexDirection: "row", marginTop: 10 },
  leftCol: { width: "39%", paddingRight: 7 }, rightCol: { width: "61%", paddingLeft: 4 },
  section: { marginTop: 9 },
  sectionTitle: { color: teal, fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 5 },
  subTitle: { fontFamily: "Helvetica-Bold", fontSize: 8.4, marginBottom: 3 },
  grayBox: { backgroundColor: gray, padding: 7 },
  table: { borderWidth: 0.5, borderColor: teal },
  tableHeader: { flexDirection: "row", backgroundColor: teal, paddingVertical: 4, paddingHorizontal: 4 },
  tableRow: { flexDirection: "row", paddingVertical: 3.1, paddingHorizontal: 4 },
  striped: { backgroundColor: gray },
  headerCell: { color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 6.5 },
  cell: { fontSize: 6.4 },
  strongCell: { fontFamily: "Helvetica-Bold", fontSize: 6.4 },
  bullet: { width: 8, fontFamily: "Helvetica-Bold", color: teal },
  bulletRow: { flexDirection: "row", marginBottom: 4 },
  narrative: { fontSize: 7.2, lineHeight: 1.4 },
  chartGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 4 },
  chartBox: { width: "48.5%", marginBottom: 9 },
  chartTitle: { color: teal, fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  chartEmpty: { height: 100, justifyContent: "center", alignItems: "center", backgroundColor: gray, color: "#68737d" },
  half: { width: "48.5%" },
  financialGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  financialTable: { width: "48.5%", marginBottom: 10 },
  disclosureTitle: { color: teal, fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 3 },
  small: { fontSize: 6.2, lineHeight: 1.25 },
  criteriaRow: { flexDirection: "row", paddingVertical: 3, paddingHorizontal: 4 },
});

const truncate = (value: string, max: number) => value.length <= max ? value : `${value.slice(0, max - 1).trim()}…`;

function Footer() {
  return <View style={styles.footer}><Text style={styles.footerText}>BULL AI | Evidence-backed research workflow</Text><Text style={styles.footerText}>Generated report | Public-source assessment</Text></View>;
}

function BrandBar() {
  return <View style={styles.brand}><Text style={styles.brandText}>BULL AI</Text><Text style={styles.brandSub}>FINANCIAL RESEARCH AUTOMATION</Text></View>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function TwoColumnTable({ title, rows }: { title: string; rows: Array<{ label: string; value: string }> }) {
  return <View><Text style={styles.subTitle}>{title}</Text><View style={styles.table}>
    {rows.map((row, index) => <View key={row.label} style={[styles.tableRow, index % 2 ? styles.striped : {}]}>
      <Text style={[styles.cell, { width: "58%" }]}>{truncate(row.label, 35)}</Text><Text style={[styles.cell, { width: "42%", textAlign: "right" }]}>{truncate(row.value, 32)}</Text>
    </View>)}
  </View></View>;
}

function FinancialTable({ title, rows }: { title: string; rows: ResearchReport["annualFinancials"] }) {
  const periods = rows.flatMap((row) => row.values.map((value) => value.period)).filter((period, index, all) => all.indexOf(period) === index).slice(0, 5);
  return <View style={styles.financialTable}><Text style={styles.subTitle}>{title}</Text><View style={styles.table}>
    <View style={styles.tableHeader}><Text style={[styles.headerCell, { width: "34%" }]}>Metric</Text>{periods.map((period) => <Text key={period} style={[styles.headerCell, { width: `${66 / Math.max(periods.length, 1)}%`, textAlign: "right" }]}>{period}</Text>)}</View>
    {rows.slice(0, 8).map((row, index) => <View key={row.metric} style={[styles.tableRow, index % 2 ? styles.striped : {}]}><Text style={[styles.strongCell, { width: "34%" }]}>{truncate(row.metric, 24)}</Text>{periods.map((period) => <Text key={period} style={[styles.cell, { width: `${66 / Math.max(periods.length, 1)}%`, textAlign: "right" }]}>{displayValue(row.values.find((cell) => cell.period === period)?.value)}</Text>)}</View>)}
  </View></View>;
}

function QuarterlyTable({ report }: { report: ResearchReport }) {
  const cols = ["Metric", "Current", "Prior year", "YoY", "Previous Q", "QoQ"];
  return <View style={styles.table}><View style={styles.tableHeader}>{cols.map((column) => <Text key={column} style={[styles.headerCell, { width: column === "Metric" ? "25%" : "15%", textAlign: column === "Metric" ? "left" : "right" }]}>{column}</Text>)}</View>
    {report.quarterlyFinancials.slice(0, 7).map((metric, index) => <View key={metric.label} style={[styles.tableRow, index % 2 ? styles.striped : {}]}>
      <Text style={[styles.strongCell, { width: "25%" }]}>{metric.label}</Text><Text style={[styles.cell, { width: "15%", textAlign: "right" }]}>{displayValue(metric.current)}</Text><Text style={[styles.cell, { width: "15%", textAlign: "right" }]}>{displayValue(metric.priorYear)}</Text><Text style={[styles.cell, { width: "15%", textAlign: "right" }]}>{displayValue(metric.yoy)}</Text><Text style={[styles.cell, { width: "15%", textAlign: "right" }]}>{displayValue(metric.previousQuarter)}</Text><Text style={[styles.cell, { width: "15%", textAlign: "right" }]}>{displayValue(metric.qoq)}</Text>
    </View>)}
  </View>;
}

function MiniChart({ chart }: { chart: ResearchReport["charts"][number] }) {
  const width = 230; const height = 104; const baseline = 82; const chartHeight = 64;
  const max = Math.max(...chart.bars.map((bar) => Math.abs(bar.value)), 1);
  const yScale = scaleLinear().domain([0, max]).range([0, chartHeight]);
  const step = 182 / chart.bars.length;
  const lineMax = Math.max(...(chart.line?.map((point) => Math.abs(point.value)) ?? [1]), 1);
  const lineYScale = scaleLinear().domain([0, lineMax]).range([baseline, baseline - chartHeight]);
  const barX = (index: number) => 32 + index * step;
  const linePath = chart.line?.map((point, index) => `${index === 0 ? "M" : "L"} ${barX(index) + Math.min(17, step * 0.45) / 2} ${lineYScale(Math.abs(point.value))}`).join(" ");
  return <View style={styles.chartBox}><Text style={styles.chartTitle}>{chart.title}</Text><Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
    <Line x1="24" y1={baseline} x2="218" y2={baseline} stroke="#aeb8bd" strokeWidth={0.6} />
    <Text x={0} y={20} style={{ fontSize: 6, fill: "#68737d" }}>{max.toLocaleString()}</Text><Text x={2} y={baseline + 2} style={{ fontSize: 6, fill: "#68737d" }}>0</Text>
    {chart.line && <Text x={184} y={20} style={{ fontSize: 5.5, fill: tealDark }}>{chart.lineLabel ?? "Line"}: {lineMax.toLocaleString()}</Text>}
    {chart.bars.map((bar, index) => { const barHeight = yScale(Math.abs(bar.value)); const x = barX(index); return <G key={bar.label}><Rect x={x} y={baseline - barHeight} width={Math.min(17, step * 0.45)} height={barHeight} fill="#12b9b0" /><Text x={x - 3} y={baseline + 11} style={{ fontSize: 5.5, fill: "#4d5962" }}>{bar.label}</Text></G>; })}
    {linePath && <Path d={linePath} stroke={tealDark} strokeWidth={1.3} fill="none" />}
    {chart.line?.map((point, index) => <Rect key={`line-${point.label}`} x={barX(index) + Math.min(17, step * 0.45) / 2 - 1.3} y={lineYScale(Math.abs(point.value)) - 1.3} width={2.6} height={2.6} fill={tealDark} />)}
    <Text x={25} y={98} style={{ fontSize: 5.5, fill: "#68737d" }}>{chart.unit}</Text>
  </Svg></View>;
}

export function ResearchReportDocument({ report }: { report: ResearchReport }) {
  const dataRows = report.companyData.map((entry) => ({ label: entry.label, value: displayValue(entry.value) }));
  return <Document title={`${report.companyName} research report`} author="Bull AI">
    <Page size="A4" style={styles.page}><BrandBar /><View style={styles.headerRow}><View><Text style={styles.eyebrow}>Retail Equity Research</Text><Text style={styles.company}>{report.companyName}</Text><Text style={[styles.muted, { marginTop: 8 }]}>Sector: {report.sector} | Period: {report.reportingPeriod}</Text></View><View style={{ alignItems: "flex-end", marginTop: 22 }}><View style={styles.ratingBox}><Text style={styles.rating}>{report.rating.toUpperCase()}</Text></View><Text style={{ marginTop: 5 }}>{report.reportDate}</Text></View></View>
      <View style={styles.metadata}>{[["Coverage", "Universal template"], ["Target", report.targetPrice], ["CMP", report.currentPrice], ["Report", "Evidence-backed"]].map(([label, val]) => <View key={label} style={styles.metaCell}><Text style={styles.metaLabel}>{label}</Text><Text style={styles.metaValue}>{val}</Text></View>)}</View>
      <View style={styles.twoColumns}><View style={styles.leftCol}><TwoColumnTable title="Company Data" rows={dataRows} /><Section title="Price Performance"><View style={[styles.grayBox, { height: 82, justifyContent: "center", alignItems: "center" }]}><Text style={styles.muted}>Market-price data not disclosed in source</Text></View></Section></View><View style={styles.rightCol}><Text style={styles.sectionTitle}>{report.researchTitle}</Text><View style={styles.grayBox}><Text style={styles.narrative}>{truncate(report.companyDescription.text, 560)}</Text>{report.highlights.slice(0, 4).map((item, index) => <View key={index} style={[styles.bulletRow, { marginTop: 4 }]}><Text style={styles.bullet}>•</Text><Text style={styles.narrative}>{truncate(item.text, 230)}</Text></View>)}</View><Section title="Outlook & Valuation"><Text style={styles.narrative}>{truncate(report.outlook.text, 620)}</Text></Section></View></View>
      <Section title="Quarterly Financials"><QuarterlyTable report={report} /></Section><Footer />
    </Page>
    <Page size="A4" style={styles.page}><BrandBar /><Section title="Key Highlights"><View style={styles.grayBox}>{report.highlights.slice(0, 6).map((item, index) => <View key={index} style={styles.bulletRow}><Text style={styles.bullet}>•</Text><Text style={styles.narrative}>{truncate(item.text, 310)}</Text></View>)}</View></Section><View style={styles.chartGrid}>{report.charts.slice(0, 4).map((chart) => <MiniChart key={chart.title} chart={chart} />)}</View><Section title="Change in Estimates"><View style={styles.table}><View style={styles.tableHeader}>{["Metric", "Old estimate", "New estimate", "Change"].map((label) => <Text key={label} style={[styles.headerCell, { width: "25%", textAlign: label === "Metric" ? "left" : "right" }]}>{label}</Text>)}</View>{report.estimateChanges.slice(0, 5).map((row, index) => <View key={row.label} style={[styles.tableRow, index % 2 ? styles.striped : {}]}><Text style={[styles.strongCell, { width: "25%" }]}>{row.label}</Text><Text style={[styles.cell, { width: "25%", textAlign: "right" }]}>{row.oldEstimate}</Text><Text style={[styles.cell, { width: "25%", textAlign: "right" }]}>{row.newEstimate}</Text><Text style={[styles.cell, { width: "25%", textAlign: "right" }]}>{row.change}</Text></View>)}</View></Section><Footer /></Page>
    <Page size="A4" style={styles.page}><BrandBar /><Text style={styles.eyebrow}>Consolidated Financials</Text><View style={[styles.financialGrid, { marginTop: 14 }]}><FinancialTable title="Profit & Loss" rows={report.annualFinancials} /><FinancialTable title="Balance Sheet" rows={report.balanceSheet} /><FinancialTable title="Cashflow" rows={report.cashflow} /><FinancialTable title="Ratios" rows={report.ratios} /></View><View style={[styles.grayBox, { marginTop: 6 }]}><Text style={styles.small}>Values in this report are extracted only when the supplied source supports them. Empty cells identify fields not disclosed in the uploaded context document.</Text></View><Footer /></Page>
    <Page size="A4" style={styles.page}><BrandBar /><Text style={styles.eyebrow}>Recommendation Summary</Text><View style={[styles.grayBox, { marginTop: 8, height: 106, justifyContent: "center", alignItems: "center" }]}><Text style={styles.muted}>Market-price history and independent target prices were not supplied.</Text><Text style={[styles.muted, { marginTop: 5 }]}>Report status: {report.rating}</Text></View><Section title="Investment Rating Criteria"><View style={styles.table}><View style={styles.tableHeader}>{["Rating", "Large caps", "Midcaps", "Small caps"].map((label) => <Text key={label} style={[styles.headerCell, { width: "25%" }]}>{label}</Text>)}</View>{[["Buy", "Upside above 10%", "Upside above 15%", "Upside above 20%"], ["Accumulate", "-", "Upside between 10%-15%", "Upside between 10%-20%"], ["Hold", "Upside between 0%-10%", "Upside between 0%-10%", "Upside between 0%-10%"], ["Reduce / sell", "Downside more than 0%", "Downside more than 0%", "Downside more than 0%"]].map((row, index) => <View key={row[0]} style={[styles.criteriaRow, index % 2 ? styles.striped : {}]}>{row.map((value, col) => <Text key={`${row[0]}-${col}`} style={[col === 0 ? styles.strongCell : styles.cell, { width: "25%" }]}>{value}</Text>)}</View>)}</View></Section><Section title="Disclaimer & Disclosures"><Text style={styles.disclosureTitle}>Evidence-backed automated assessment report</Text><Text style={styles.small}>This document is generated from the uploaded public context document. It is not investment research, an offer, a recommendation, or personalised financial advice. Values that could not be verified against the source are intentionally shown as Not disclosed. Readers should review the original filing and conduct independent due diligence before making any financial decision.</Text><Text style={[styles.disclosureTitle, { marginTop: 10 }]}>Source references</Text>{report.sources.slice(0, 8).map((item, index) => <Text key={index} style={styles.small}>[{item.page}] {truncate(item.quote, 180)}</Text>)}</Section><Footer /></Page>
  </Document>;
}

export async function renderReportToFile(report: ResearchReport, outputPath: string) {
  const buffer = await renderToBuffer(<ResearchReportDocument report={report} />);
  await writeFile(outputPath, buffer);
}
