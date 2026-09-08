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
    "A causal measurement framework, calibrated media-mix model, budget optimizer, and venue revenue + retention models — built to answer the questions Atmosphere's advertising business and its own network economics run on.",
    { x: 0.9, y: 4.75, w: 9.8, h: 0.9, fontSize: 15, color: ICE, fontFace: "Calibri", italic: true }
  );
  slide.addText("Yidan Hu", {
    x: 0.9, y: 6.55, w: 4, h: 0.35, fontSize: 12, color: ICE, fontFace: "Calibri",
  });
}

// ---------------------------------------------------------------------------
// Slide 2 — How I'd approach this role (point of view, before the demo)
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("How I'd approach this role", { x: 0.6, y: 0.45, w: 12, h: 0.65, fontSize: 28, bold: true, color: NAVY, fontFace: "Cambria" });
  slide.addText("Before the demo — the operating thesis behind it: what this role should do for Atmosphere, and how I'd prioritize the first few months as its first data scientist.", {
    x: 0.6, y: 1.12, w: 12.1, h: 0.45, fontSize: 12.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 15,
  });

  const pillarY = 1.75, pillarH = 1.7, pillarW = 5.85, pillarGap = 0.3;
  const pillars = [
    {
      x: 0.6, title: "Advertising-side measurement",
      body: "Prove Atmosphere's own incremental foot traffic with methods advertisers can trust — the sell-side differentiator this business runs on. (Answers Q1–Q2.)",
    },
    {
      x: 0.6 + pillarW + pillarGap, title: "Venue-network health",
      body: "Know which venues are generating less ad revenue than their audience is worth, and which are at risk of leaving — protect and grow the inventory Atmosphere actually sells. (Answers Q3–Q4.)",
    },
  ];
  pillars.forEach((p) => {
    slide.addShape(pres.ShapeType.roundRect, {
      x: p.x, y: pillarY, w: pillarW, h: pillarH, rectRadius: 0.1, fill: { color: "F5F7FC" }, line: { type: "none" },
    });
    slide.addText(p.title, { x: p.x + 0.35, y: pillarY + 0.28, w: pillarW - 0.7, h: 0.55, fontSize: 15.5, bold: true, color: NAVY, fontFace: "Cambria", lineSpacing: 18 });
    slide.addText(p.body, { x: p.x + 0.35, y: pillarY + 0.86, w: pillarW - 0.7, h: 0.75, fontSize: 11, color: TEXT_DARK, fontFace: "Calibri", lineSpacing: 14.5 });
  });

  slide.addShape(pres.ShapeType.roundRect, {
    x: 0.6, y: pillarY + pillarH + 0.3, w: 12.1, h: 1.55, rectRadius: 0.08, fill: { color: "FDF1E3" }, line: { type: "none" },
  });
  slide.addText("Not a “quick win vs. foundation” tradeoff — do both in one move", {
    x: 0.85, y: pillarY + pillarH + 0.42, w: 11.6, h: 0.4, fontSize: 13.5, bold: true, color: "8A4B0A", fontFace: "Cambria",
  });
  slide.addText(
    "A stratified RCT geo-holdout is the fastest trustworthy result available — and it doubles as the calibration anchor every other method here relies on: synthetic control's placebo check, the MMM's scale, and the venue models' causal-value feature. Ship it first and the “quick win” and the “foundation” are the same deliverable. The venue-network data pipeline (economics + retention features) doesn't have to wait on it — it builds in parallel.",
    { x: 0.85, y: pillarY + pillarH + 0.82, w: 11.6, h: 0.95, fontSize: 11, italic: true, color: "8A4B0A", fontFace: "Calibri", lineSpacing: 14.5 }
  );

  const doneY = pillarY + pillarH + 0.3 + 1.55 + 0.22;
  slide.addText("What “done” means", { x: 0.6, y: doneY, w: 12.1, h: 0.32, fontSize: 12.5, bold: true, color: NAVY, fontFace: "Cambria" });
  slide.addText(
    "Sales and account teams making different decisions with it: a trusted lift number in a client pitch, a budget conversation anchored to a real response curve, an outreach list ranked by value × risk instead of instinct — not just a model with a good accuracy number.",
    { x: 0.6, y: doneY + 0.34, w: 12.1, h: 0.55, fontSize: 11, color: TEXT_DARK, fontFace: "Calibri", lineSpacing: 14.5 }
  );

  slide.addText(
    "What follows is one concrete example of applying this approach — a synthetic demo.",
    { x: 0.6, y: 6.68, w: 12.1, h: 0.4, fontSize: 11.5, italic: true, color: AMBER, fontFace: "Calibri" }
  );
  addFooter(slide, "How I'd approach this role");
}

