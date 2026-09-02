const pptxgen = require("pptxgenjs");
const fs = require("fs");

const DATA = JSON.parse(fs.readFileSync(__dirname + "/deck_data.json", "utf8"));

// ---------------------------------------------------------------------------
// Palette — "Midnight Executive" navy base + amber accent for stat callouts
// ---------------------------------------------------------------------------
const NAVY = "1E2761";
const NAVY_DARK = "141B4D";
const ICE = "CADCFC";
const WHITE = "FFFFFF";
const AMBER = "E8871E";
const TEXT_DARK = "1A1A2E";
const TEXT_MUTED = "5B6178";
const GOOD_GREEN = "2C7A57";

const VTYPE_LABEL = {
  restaurant: "Restaurants",
  gym: "Gyms",
  bar: "Bars",
  waiting_room: "Waiting Rooms",
};
const VTYPE_ORDER = ["restaurant", "gym", "bar", "waiting_room"];
const VTYPE_COLOR = { restaurant: "4C72B0", gym: "55A868", bar: "C44E52", waiting_room: "8172B2" };

function byOrder(arr) {
  const m = {};
  arr.forEach((r) => (m[r.venue_type] = r));
  return VTYPE_ORDER.map((v) => m[v]);
}

function pFmt(p) {
  if (p === null || p === undefined) return "n/a";
  if (p < 0.001) return "< 0.001";
  return p.toFixed(3);
}

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.3 x 7.5
const PAGE_W = 13.33;

function addFooter(slide, pageLabel) {
  slide.addText(pageLabel, {
    x: 0.5, y: 7.15, w: 8, h: 0.3, fontSize: 9, color: TEXT_MUTED, fontFace: "Calibri",
  });
  slide.addText("Synthetic demo — validated against a known injected ground truth", {
    x: 8.3, y: 7.15, w: 4.5, h: 0.3, fontSize: 9, color: TEXT_MUTED, fontFace: "Calibri", align: "right",
  });
}

// ---------------------------------------------------------------------------
// Slide 1 — Title
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: NAVY };
  slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: PAGE_W, h: 7.5, fill: { color: NAVY } });
  slide.addText("Atmosphere TV", {
    x: 0.9, y: 2.15, w: 11.5, h: 0.7, fontSize: 22, color: ICE, fontFace: "Calibri", bold: true, charSpacing: 2,
  });
  slide.addText("DOOH Venue Incrementality &\nMedia-Mix Measurement", {
    x: 0.9, y: 2.75, w: 11.5, h: 1.9, fontSize: 40, color: WHITE, fontFace: "Cambria", bold: true, lineSpacing: 46,
  });
  slide.addText(
    "A causal measurement framework, calibrated media-mix model, budget optimizer, and venue-revenue model — built to answer the questions Atmosphere's advertising business and its own network economics run on.",
    { x: 0.9, y: 4.75, w: 9.8, h: 0.9, fontSize: 15, color: ICE, fontFace: "Calibri", italic: true }
  );
  slide.addShape(pres.ShapeType.rect, { x: 0.9, y: 6.55, w: 0.5, h: 0.5, fill: { color: AMBER } });
  slide.addText("Interview technical demo  •  Senior Data Scientist", {
    x: 1.55, y: 6.55, w: 8, h: 0.5, fontSize: 12, color: WHITE, fontFace: "Calibri", valign: "middle",
  });
}