// ---------------------------------------------------------------------------
// Slide 3 — Honest scope (project-specific disclaimer before the demo)
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("Honest scope", { x: 0.6, y: 0.45, w: 8, h: 0.65, fontSize: 28, bold: true, color: NAVY, fontFace: "Cambria" });
  slide.addText("Before the demo that follows: the scope caveats specific to this project, stated up front rather than saved for the closing slide.", {
    x: 0.6, y: 1.1, w: 12, h: 0.4, fontSize: 12.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri",
  });

  const rows = [
    { label: "Synthetic data", body: "Every figure in this project is synthetic, with a known injected ground-truth effect used specifically to validate that each method recovers it before trusting it conceptually. Not a claim about any real company's data." },
    { label: "Media-effectiveness & rate-card figures", body: "Dwell time, screen count, ad rate card, and similar parameters shown are illustrative demo values, not researched real industry benchmarks. In production: Nielsen OOH, DSP data (e.g. Vistar), or Atmosphere's own play logs and rate card." },
    { label: "Multi-touch attribution — deliberately not built", body: "Atmosphere's ambient-screen model has no individual-level, cross-venue touchpoint log by default. Building MTA would require purchased mobile location/device-matching data — a real but non-default assumption, so it's scoped out rather than forced." },
    { label: "Online-purchase attribution — also out of scope", body: "Every method here measures incremental foot traffic, not downstream online purchases. Tying exposure to e-commerce conversions needs a device-matched exposure-to-transaction panel — a further non-default assumption layered on top of MTA's." },
    { label: "Cost & revenue assumptions", body: "The $/frequency-unit figures behind the budget allocator, and the ad-rate-card behind the venue-revenue model, are illustrative, editable placeholders — in production these come from Atmosphere's own rate card by venue type and daypart." },
    { label: "Retention model — its own caveats", body: "Churn-hazard, competitive-geo, and engagement-signal parameters are illustrative, not researched attrition benchmarks. geo_cluster is deliberately excluded (small-sample tradeoff); realized_ad_revenue's importance is a venue_type confound, not a causal driver; no prospect-side retention model." },
  ];
  let yScope = 1.75;
  rows.forEach((r) => {
    slide.addShape(pres.ShapeType.rect, { x: 0.6, y: yScope + 0.04, w: 0.12, h: 0.68, fill: { color: AMBER } });
    slide.addText(r.label, { x: 0.95, y: yScope, w: 3.0, h: 0.78, fontSize: 12, bold: true, color: NAVY, fontFace: "Calibri", valign: "top", lineSpacing: 13 });
    slide.addText(r.body, { x: 4.15, y: yScope, w: 8.6, h: 0.78, fontSize: 10.5, color: TEXT_DARK, fontFace: "Calibri", lineSpacing: 12.5, valign: "top" });
    yScope += 0.86;
  });
  addFooter(slide, "Honest scope");
}