// ---------------------------------------------------------------------------
// Slide 2 — Business problem
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("Three questions this project answers", {
    x: 0.6, y: 0.45, w: 12, h: 0.65, fontSize: 28, bold: true, color: NAVY, fontFace: "Cambria",
  });

  const cardY = 1.5, cardH = 5.15, cardW = 3.85, gap = 0.3;
  const cards = [
    {
      x: 0.6, num: "1", title: "Did the campaign actually work?",
      body: "Isolate the TRUE incremental foot traffic caused by ad exposure — net of seasonality, trend, and each venue's own baseline pattern.\n\nThe sell-side differentiator: measurement Atmosphere's go-to-market team can take to market and clients can trust.",
    },
    {
      x: 0.6 + cardW + gap, num: "2", title: "How should budget be spent?",
      body: "Given a fixed weekly budget, how should it split across restaurants, gyms, bars, and waiting rooms — accounting for each venue type's own diminishing-returns curve?\n\nThe media-planning / pricing question advertisers ask before they commit spend.",
    },
    {
      x: 0.6 + 2 * (cardW + gap), num: "3", title: "Where's Atmosphere's own revenue upside?",
      body: "Which existing venues are under-monetized relative to their own traffic and quality — and which prospective venues are worth prioritizing for network expansion?\n\nPhase 2: Atmosphere's own buy-side question, not the advertiser's.",
    },
  ];
  cards.forEach((c) => {
    slide.addShape(pres.ShapeType.roundRect, {
      x: c.x, y: cardY, w: cardW, h: cardH, rectRadius: 0.12,
      fill: { color: "F5F7FC" }, line: { type: "none" }, shadow: { type: "outer", color: "888888", opacity: 0.25, blur: 6, offset: 3, angle: 90 },
    });
    slide.addShape(pres.ShapeType.ellipse, { x: c.x + 0.35, y: cardY + 0.35, w: 0.6, h: 0.6, fill: { color: NAVY } });
    slide.addText(c.num, { x: c.x + 0.35, y: cardY + 0.35, w: 0.6, h: 0.6, fontSize: 20, bold: true, color: WHITE, align: "center", valign: "middle", fontFace: "Calibri" });
    slide.addText(c.title, { x: c.x + 0.35, y: cardY + 1.1, w: cardW - 0.7, h: 1.15, fontSize: 16, bold: true, color: NAVY, fontFace: "Cambria", lineSpacing: 19 });
    slide.addText(c.body, { x: c.x + 0.35, y: cardY + 2.35, w: cardW - 0.7, h: cardH - 2.6, fontSize: 11.5, color: TEXT_DARK, fontFace: "Calibri", lineSpacing: 16 });
  });
  addFooter(slide, "Business framing");
}

// ---------------------------------------------------------------------------
// Slide 3 — Design overview (process flow)
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("Design: one pipeline, confidence flows from experiment to product", {
    x: 0.6, y: 0.5, w: 12.2, h: 0.7, fontSize: 26, bold: true, color: NAVY, fontFace: "Cambria",
  });

  const steps = [
    { title: "RCT geo-holdout", sub: "High confidence", desc: "Randomized treated/holdout venues. Balance directly verified." },
    { title: "Synthetic control", sub: "Moderate confidence", desc: "Covers historical, non-randomized campaigns. Validated with placebo tests." },
    { title: "MMM, RCT-calibrated", sub: "Shape + scale", desc: "Adstock/saturation shape from aggregate data; scale pinned by the RCT." },
    { title: "Budget allocator", sub: "Exact DP", desc: "Multiple-choice knapsack over calibrated response curves." },
  ];
  const boxW = 2.75, boxH = 3.1, startX = 0.7, y = 2.0, gapX = 0.4;
  steps.forEach((s, i) => {
    const x = startX + i * (boxW + gapX);
    slide.addShape(pres.ShapeType.roundRect, {
      x, y, w: boxW, h: boxH, rectRadius: 0.1,
      fill: { color: i === 0 ? NAVY : i === 3 ? AMBER : "EDEFF7" },
      line: { type: "none" },
    });
    const titleColor = i === 0 || i === 3 ? WHITE : NAVY;
    slide.addText(String(i + 1), { x: x + 0.2, y: y + 0.15, w: 0.6, h: 0.5, fontSize: 20, bold: true, color: titleColor, fontFace: "Calibri" });
    slide.addText(s.title, { x: x + 0.2, y: y + 0.65, w: boxW - 0.4, h: 0.75, fontSize: 15.5, bold: true, color: titleColor, fontFace: "Cambria" });
    slide.addText(s.sub, { x: x + 0.2, y: y + 1.35, w: boxW - 0.4, h: 0.35, fontSize: 11, bold: true, italic: true, color: i === 0 || i === 3 ? ICE : AMBER, fontFace: "Calibri" });
    slide.addText(s.desc, { x: x + 0.2, y: y + 1.75, w: boxW - 0.4, h: boxH - 1.9, fontSize: 10.5, color: i === 0 || i === 3 ? WHITE : TEXT_DARK, fontFace: "Calibri", lineSpacing: 13 });
    if (i < steps.length - 1) {
      slide.addText("→", { x: x + boxW, y: y + boxH / 2 - 0.3, w: gapX, h: 0.6, fontSize: 22, color: NAVY, align: "center", fontFace: "Arial" });
    }
  });

  slide.addText(
    "Why this shape: a single trusted experimental read (RCT) is expensive to run everywhere, so it's used to calibrate a richer but less-trusted model (MMM) that covers the whole network — and that calibrated model then powers a budget decision.",
    { x: 0.7, y: 5.5, w: 11.9, h: 1.1, fontSize: 13, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 18 }
  );
  addFooter(slide, "Design overview");
}

// ---------------------------------------------------------------------------
// Slide 4 — Data & methodology
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("Synthetic data with a known, injected ground truth", {
    x: 0.6, y: 0.5, w: 12.2, h: 0.7, fontSize: 27, bold: true, color: NAVY, fontFace: "Cambria",
  });

  slide.addText(
    `${DATA.n_venue_types} venue types × ${DATA.n_venues_per_type} venues each, 104 weeks (52 pre-period + 52 campaign)`,
    { x: 0.6, y: 1.35, w: 12, h: 0.4, fontSize: 15, bold: true, color: AMBER, fontFace: "Calibri" }
  );

  const colX = [0.6, 6.9];
  const colW = 5.9;
  slide.addShape(pres.ShapeType.roundRect, { x: colX[0], y: 2.0, w: colW, h: 4.4, rectRadius: 0.1, fill: { color: "F5F7FC" }, line: { type: "none" } });
  slide.addText("RCT pool", { x: colX[0] + 0.35, y: 2.25, w: colW - 0.7, h: 0.5, fontSize: 17, bold: true, color: NAVY, fontFace: "Cambria" });
  slide.addText(
    "Randomly split treated / holdout within venue_type × geo_cluster × traffic-tier strata for a fixed benchmark campaign. This is a real Atmosphere-designed measurement product, not a historical campaign.",
    { x: colX[0] + 0.35, y: 2.8, w: colW - 0.7, h: 1.5, fontSize: 12.5, color: TEXT_DARK, fontFace: "Calibri", lineSpacing: 17 }
  );
  slide.addText("Used to anchor confidence — assignment is verified, not assumed.", {
    x: colX[0] + 0.35, y: 5.5, w: colW - 0.7, h: 0.8, fontSize: 12, italic: true, color: GOOD_GREEN, fontFace: "Calibri", lineSpacing: 16,
  });

  slide.addShape(pres.ShapeType.roundRect, { x: colX[1], y: 2.0, w: colW, h: 4.4, rectRadius: 0.1, fill: { color: "F5F7FC" }, line: { type: "none" } });
  slide.addText("Observational pool", { x: colX[1] + 0.35, y: 2.25, w: colW - 0.7, h: 0.5, fontSize: 17, bold: true, color: NAVY, fontFace: "Cambria" });
  slide.addText(
    "Advertisers activate venues themselves — non-randomly. Higher-baseline-traffic venues are systematically more likely to be activated (a real selection mechanism), and weekly frequency varies venue-to-venue.",
    { x: colX[1] + 0.35, y: 2.8, w: colW - 0.7, h: 1.5, fontSize: 12.5, color: TEXT_DARK, fontFace: "Calibri", lineSpacing: 17 }
  );
  slide.addText("A naive before/after comparison here is confounded by selection — this is what synthetic control and the MMM have to work around.", {
    x: colX[1] + 0.35, y: 5.5, w: colW - 0.7, h: 0.8, fontSize: 12, italic: true, color: "B8500A", fontFace: "Calibri", lineSpacing: 16,
  });

  addFooter(slide, "Data & methodology");
}

// ---------------------------------------------------------------------------
// Slide 5 — RCT results
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("RCT geo-holdout — high confidence", { x: 0.6, y: 0.45, w: 10, h: 0.65, fontSize: 27, bold: true, color: NAVY, fontFace: "Cambria" });
  slide.addShape(pres.ShapeType.roundRect, {
    x: 10.7, y: 0.5, w: 2.1, h: 0.55, rectRadius: 0.08, fill: { color: GOOD_GREEN }, line: { type: "none" },
  });
  slide.addText(`${DATA.balance_sig}/${DATA.balance_total} balance tests sig.`, {
    x: 10.7, y: 0.5, w: 2.1, h: 0.55, fontSize: 10.5, bold: true, color: WHITE, align: "center", valign: "middle", fontFace: "Calibri",
  });

  const rct = byOrder(DATA.rct);
  const chartData = [
    { name: "Estimated lift (RCT)", labels: rct.map((r) => VTYPE_LABEL[r.venue_type]), values: rct.map((r) => r.estimated_lift) },
    { name: "True lift (ground truth)", labels: rct.map((r) => VTYPE_LABEL[r.venue_type]), values: rct.map((r) => r.true_lift_ground_truth) },
  ];
  slide.addChart(pres.ChartType.bar, chartData, {
    x: 0.6, y: 1.3, w: 7.2, h: 4.1,
    barDir: "col", chartColors: [NAVY, AMBER], showTitle: false,
    showLegend: true, legendPos: "b", legendFontSize: 10,
    showValue: true, dataLabelFontSize: 9, dataLabelPosition: "outEnd", dataLabelColor: TEXT_DARK,
    catAxisLabelFontSize: 10, catAxisLabelColor: TEXT_DARK,
    valAxisLabelFontSize: 9, valAxisLabelColor: TEXT_MUTED,
    valAxisTitle: "Weekly incremental foot traffic", showValAxisTitle: true, valAxisTitleFontSize: 10,
    catGridLine: { style: "none" }, valGridLine: { color: "E5E5EF", size: 0.75 },
  });

  // right-side detail table (95% CI + p-value)
  let ty = 1.3;
  slide.addText("Venue type      95% CI               p-value", {
    x: 8.1, y: ty, w: 4.6, h: 0.3, fontSize: 10, bold: true, color: TEXT_MUTED, fontFace: "Courier New",
  });
  ty += 0.35;
  rct.forEach((r) => {
    slide.addText(
      `${VTYPE_LABEL[r.venue_type].padEnd(14)} [${r.ci_low.toFixed(1)}, ${r.ci_high.toFixed(1)}]   ${pFmt(r.p_value)}`,
      { x: 8.1, y: ty, w: 4.6, h: 0.35, fontSize: 10.5, color: TEXT_DARK, fontFace: "Courier New" }
    );
    ty += 0.42;
  });
  slide.addText(
    "Pre-treatment balance check: only 2 of 16 covariate × venue-type tests were significant at p≤0.05 — in line with what chance alone predicts. Randomization worked as designed, not assumed.",
    { x: 8.1, y: ty + 0.3, w: 4.6, h: 1.6, fontSize: 11, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 15 }
  );

  addFooter(slide, "Causal measurement — RCT");
}