// ---------------------------------------------------------------------------
// Slide 4 — Business problem
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("Four questions this project answers", {
    x: 0.6, y: 0.45, w: 12, h: 0.65, fontSize: 28, bold: true, color: NAVY, fontFace: "Cambria",
  });
  slide.addText("Q1–Q2 answer the advertising side (what Atmosphere sells); Q3–Q4 answer the venue-network side (what Atmosphere runs).", {
    x: 0.6, y: 1.08, w: 12, h: 0.35, fontSize: 12, italic: true, color: TEXT_MUTED, fontFace: "Calibri",
  });

  const cardY = 1.6, cardH = 5.05, cardW = 2.85, gap = 0.22;
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
      x: 0.6 + 2 * (cardW + gap), num: "3", title: "Where's the revenue upside?",
      body: "Which existing venues are under-monetized relative to their own traffic and quality — and which prospective venues are worth prioritizing for expansion?\n\nAtmosphere's own buy-side value question.",
    },
    {
      x: 0.6 + 3 * (cardW + gap), num: "4", title: "Which venues are at risk?",
      body: "Which existing venues are likely to leave the network, and which ops-visible signals predict it — combined with Q3's revenue into one value-×-risk priority.\n\nAtmosphere's own buy-side risk question.",
    },
  ];
  cards.forEach((c) => {
    slide.addShape(pres.ShapeType.roundRect, {
      x: c.x, y: cardY, w: cardW, h: cardH, rectRadius: 0.12,
      fill: { color: "F5F7FC" }, line: { type: "none" }, shadow: { type: "outer", color: "888888", opacity: 0.25, blur: 6, offset: 3, angle: 90 },
    });
    slide.addShape(pres.ShapeType.ellipse, { x: c.x + 0.28, y: cardY + 0.3, w: 0.55, h: 0.55, fill: { color: NAVY } });
    slide.addText(c.num, { x: c.x + 0.28, y: cardY + 0.3, w: 0.55, h: 0.55, fontSize: 18, bold: true, color: WHITE, align: "center", valign: "middle", fontFace: "Calibri" });
    slide.addText(c.title, { x: c.x + 0.28, y: cardY + 1.0, w: cardW - 0.56, h: 1.15, fontSize: 13.5, bold: true, color: NAVY, fontFace: "Cambria", lineSpacing: 16 });
    slide.addText(c.body, { x: c.x + 0.28, y: cardY + 2.15, w: cardW - 0.56, h: cardH - 2.4, fontSize: 10, color: TEXT_DARK, fontFace: "Calibri", lineSpacing: 13.5 });
  });
  addFooter(slide, "Business framing");
}

// ---------------------------------------------------------------------------
// Slide 5 — Design overview (process flow)
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("Design: one pipeline, confidence flows from experiment to product", {
    x: 0.6, y: 0.5, w: 12.2, h: 0.7, fontSize: 26, bold: true, color: NAVY, fontFace: "Cambria",
  });

  const steps = [
    { title: "RCT geo-holdout", sub: "High confidence", desc: "Randomized treated/holdout venues. Balance directly verified.", q: "Q1" },
    { title: "Synthetic control", sub: "Moderate confidence", desc: "Covers historical, non-randomized campaigns. Validated with placebo tests.", q: "Q1" },
    { title: "MMM, RCT-calibrated", sub: "Shape + scale", desc: "Adstock/saturation shape from aggregate data; scale pinned by the RCT.", q: "Q2" },
    { title: "Budget allocator", sub: "Exact DP", desc: "Multiple-choice knapsack over calibrated response curves.", q: "Q2" },
    { title: "Venue revenue model", sub: "GBT, honest OOF", desc: "Venue characteristics + the calibrated lift (steps 1–3) as a feature. Flags under-monetized venues; ranks expansion prospects.", q: "Q3" },
    { title: "Venue retention model", sub: "GBT classifier, honest OOF", desc: "Ops-visible signals (engagement, uptime, complaints, outreach) + realized revenue. Flags at-risk venues; combines with Q3 into one value×risk priority.", q: "Q4" },
  ];
  const QCOLOR = { Q1: NAVY, Q2: "B8500A", Q3: GOOD_GREEN, Q4: "8E3B60" };
  // Each question gets one color family: dark box = that group's "deliverable" step,
  // light tint = that group's other step(s) -- so a shared hue, not just the badge,
  // signals which steps belong together (was a flat neutral gray for steps 2-3 before,
  // which made Q1's step 2 and Q2's step 3 look like the same group).
  const LIGHT_TINT = { Q1: "E4E9F7", Q2: "FBE8D2", Q3: "E2F1E9", Q4: "F5E3EC" };
  const boxW = 1.9, boxH = 3.1, startX = 0.55, y = 2.0, gapX = 0.2;
  const darkBoxes = [0, 3, 4, 5]; // highest-confidence input (0) + the three concrete deliverables (3, 4, 5)
  steps.forEach((s, i) => {
    const x = startX + i * (boxW + gapX);
    const isDark = darkBoxes.includes(i);
    slide.addShape(pres.ShapeType.roundRect, {
      x, y, w: boxW, h: boxH, rectRadius: 0.1,
      fill: { color: i === 0 ? NAVY : i === 3 ? AMBER : i === 4 ? GOOD_GREEN : i === 5 ? QCOLOR.Q4 : LIGHT_TINT[s.q] },
      line: { type: "none" },
    });
    const titleColor = isDark ? WHITE : NAVY;
    // Q1/Q2/Q3/Q4 tag: which of the four business questions (slide 3) this step answers.
    slide.addShape(pres.ShapeType.roundRect, {
      x: x + boxW - 0.56, y: y + 0.1, w: 0.44, h: 0.26, rectRadius: 0.06,
      fill: { color: WHITE }, line: { color: QCOLOR[s.q], width: 1 },
    });
    slide.addText(s.q, {
      x: x + boxW - 0.56, y: y + 0.1, w: 0.44, h: 0.26, fontSize: 9.5, bold: true,
      color: QCOLOR[s.q], align: "center", valign: "middle", fontFace: "Calibri",
    });
    slide.addText(String(i + 1), { x: x + 0.13, y: y + 0.1, w: 0.5, h: 0.42, fontSize: 16, bold: true, color: titleColor, fontFace: "Calibri" });
    slide.addText(s.title, { x: x + 0.13, y: y + 0.56, w: boxW - 0.26, h: 0.8, fontSize: 12, bold: true, color: titleColor, fontFace: "Cambria", lineSpacing: 13.5 });
    slide.addText(s.sub, { x: x + 0.13, y: y + 1.4, w: boxW - 0.26, h: 0.35, fontSize: 9, bold: true, italic: true, color: isDark ? ICE : QCOLOR[s.q], fontFace: "Calibri" });
    slide.addText(s.desc, { x: x + 0.13, y: y + 1.78, w: boxW - 0.26, h: boxH - 1.93, fontSize: 8.7, color: isDark ? WHITE : TEXT_DARK, fontFace: "Calibri", lineSpacing: 11 });
    if (i < steps.length - 1) {
      slide.addText("→", { x: x + boxW, y: y + boxH / 2 - 0.3, w: gapX, h: 0.6, fontSize: 16, color: NAVY, align: "center", fontFace: "Arial" });
    }
  });

  // Grouping labels under each step (or pair of steps), tying the flow back to slide 3's numbered
  // questions — each question gets the same visual treatment, not a footnote.
  const groupLabelY = y + boxH + 0.12;
  slide.addText("Answers Q1 — did the campaign work?", {
    x: startX, y: groupLabelY, w: 2 * boxW + gapX, h: 0.4, fontSize: 10, bold: true, color: QCOLOR.Q1, align: "center", fontFace: "Calibri", lineSpacing: 12,
  });
  slide.addText("Answers Q2 — how should budget be spent?", {
    x: startX + 2 * (boxW + gapX), y: groupLabelY, w: 2 * boxW + gapX, h: 0.4, fontSize: 10, bold: true, color: QCOLOR.Q2, align: "center", fontFace: "Calibri", lineSpacing: 12,
  });
  slide.addText("Answers Q3 — revenue upside?", {
    x: startX + 4 * (boxW + gapX), y: groupLabelY, w: boxW, h: 0.4, fontSize: 10, bold: true, color: QCOLOR.Q3, align: "center", fontFace: "Calibri", lineSpacing: 12,
  });
  slide.addText("Answers Q4 — retention risk?", {
    x: startX + 5 * (boxW + gapX), y: groupLabelY, w: boxW, h: 0.4, fontSize: 10, bold: true, color: QCOLOR.Q4, align: "center", fontFace: "Calibri", lineSpacing: 12,
  });

  slide.addText(
    "Steps 1–2 answer Q1: RCT for randomized campaigns, synthetic control extending coverage to historical, non-randomized ones. Steps 3–4 turn that into Q2: MMM shapes the response curve, the RCT pins its scale, and the allocator solves the exact split. Step 5 answers Q3: the venue-revenue model reuses the calibrated per-exposure lift from steps 1–3 as a feature. Step 6 answers Q4: a separate churn classifier flags at-risk venues, then combines its risk score with step 5's revenue into one value-×-risk priority — one connected system feeding all four answers, not four separate projects bolted together.",
    { x: 0.7, y: 5.78, w: 11.9, h: 1.15, fontSize: 10.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 13.5 }
  );
  addFooter(slide, "Design overview");
}