// ---------------------------------------------------------------------------
// Slide 6 — Synthetic control results
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("Synthetic control — moderate confidence", { x: 0.6, y: 0.45, w: 11, h: 0.65, fontSize: 27, bold: true, color: NAVY, fontFace: "Cambria" });
  slide.addText("Covers historical, non-randomized campaigns — the identifying assumption can't be directly tested the way randomization can, only checked indirectly.", {
    x: 0.6, y: 1.1, w: 11.8, h: 0.5, fontSize: 12.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri",
  });

  const sc = byOrder(DATA.sc);
  slide.addChart(pres.ChartType.bar, [
    { name: "Estimated lift (Synthetic Control)", labels: sc.map((r) => VTYPE_LABEL[r.venue_type]), values: sc.map((r) => r.estimated_lift) },
    { name: "True lift (ground truth)", labels: sc.map((r) => VTYPE_LABEL[r.venue_type]), values: sc.map((r) => r.true_lift_ground_truth) },
  ], {
    x: 0.6, y: 1.8, w: 7.2, h: 4.1,
    barDir: "col", chartColors: [NAVY, AMBER], showLegend: true, legendPos: "b", legendFontSize: 10,
    showValue: true, dataLabelFontSize: 9, dataLabelPosition: "outEnd", dataLabelColor: TEXT_DARK,
    catAxisLabelFontSize: 10, catAxisLabelColor: TEXT_DARK,
    valAxisLabelFontSize: 9, valAxisLabelColor: TEXT_MUTED,
    valAxisTitle: "Weekly incremental foot traffic", showValAxisTitle: true, valAxisTitleFontSize: 10,
    catGridLine: { style: "none" }, valGridLine: { color: "E5E5EF", size: 0.75 },
  });

  let ty = 1.8;
  slide.addText("Venue type      Placebo p    Pre-RMSPE", {
    x: 8.1, y: ty, w: 4.6, h: 0.3, fontSize: 10, bold: true, color: TEXT_MUTED, fontFace: "Courier New",
  });
  ty += 0.35;
  sc.forEach((r) => {
    slide.addText(
      `${VTYPE_LABEL[r.venue_type].padEnd(14)} ${r.placebo_p_value.toFixed(3)}        ${r.avg_pre_period_rmspe.toFixed(1)}`,
      { x: 8.1, y: ty, w: 4.6, h: 0.35, fontSize: 10.5, color: TEXT_DARK, fontFace: "Courier New" }
    );
    ty += 0.42;
  });
  slide.addText(
    "Two validation checks, since synthetic control has no closed-form standard error: pre-period fit quality (RMSPE — poor fits are flagged and excluded from the aggregate estimate) and an in-space placebo test on every donor venue.",
    { x: 8.1, y: ty + 0.3, w: 4.6, h: 1.7, fontSize: 11, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 15 }
  );

  addFooter(slide, "Causal measurement — Synthetic Control");
}

// ---------------------------------------------------------------------------
// Slide 7 — MMM calibration (the headline technical story)
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("MMM: an uncalibrated model would have underpriced results", { x: 0.6, y: 0.45, w: 12.3, h: 0.65, fontSize: 25, bold: true, color: NAVY, fontFace: "Cambria" });
  slide.addText("Adstock + saturation shape comes from the aggregate weekly series; scale is pinned by the RCT's high-confidence estimate.", {
    x: 0.6, y: 1.1, w: 12, h: 0.4, fontSize: 12.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri",
  });

  const mmm = byOrder(DATA.mmm);
  slide.addChart(pres.ChartType.bar, [
    { name: "Naive MMM (uncalibrated)", labels: mmm.map((r) => VTYPE_LABEL[r.venue_type]), values: mmm.map((r) => r.beta_naive) },
    { name: "RCT-calibrated MMM", labels: mmm.map((r) => VTYPE_LABEL[r.venue_type]), values: mmm.map((r) => r.beta_calibrated) },
    { name: "True max lift", labels: mmm.map((r) => VTYPE_LABEL[r.venue_type]), values: mmm.map((r) => r.true_max_lift_ground_truth) },
  ], {
    x: 0.6, y: 1.75, w: 7.6, h: 4.3,
    barDir: "col", chartColors: ["A9AFC7", NAVY, AMBER], showLegend: true, legendPos: "b", legendFontSize: 9.5,
    showValue: true, dataLabelFontSize: 8.5, dataLabelPosition: "outEnd", dataLabelColor: TEXT_DARK,
    catAxisLabelFontSize: 10, catAxisLabelColor: TEXT_DARK,
    valAxisLabelFontSize: 9, valAxisLabelColor: TEXT_MUTED,
    valAxisTitle: "Max lift at saturation", showValAxisTitle: true, valAxisTitleFontSize: 10,
    catGridLine: { style: "none" }, valGridLine: { color: "E5E5EF", size: 0.75 },
  });

  let ty = 1.9;
  slide.addText("Calibration adjustment", { x: 8.5, y: ty, w: 4.2, h: 0.35, fontSize: 12, bold: true, color: NAVY, fontFace: "Cambria" });
  ty += 0.5;
  mmm.forEach((r) => {
    const sign = r.calibration_adjustment_pct >= 0 ? "+" : "";
    slide.addText(VTYPE_LABEL[r.venue_type], { x: 8.5, y: ty, w: 1.9, h: 0.55, fontSize: 12, color: TEXT_DARK, fontFace: "Calibri" });
    slide.addText(`${sign}${r.calibration_adjustment_pct.toFixed(0)}%`, {
      x: 10.4, y: ty, w: 2.3, h: 0.55, fontSize: 18, bold: true,
      color: Math.abs(r.calibration_adjustment_pct) > 50 ? "B8500A" : GOOD_GREEN, fontFace: "Calibri",
    });
    ty += 0.65;
  });
  slide.addText(
    "For 3 of 4 venue types, the naive observational fit understated true incremental lift by 100–165% — the kind of gap real MMM practice cites as its core identification problem, and exactly why the RCT anchor matters.",
    { x: 8.5, y: ty + 0.15, w: 4.2, h: 1.6, fontSize: 11, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 15 }
  );

  addFooter(slide, "Media-mix model");
}