// ---------------------------------------------------------------------------
// Slide 6 — Data & methodology
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
// Slide 7 — RCT results
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
// Slide 8 — Synthetic control results
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
// Slide 9 — MMM calibration (the headline technical story)
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
// Slide 10 — MMM robustness check: competing media as a confounder
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("Robustness check: does competing media break this MMM?", {
    x: 0.6, y: 0.45, w: 12.3, h: 0.65, fontSize: 24, bold: true, color: NAVY, fontFace: "Cambria",
  });
  slide.addText(
    "A synthetic “other advertisers were busy too” shock, correlated with Atmosphere's own exposure ramp-up — layered onto the validated data as a labeled overlay, not a change to it.",
    { x: 0.6, y: 1.1, w: 12, h: 0.4, fontSize: 12, italic: true, color: TEXT_MUTED, fontFace: "Calibri" }
  );

  const cc = DATA.mmm_confounder_check;
  const ccRows = byOrder(cc.rows);
  slide.addChart(pres.ChartType.bar, [
    { name: "Naive MMM (blind to competing media)", labels: ccRows.map((r) => VTYPE_LABEL[r.venue_type]), values: ccRows.map((r) => r.beta_naive_confound_blind) },
    { name: "Confound-aware MMM (controls for it)", labels: ccRows.map((r) => VTYPE_LABEL[r.venue_type]), values: ccRows.map((r) => r.beta_confound_aware) },
    { name: "True max lift", labels: ccRows.map((r) => VTYPE_LABEL[r.venue_type]), values: ccRows.map((r) => r.true_max_lift_ground_truth) },
  ], {
    x: 0.6, y: 1.75, w: 7.6, h: 4.3,
    barDir: "col", chartColors: ["C44E52", "55A868", AMBER], showLegend: true, legendPos: "b", legendFontSize: 9,
    showValue: true, dataLabelFontSize: 8.5, dataLabelPosition: "outEnd", dataLabelColor: TEXT_DARK,
    catAxisLabelFontSize: 10, catAxisLabelColor: TEXT_DARK,
    valAxisLabelFontSize: 9, valAxisLabelColor: TEXT_MUTED,
    valAxisTitle: "Max lift at saturation", showValAxisTitle: true, valAxisTitleFontSize: 10,
    catGridLine: { style: "none" }, valGridLine: { color: "E5E5EF", size: 0.75 },
  });

  slide.addShape(pres.ShapeType.roundRect, { x: 8.5, y: 1.75, w: 4.23, h: 1.35, rectRadius: 0.08, fill: { color: "F5F7FC" }, line: { type: "none" } });
  slide.addText("RCT estimate shift under the identical shock", { x: 8.7, y: 1.88, w: 3.85, h: 0.4, fontSize: 11, bold: true, color: NAVY, fontFace: "Cambria" });
  slide.addText("0.00", { x: 8.7, y: 2.25, w: 3.85, h: 0.65, fontSize: 32, bold: true, color: GOOD_GREEN, fontFace: "Calibri" });
  slide.addText("every venue type — the shock hits both arms equally, so a randomized comparison is mechanically immune to it", {
    x: 8.7, y: 2.88, w: 3.85, h: 0.2, fontSize: 8.7, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 10,
  });

  slide.addText(
    `Naive MMM, by contrast, swings from useful to actively misleading: for 3 of 4 venue types the confound-blind fit was off by 2–4× — even though the injected correlation between competing media and Atmosphere's own exposure ramp is only ${cc.corr_with_own_exposure} (moderate, not a worst case). Controlling for the confound (green) recovers this model's own uncalibrated baseline from the previous slide — still short of true max lift (orange) until the RCT-scale calibration from that same slide is applied on top.`,
    { x: 8.5, y: 3.35, w: 4.23, h: 1.55, fontSize: 10, color: TEXT_DARK, fontFace: "Calibri", lineSpacing: 13.5 }
  );

  slide.addShape(pres.ShapeType.roundRect, { x: 0.6, y: 6.22, w: 12.13, h: 0.78, rectRadius: 0.06, fill: { color: "FDF1E3" }, line: { type: "none" } });
  slide.addText(
    "Why this is scoped this way: deciding how an advertiser splits budget across Atmosphere + TV + social is the advertiser's/agency's call — Atmosphere has no visibility into competitors' channel data anyway. What Atmosphere's DS role should own is netting competing media OUT of its own causal read (the JD's own phrasing), which the RCT does by design and a single-channel MMM only does with an explicit control.",
    { x: 0.8, y: 6.32, w: 11.75, h: 0.6, fontSize: 9.5, italic: true, color: "8A4B0A", fontFace: "Calibri", lineSpacing: 12 }
  );
  addFooter(slide, "Media-mix model — robustness");
}