// ---------------------------------------------------------------------------
// Slide 8 — Budget allocator
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("Budget allocator: exact DP, not a greedy walk", { x: 0.6, y: 0.45, w: 12, h: 0.65, fontSize: 27, bold: true, color: NAVY, fontFace: "Cambria" });

  slide.addShape(pres.ShapeType.roundRect, { x: 0.6, y: 1.25, w: 12.1, h: 1.0, rectRadius: 0.08, fill: { color: "FDF1E3" }, line: { type: "none" } });
  slide.addText(
    "A Hill/S-shaped response curve is CONVEX before its inflection point — a greedy “spend the next dollar on whichever venue type currently looks best” heuristic isn't guaranteed optimal there. An earlier greedy version of this allocator actually underperformed a naive equal-split baseline; the DP formulation below has no concavity requirement and is guaranteed to find the grid-optimal allocation.",
    { x: 0.85, y: 1.35, w: 11.6, h: 0.85, fontSize: 12, italic: true, color: "8A4B0A", fontFace: "Calibri", lineSpacing: 15 }
  );

  const b100 = DATA.budgets.find((b) => b.budget === 100000);
  const alloc = byOrder(b100.allocation);
  slide.addChart(pres.ChartType.bar, [
    { name: "Allocated weekly budget ($)", labels: alloc.map((r) => VTYPE_LABEL[r.venue_type]), values: alloc.map((r) => r.allocated_weekly_budget) },
  ], {
    x: 0.6, y: 2.5, w: 7.3, h: 3.9,
    barDir: "col", chartColors: [NAVY], showLegend: false,
    showValue: true, dataLabelFontSize: 10, dataLabelPosition: "outEnd", dataLabelColor: TEXT_DARK,
    dataLabelFormatCode: "$#,##0",
    catAxisLabelFontSize: 11, catAxisLabelColor: TEXT_DARK,
    valAxisLabelFontSize: 9, valAxisLabelColor: TEXT_MUTED, valAxisLabelFormatCode: "$#,##0",
    catGridLine: { style: "none" }, valGridLine: { color: "E5E5EF", size: 0.75 },
  });

  slide.addText(`$${(100000).toLocaleString()} weekly budget example`, { x: 8.2, y: 2.55, w: 4.5, h: 0.4, fontSize: 13, bold: true, color: NAVY, fontFace: "Cambria" });
  DATA.budgets.forEach((b, i) => {
    const y = 3.05 + i * 1.15;
    slide.addText(`$${b.budget.toLocaleString()} budget`, { x: 8.2, y, w: 2.0, h: 0.5, fontSize: 12, color: TEXT_DARK, fontFace: "Calibri" });
    slide.addText(`+${b.gain_pct}%`, { x: 10.2, y: y - 0.05, w: 2.5, h: 0.6, fontSize: 20, bold: true, color: AMBER, fontFace: "Calibri" });
    slide.addText("vs. naive equal-split", { x: 8.2, y: y + 0.42, w: 4.5, h: 0.3, fontSize: 9.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri" });
  });
  slide.addText(
    "The optimizer's edge is largest when budget is scarce — exactly when allocation decisions matter most.",
    { x: 8.2, y: 6.55, w: 4.6, h: 0.6, fontSize: 10.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 14 }
  );

  addFooter(slide, "Productization — budget allocator");
}

// ---------------------------------------------------------------------------
// Slide 9 — Phase 1 -> Phase 2: the other side of the business
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: NAVY_DARK };
  slide.addText("The other side of the business", { x: 0.6, y: 0.5, w: 12, h: 0.7, fontSize: 28, bold: true, color: WHITE, fontFace: "Cambria" });
  slide.addText("Phase 1 answers the advertising side. Phase 2 answers the venue-network side — both built, one connected system.", {
    x: 0.6, y: 1.2, w: 12, h: 0.45, fontSize: 13.5, italic: true, color: ICE, fontFace: "Calibri",
  });

  const colW = 5.7, y0 = 1.85, h0 = 4.75, gap = 0.5;
  const p1 = { x: 0.6, title: "Phase 1 — Advertising incrementality", items: [
    "Prove and price advertising incrementality",
    "Feeds go-to-market: sell-side differentiator, client trust",
    "RCT + synthetic control + calibrated MMM + budget DP",
  ]};
  const p2 = { x: 0.6 + colW + gap, title: "Phase 2 — Venue economics", items: [
    "Predict a venue's realized ad-revenue from its characteristics",
    "Flag under-monetized existing venues for sales/ops follow-up",
    "Rank prospective venues for expansion priority",
    "Gradient-boosted trees, honest out-of-fold evaluation",
  ]};
  [p1, p2].forEach((p, idx) => {
    slide.addShape(pres.ShapeType.roundRect, {
      x: p.x, y: y0, w: colW, h: h0, rectRadius: 0.1,
      fill: { color: idx === 0 ? "2A3480" : AMBER }, line: { type: "none" },
    });
    slide.addText(p.title, { x: p.x + 0.4, y: y0 + 0.3, w: colW - 0.8, h: 0.65, fontSize: 16, bold: true, color: WHITE, fontFace: "Cambria" });
    let iy = y0 + 1.15;
    p.items.forEach((it) => {
      slide.addText("• " + it, { x: p.x + 0.4, y: iy, w: colW - 0.8, h: 0.65, fontSize: 12, color: WHITE, fontFace: "Calibri", lineSpacing: 15 });
      iy += 0.72;
    });
    if (idx === 0) {
      slide.addText(
        "Feeds Phase 2 as a validated causal-value input (calibrated per-exposure lift), not a separate silo.",
        { x: p.x + 0.4, y: y0 + h0 - 0.65, w: colW - 0.8, h: 0.55, fontSize: 10, italic: true, color: ICE, fontFace: "Calibri", lineSpacing: 13 }
      );
    }
  });
  slide.addText(
    "“Smarter on both sides of the business” — the venue-side model shares its data foundation and Phase 1's causal-value input, rather than being a disconnected second project. Results on the next slide.",
    { x: 0.6, y: 6.85, w: 12, h: 0.5, fontSize: 11.5, italic: true, color: ICE, fontFace: "Calibri" }
  );
}

// ---------------------------------------------------------------------------
// Slide 10 — Phase 2 results: venue revenue model
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("Phase 2: predicting venue ad-revenue, honestly", { x: 0.6, y: 0.45, w: 12.2, h: 0.65, fontSize: 25, bold: true, color: NAVY, fontFace: "Cambria" });
  slide.addText("Gradient-boosted trees on observable venue characteristics + Phase 1's calibrated per-exposure lift as a feature.", {
    x: 0.6, y: 1.1, w: 12, h: 0.4, fontSize: 12.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri",
  });

  const p2 = DATA.phase2;
  const metricY = 1.65;
  const metrics = [
    { label: "Held-out R²", value: p2.r2_test.toFixed(2) },
    { label: "Held-out MAPE", value: `${p2.mape_test.toFixed(1)}%` },
    { label: "Corr. w/ latent true potential", value: p2.potential_corr.toFixed(2) },
    { label: "Flagged-tail latent gap rate", value: `${p2.flagged_latent_gap_rate.toFixed(0)}% vs ${p2.population_latent_gap_rate.toFixed(0)}%` },
  ];
  const mW = 2.9;
  metrics.forEach((m, i) => {
    const x = 0.6 + i * (mW + 0.15);
    slide.addShape(pres.ShapeType.roundRect, { x, y: metricY, w: mW, h: 1.15, rectRadius: 0.08, fill: { color: "F5F7FC" }, line: { type: "none" } });
    slide.addText(m.value, { x: x + 0.15, y: metricY + 0.12, w: mW - 0.3, h: 0.55, fontSize: 22, bold: true, color: NAVY, fontFace: "Calibri" });
    slide.addText(m.label, { x: x + 0.15, y: metricY + 0.68, w: mW - 0.3, h: 0.4, fontSize: 9.5, color: TEXT_MUTED, fontFace: "Calibri" });
  });

  // feature importance chart (left)
  const feat = p2.top_features.slice().reverse();
  slide.addChart(pres.ChartType.bar, [
    { name: "Importance (mean R² drop)", labels: feat.map((f) => f.feature.replace(/_/g, " ")), values: feat.map((f) => f.importance) },
  ], {
    x: 0.6, y: 3.15, w: 5.9, h: 3.55, barDir: "bar", chartColors: ["55A868"], showLegend: false,
    showValue: true, dataLabelFontSize: 9, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00",
    catAxisLabelFontSize: 10, catAxisLabelColor: TEXT_DARK,
    valAxisLabelFontSize: 8.5, valAxisLabelColor: TEXT_MUTED,
    catGridLine: { style: "none" }, valGridLine: { color: "E5E5EF", size: 0.75 },
    title: "Feature importance (permutation, test set)", showTitle: true, titleFontSize: 11.5, titleColor: NAVY,
  });

  // top under-monetized venues + top prospects (right)
  let ty = 3.15;
  slide.addText(`Top under-monetized venues (of ${p2.n_flagged} flagged)`, { x: 6.85, y: ty, w: 5.9, h: 0.3, fontSize: 12, bold: true, color: NAVY, fontFace: "Cambria" });
  ty += 0.36;
  p2.top_flags.slice(0, 4).forEach((f) => {
    slide.addText(`Venue #${f.venue_id} (${VTYPE_LABEL[f.venue_type]})`, { x: 6.85, y: ty, w: 4.0, h: 0.3, fontSize: 10, color: TEXT_DARK, fontFace: "Calibri" });
    slide.addText(`${f.gap_pct.toFixed(0)}%`, { x: 10.9, y: ty, w: 1.85, h: 0.3, fontSize: 10, bold: true, color: "B8500A", fontFace: "Calibri", align: "right" });
    ty += 0.32;
  });
  ty += 0.2;
  slide.addText("Top prospect venues (expansion priority)", { x: 6.85, y: ty, w: 5.9, h: 0.3, fontSize: 12, bold: true, color: NAVY, fontFace: "Cambria" });
  ty += 0.36;
  p2.top_prospects.slice(0, 4).forEach((pr) => {
    const tag = pr.in_expansion_market ? "new market" : "existing market";
    slide.addText(`${pr.prospect_id} — ${VTYPE_LABEL[pr.venue_type]} (${tag})`, { x: 6.85, y: ty, w: 4.4, h: 0.3, fontSize: 10, color: TEXT_DARK, fontFace: "Calibri" });
    slide.addText(`$${pr.predicted_revenue.toFixed(0)}`, { x: 11.15, y: ty, w: 1.6, h: 0.3, fontSize: 10, bold: true, color: GOOD_GREEN, fontFace: "Calibri", align: "right" });
    ty += 0.32;
  });

  slide.addText(
    "Flags come from 5-fold out-of-fold predictions, never a model scoring the venue it was trained on. Phase 1's calibrated-lift feature carries near-zero importance — honest, since it's constant within venue_type once venue_type itself is a feature.",
    { x: 0.6, y: 6.65, w: 12.1, h: 0.45, fontSize: 10, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 12 }
  );
  addFooter(slide, "Venue economics — Phase 2");
}