// ---------------------------------------------------------------------------
// Slide 11 — Budget allocator
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
// Slide 12 — The other side of the business
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: NAVY_DARK };
  slide.addText("The other side of the business", { x: 0.6, y: 0.5, w: 12, h: 0.7, fontSize: 28, bold: true, color: WHITE, fontFace: "Cambria" });
  slide.addText("One system answers the advertising side. The same system answers the venue-network side too.", {
    x: 0.6, y: 1.2, w: 12, h: 0.45, fontSize: 13.5, italic: true, color: ICE, fontFace: "Calibri",
  });

  const colW = 5.7, y0 = 1.85, h0 = 4.75, gap = 0.5;
  const p1 = { x: 0.6, title: "Advertising incrementality", items: [
    "Prove and price advertising incrementality",
    "Feeds go-to-market: sell-side differentiator, client trust",
    "RCT + synthetic control + calibrated MMM + budget DP",
  ]};
  const p2 = { x: 0.6 + colW + gap, title: "Venue network economics", items: [
    "Predict realized ad-revenue (Q3) and 90-day churn risk (Q4) from characteristics and ops signals",
    "Flag under-monetized (Q3) and at-risk (Q4) existing venues for sales/ops follow-up",
    "Rank prospective venues for expansion priority (Q3)",
    "Combine Q3 revenue + Q4 risk into one value-×-risk priority quadrant",
    "GBT regressor + classifier, honest out-of-fold evaluation throughout",
  ]};
  [p1, p2].forEach((p, idx) => {
    slide.addShape(pres.ShapeType.roundRect, {
      x: p.x, y: y0, w: colW, h: h0, rectRadius: 0.1,
      fill: { color: idx === 0 ? "2A3480" : AMBER }, line: { type: "none" },
    });
    slide.addText(p.title, { x: p.x + 0.4, y: y0 + 0.3, w: colW - 0.8, h: 0.65, fontSize: 16, bold: true, color: WHITE, fontFace: "Cambria" });
    let iy = y0 + 1.1;
    const itemH = idx === 0 ? 0.65 : 0.58;
    const itemStep = idx === 0 ? 0.72 : 0.66;
    const itemFontSize = idx === 0 ? 12 : 10.8;
    p.items.forEach((it) => {
      slide.addText("• " + it, { x: p.x + 0.4, y: iy, w: colW - 0.8, h: itemH, fontSize: itemFontSize, color: WHITE, fontFace: "Calibri", lineSpacing: 13.5 });
      iy += itemStep;
    });
    if (idx === 0) {
      slide.addText(
        "Feeds the venue-economics model as a validated causal-value input (calibrated per-exposure lift), not a separate silo.",
        { x: p.x + 0.4, y: y0 + h0 - 0.65, w: colW - 0.8, h: 0.55, fontSize: 10, italic: true, color: ICE, fontFace: "Calibri", lineSpacing: 13 }
      );
    }
  });
  slide.addText(
    "“Smarter on both sides of the business” — the venue-side model shares its data foundation and causal-value input with the advertising side, rather than being a disconnected second project. Results on the next slide.",
    { x: 0.6, y: 6.85, w: 12, h: 0.5, fontSize: 11.5, italic: true, color: ICE, fontFace: "Calibri" }
  );
}