// ---------------------------------------------------------------------------
// Slide 11 — Honest scope
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("Honest scope", { x: 0.6, y: 0.5, w: 8, h: 0.7, fontSize: 30, bold: true, color: NAVY, fontFace: "Cambria" });

  const rows = [
    { label: "Synthetic data", body: "All figures — Phase 1 and Phase 2 — are synthetic, with a known injected ground-truth effect used specifically to validate that each method recovers it before trusting it conceptually. Not a claim about any real company's data." },
    { label: "Media-effectiveness & rate-card figures", body: "Dwell time, screen count, ad rate card, and similar parameters shown are illustrative demo values, not researched real industry benchmarks. In production: Nielsen OOH, DSP data (e.g. Vistar), or Atmosphere's own play logs and rate card." },
    { label: "Multi-touch attribution — deliberately not built", body: "Atmosphere's ambient-screen model has no individual-level, cross-venue touchpoint log by default. Building MTA would require purchased mobile location/device-matching data — a real but non-default assumption, so it's scoped out rather than forced." },
    { label: "Cost & revenue assumptions", body: "The $/frequency-unit figures behind the budget allocator, and the ad-rate-card behind Phase 2's revenue model, are illustrative, editable placeholders — in production these come from Atmosphere's own rate card by venue type and daypart." },
  ];
  let y = 1.5;
  rows.forEach((r) => {
    slide.addShape(pres.ShapeType.rect, { x: 0.6, y: y + 0.06, w: 0.12, h: 1.05, fill: { color: AMBER } });
    slide.addText(r.label, { x: 0.95, y, w: 3.0, h: 1.2, fontSize: 13.5, bold: true, color: NAVY, fontFace: "Calibri", valign: "top" });
    slide.addText(r.body, { x: 4.15, y, w: 8.6, h: 1.2, fontSize: 12, color: TEXT_DARK, fontFace: "Calibri", lineSpacing: 16, valign: "top" });
    y += 1.32;
  });
  addFooter(slide, "Honest scope");
}

// ---------------------------------------------------------------------------
// Slide 12 — Closing / takeaways
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: NAVY };
  slide.addText("Takeaways", { x: 0.9, y: 0.7, w: 10, h: 0.8, fontSize: 34, bold: true, color: WHITE, fontFace: "Cambria" });

  const items = [
    "Match the method to the assignment mechanism — RCT where randomization is designed, synthetic control where it isn't, each with its own validation check.",
    "An uncalibrated MMM understated true incremental value by up to 165% here — experiment calibration isn't optional polish, it's the identification fix.",
    "Optimization needs the right algorithm for the curve's shape — a greedy heuristic silently lost to a naive baseline on non-concave response curves; the exact DP formulation doesn't.",
    "One connected system, not two projects: Phase 2's venue-revenue model reuses Phase 1's causal-value input, recovers latent ground truth at 0.95 correlation, and cleanly separates market-level effects from venue-level execution gaps.",
  ];
  let y = 1.9;
  items.forEach((t, i) => {
    slide.addShape(pres.ShapeType.ellipse, { x: 0.9, y: y + 0.05, w: 0.4, h: 0.4, fill: { color: AMBER } });
    slide.addText(String(i + 1), { x: 0.9, y: y + 0.05, w: 0.4, h: 0.4, fontSize: 14, bold: true, color: NAVY_DARK, align: "center", valign: "middle", fontFace: "Calibri" });
    slide.addText(t, { x: 1.55, y: y - 0.05, w: 11.0, h: 0.9, fontSize: 14.5, color: WHITE, fontFace: "Calibri", lineSpacing: 18 });
    y += 1.15;
  });

  slide.addText("Thank you", { x: 0.9, y: 6.65, w: 6, h: 0.5, fontSize: 16, italic: true, color: ICE, fontFace: "Cambria" });
}

pres.writeFile({ fileName: __dirname + "/AtmosphereTV_DOOH_Measurement.pptx" }).then(() => {
  console.log("Deck written.");
});