// ---------------------------------------------------------------------------
// Slide 13 — Venue revenue model results
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("Predicting venue ad-revenue, honestly", { x: 0.6, y: 0.45, w: 12.2, h: 0.65, fontSize: 25, bold: true, color: NAVY, fontFace: "Cambria" });
  slide.addText("Gradient-boosted trees on observable venue characteristics + the calibrated per-exposure lift as a feature.", {
    x: 0.6, y: 1.1, w: 12, h: 0.4, fontSize: 12.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri",
  });

  const p2 = DATA.venue_revenue;
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
    "Flags come from 5-fold out-of-fold predictions, never a model scoring the venue it was trained on. The calibrated-lift feature carries near-zero importance — honest, since it's constant within venue_type once venue_type itself is a feature.",
    { x: 0.6, y: 6.65, w: 12.1, h: 0.45, fontSize: 10, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 12 }
  );
  addFooter(slide, "Venue economics");
}

// ---------------------------------------------------------------------------
// Slide 14 — Venue retention model results
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("Predicting venue churn risk, honestly", { x: 0.6, y: 0.45, w: 12.2, h: 0.65, fontSize: 25, bold: true, color: NAVY, fontFace: "Cambria" });
  slide.addText("Gradient-boosted classifier on ops-visible signals (engagement, uptime, complaints, competitor outreach) — the other half of \"what makes a venue valuable and what puts it at risk.\"", {
    x: 0.6, y: 1.1, w: 12, h: 0.4, fontSize: 12, italic: true, color: TEXT_MUTED, fontFace: "Calibri",
  });

  const p3 = DATA.venue_retention;
  const metricY = 1.65;
  const metrics2 = [
    { label: "Held-out AUC (oracle ceiling: 0.73)", value: p3.auc_test.toFixed(2) },
    { label: "Held-out PR-AUC", value: p3.pr_auc_test.toFixed(2) },
    { label: "OOF corr. w/ latent true risk", value: p3.oof_true_risk_corr.toFixed(2) },
    { label: "Flagged-tail latent risk rate", value: `${p3.flagged_latent_gap_rate.toFixed(0)}% vs ${p3.population_latent_gap_rate.toFixed(0)}%` },
  ];
  const mW2 = 2.9;
  metrics2.forEach((m, i) => {
    const x = 0.6 + i * (mW2 + 0.15);
    slide.addShape(pres.ShapeType.roundRect, { x, y: metricY, w: mW2, h: 1.15, rectRadius: 0.08, fill: { color: "F5F7FC" }, line: { type: "none" } });
    slide.addText(m.value, { x: x + 0.15, y: metricY + 0.12, w: mW2 - 0.3, h: 0.55, fontSize: 22, bold: true, color: NAVY, fontFace: "Calibri" });
    slide.addText(m.label, { x: x + 0.15, y: metricY + 0.68, w: mW2 - 0.3, h: 0.4, fontSize: 9, color: TEXT_MUTED, fontFace: "Calibri" });
  });

  // feature importance chart (left)
  const feat2 = p3.top_features.slice().reverse();
  slide.addChart(pres.ChartType.bar, [
    { name: "Importance (mean AUC drop)", labels: feat2.map((f) => f.feature.replace(/_/g, " ")), values: feat2.map((f) => f.importance) },
  ], {
    x: 0.6, y: 3.15, w: 5.9, h: 3.55, barDir: "bar", chartColors: ["C44E52"], showLegend: false,
    showValue: true, dataLabelFontSize: 9, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000",
    catAxisLabelFontSize: 10, catAxisLabelColor: TEXT_DARK,
    valAxisLabelFontSize: 8.5, valAxisLabelColor: TEXT_MUTED,
    catGridLine: { style: "none" }, valGridLine: { color: "E5E5EF", size: 0.75 },
    title: "Feature importance (permutation, test set) — leading indicators", showTitle: true, titleFontSize: 11, titleColor: NAVY,
  });

  // top at-risk venues (with SHAP-derived driver + action) + priority quadrant (right)
  // DRIVER_TAG: each flagged venue's top SHAP-attributed feature, translated to the
  // short action an account team would actually take -- not just a rank position.
  // "Which feature matters on average" (the chart on the left) can't say why any ONE
  // venue is flagged; this is that per-venue answer.
  const DRIVER_TAG = {
    engagement_trend_90d: "engagement declining → content/placement review",
    screen_uptime_pct: "uptime issue → dispatch technical support",
    complaint_count_90d: "complaint(s) open → account manager follow-up",
    competitor_outreach_flag: "competitor contact → retention conversation",
    self_ad_promo_utilization: "low platform use → feature walkthrough",
  };
  let ty2 = 3.15;
  slide.addText(`Top at-risk venues (of ${p3.n_flagged} flagged, by OOF risk)`, { x: 6.85, y: ty2, w: 5.9, h: 0.28, fontSize: 12, bold: true, color: NAVY, fontFace: "Cambria" });
  ty2 += 0.32;
  p3.top_at_risk.slice(0, 3).forEach((f) => {
    slide.addText(`Venue #${f.venue_id} (${VTYPE_LABEL[f.venue_type]})`, { x: 6.85, y: ty2, w: 4.35, h: 0.24, fontSize: 10, color: TEXT_DARK, fontFace: "Calibri" });
    slide.addText(`${(f.churn_risk_oof * 100).toFixed(0)}%`, { x: 11.2, y: ty2, w: 1.55, h: 0.24, fontSize: 10, bold: true, color: "B8500A", fontFace: "Calibri", align: "right" });
    slide.addText(DRIVER_TAG[f.top_driver] || f.top_driver, { x: 6.85, y: ty2 + 0.22, w: 5.9, h: 0.22, fontSize: 9, italic: true, color: "8A4B0A", fontFace: "Calibri" });
    ty2 += 0.46;
  });
  ty2 += 0.1;
  slide.addText("Priority quadrant (Q3 revenue × Q4 risk)", { x: 6.85, y: ty2, w: 5.9, h: 0.26, fontSize: 12, bold: true, color: NAVY, fontFace: "Cambria" });
  ty2 += 0.3;
  const QUAD_COLOR = {
    "Save now (high value, high risk)": "B8500A",
    "Protect (high value, low risk)": GOOD_GREEN,
    "Low priority (low value, high risk)": TEXT_MUTED,
    "Monitor (low value, low risk)": "5B6178",
  };
  Object.entries(p3.quadrant_counts).forEach(([label, count]) => {
    slide.addText(label, { x: 6.85, y: ty2, w: 4.4, h: 0.26, fontSize: 10, color: TEXT_DARK, fontFace: "Calibri" });
    slide.addText(String(count), { x: 11.15, y: ty2, w: 1.6, h: 0.26, fontSize: 10, bold: true, color: QUAD_COLOR[label] || NAVY, fontFace: "Calibri", align: "right" });
    ty2 += 0.27;
  });

  slide.addText(
    "Flags come from 5-fold OOF predictions; AUC/PR-AUC read modest next to the revenue model's R² only because the oracle ceiling here is 0.73 AUC. realized_ad_revenue's importance is a venue_type confound, not a causal driver. Each \"Save now\" / flagged venue also carries a SHAP top driver (from the fold model that never saw it) mapped to a concrete action — technical dispatch, AM retention call, content review — not a generic \"reach out.\"",
    { x: 0.6, y: 6.58, w: 12.1, h: 0.6, fontSize: 8.7, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 10.5 }
  );
  addFooter(slide, "Venue retention");
}

// ---------------------------------------------------------------------------
// Slide 15 — Closing / takeaways
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: NAVY };
  slide.addText("Takeaways", { x: 0.9, y: 0.7, w: 10, h: 0.8, fontSize: 34, bold: true, color: WHITE, fontFace: "Cambria" });

  const items = [
    "Match the method to the assignment mechanism — RCT where randomization is designed, synthetic control where it isn't, each with its own validation check.",
    "An uncalibrated MMM understated true incremental value by up to 165% here — experiment calibration isn't optional polish, it's the identification fix.",
    "Optimization needs the right algorithm for the curve's shape — a greedy heuristic silently lost to a naive baseline on non-concave response curves; the exact DP formulation doesn't.",
    "One connected system, not four separate projects: the venue-revenue model reuses the causal pipeline's per-exposure value as an input; the retention model then combines its own churn-risk score with that revenue prediction into one value-×-risk priority quadrant — both models recover their respective latent ground truths (0.95 and 0.73 correlation) before either is trusted.",
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
