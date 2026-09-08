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
// Q1-Q4 map to slide 4's four business questions; reused by slide 5's process-flow
// steps and by the per-slide "Step X · Answers QY" tags on slides 6-15 so the same
// color consistently means the same question throughout the deck.
const QCOLOR = { Q1: NAVY, Q2: "B8500A", Q3: GOOD_GREEN, Q4: "8E3B60" };

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
}

// Small top-right pill tying a demo slide back to slide 5's numbered pipeline step
// and slide 4's numbered business question -- e.g. "Step 1 of 6 · Answers Q1".
// A neutral TEXT_MUTED color marks a slide that spans multiple steps/questions
// (foundation or transition) rather than answering one directly.
function addStepTag(slide, label, color) {
  const x = 9.0, y = 0.16, w = 3.73, h = 0.27;
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.06, fill: { color: WHITE }, line: { color, width: 1.25 },
  });
  slide.addText(label, {
    x, y, w, h, fontSize: 9.5, bold: true, color, align: "center", valign: "middle", fontFace: "Calibri",
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
    { label: "Synthetic data", body: "Every figure in this project is synthetic. The focus here is the methodology for solving the problem, not real company data or figures." },
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
      body: "Given a budget an advertiser has already committed to Atmosphere, how should it split across restaurants, gyms, bars, and waiting rooms — accounting for each venue type's own diminishing-returns curve?\n\nAn allocation Atmosphere optimizes on its own inventory and hands advertisers as part of the media plan — not a cross-channel budget call made elsewhere.",
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
  slide.addText("The roadmap: four problems, one connected pipeline", {
    x: 0.6, y: 0.5, w: 12.2, h: 0.7, fontSize: 26, bold: true, color: NAVY, fontFace: "Cambria",
  });
  slide.addText("Before the deep dive — this is the shape of what follows.", {
    x: 0.6, y: 1.2, w: 12, h: 0.4, fontSize: 13, italic: true, color: TEXT_MUTED, fontFace: "Calibri",
  });

  const steps = [
    { title: "RCT geo-holdout", sub: "High confidence", desc: "Randomized treated/holdout venues. Balance directly verified.", q: "Q1" },
    { title: "Synthetic control", sub: "Moderate confidence", desc: "Covers historical, non-randomized campaigns. Validated with placebo tests.", q: "Q1" },
    { title: "MMM, RCT-calibrated", sub: "Shape + scale", desc: "Adstock/saturation shape from aggregate data; scale pinned by the RCT.", q: "Q2" },
    { title: "Budget allocator", sub: "Exact DP", desc: "Multiple-choice knapsack over calibrated response curves.", q: "Q2" },
    { title: "Venue revenue model", sub: "GBT, honest OOF", desc: "Venue characteristics + the calibrated lift (steps 1–3) as a feature. Flags under-monetized venues; ranks expansion prospects.", q: "Q3" },
    { title: "Venue retention model", sub: "GBT classifier, honest OOF", desc: "Ops-visible signals (engagement, uptime, complaints, outreach) + realized revenue. Flags at-risk venues; combines with Q3 into one value×risk priority.", q: "Q4" },
  ];
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
    "One connected system, not four separate projects: the calibrated per-exposure lift from steps 1–4 becomes a feature in the venue-revenue model (step 5), which combines with the churn model's risk score (step 6) into one value-×-risk priority list.",
    { x: 0.7, y: 5.85, w: 11.9, h: 0.75, fontSize: 11, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 15 }
  );
  addFooter(slide, "Roadmap");
}

// ---------------------------------------------------------------------------
// Slide 6 — Data & methodology
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("Two data sources: a designed holdout test, and campaign history", {
    x: 0.6, y: 0.5, w: 12.2, h: 0.7, fontSize: 27, bold: true, color: NAVY, fontFace: "Cambria",
  });
  addStepTag(slide, "Foundation for Steps 1–3 · Q1–Q2", TEXT_MUTED);

  slide.addText(
    `${DATA.n_venue_types} venue types × ${DATA.n_venues_per_type} venues each, 104 weeks (52 pre-period + 52 campaign)`,
    { x: 0.6, y: 1.35, w: 12, h: 0.4, fontSize: 15, bold: true, color: AMBER, fontFace: "Calibri" }
  );

  // Same 104 weeks, laid out side by side for both pools — which weeks actually carry
  // ad activity, and for whom, is the thing a reader most often has to ask about twice.
  const weekRows = [
    { seg: "0–51\n(52 wks)\nPre-period", rct: "No ads for either arm — establishes each venue's own baseline.", obs: "No ads yet for anyone — identical baseline period." },
    { seg: "52–59\n(8 wks)", rct: "Still silent — the designed test hasn't launched yet. Unused by the current effect estimate.", obs: "24 of 264 go live here — each on its own timing, no coordination." },
    { seg: "60–69\n(10 wks)\nRCT window", rct: "Treated: fixed 6 plays/wk. Holdout: still 0. The only window the RCT estimate uses.", obs: "37 more go live here — overlap with the RCT window is coincidence, not design." },
    { seg: "70–103\n(34 wks)\nPost-campaign", rct: "Ads stop — a real tail holds for ~10 weeks, then fades to zero (see persistence check, next).", obs: "69 more (the largest group) go live only now — most real campaigns land late, spread thin." },
  ];

  const headerOpts = { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 11.5, valign: "middle", fontFace: "Calibri" };
  const tableRows = [
    [
      { text: "Weeks", options: { ...headerOpts, align: "center" } },
      { text: "RCT pool — 136 venues", options: headerOpts },
      { text: "Observational pool — 264 venues", options: headerOpts },
    ],
    ...weekRows.map((r, i) => {
      const shade = i % 2 === 0 ? "FFFFFF" : "F7F8FC";
      return [
        { text: r.seg, options: { bold: true, color: NAVY, fill: { color: shade }, fontSize: 10.5, valign: "middle", fontFace: "Calibri", lineSpacing: 12 } },
        { text: r.rct, options: { color: TEXT_DARK, fill: { color: "EDF1FB" }, fontSize: 10.5, valign: "middle", fontFace: "Calibri", lineSpacing: 13 } },
        { text: r.obs, options: { color: TEXT_DARK, fill: { color: "FDF1E3" }, fontSize: 10.5, valign: "middle", fontFace: "Calibri", lineSpacing: 13 } },
      ];
    }),
  ];

  slide.addTable(tableRows, {
    x: 0.6, y: 2.0, w: 12.13, colW: [2.15, 4.99, 4.99],
    rowH: [0.42, 0.85, 0.95, 0.95, 0.95],
    border: { type: "solid", color: "E2E5F0", pt: 0.75 },
    autoPage: false,
  });

  slide.addText(
    "RCT pool: assignment is verified, not assumed — anchors high confidence. Observational pool: 134 of 264 venues never run a campaign at all, and the rest 130 go live at their own, uncoordinated point in time — whether a venue is using its own free self-promotion slot or Atmosphere sold the remaining inventory there to an outside advertiser, the panel only records that the screen started playing ads, not who bought the airtime — exactly why synthetic control (next) reconstructs the counterfactual instead of comparing before/after directly.",
    { x: 0.6, y: 6.1, w: 12.13, h: 0.85, fontSize: 10.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 14 }
  );

  addFooter(slide, "Data & methodology");
}

// ---------------------------------------------------------------------------
// Slide 7 — RCT results
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("The proof point: ads move real foot traffic", { x: 0.6, y: 0.45, w: 10, h: 0.65, fontSize: 27, bold: true, color: NAVY, fontFace: "Cambria" });
  addStepTag(slide, "Step 1 of 6 · Answers Q1", QCOLOR.Q1);
  slide.addShape(pres.ShapeType.roundRect, {
    x: 10.7, y: 0.5, w: 2.1, h: 0.55, rectRadius: 0.08, fill: { color: GOOD_GREEN }, line: { type: "none" },
  });
  slide.addText(`${DATA.balance_sig}/${DATA.balance_total} balance tests sig.`, {
    x: 10.7, y: 0.5, w: 2.1, h: 0.55, fontSize: 10.5, bold: true, color: WHITE, align: "center", valign: "middle", fontFace: "Calibri",
  });

  const rct = byOrder(DATA.rct);
  const chartData = [
    { name: "Measured lift", labels: rct.map((r) => VTYPE_LABEL[r.venue_type]), values: rct.map((r) => r.estimated_lift) },
  ];
  slide.addChart(pres.ChartType.bar, chartData, {
    x: 0.6, y: 1.3, w: 7.2, h: 3.3,
    barDir: "col", chartColors: [NAVY], showTitle: false,
    showLegend: true, legendPos: "b", legendFontSize: 10,
    showValue: true, dataLabelFontSize: 9, dataLabelPosition: "outEnd", dataLabelColor: TEXT_DARK,
    catAxisLabelFontSize: 10, catAxisLabelColor: TEXT_DARK,
    valAxisLabelFontSize: 9, valAxisLabelColor: TEXT_MUTED,
    valAxisTitle: "Weekly incremental foot traffic", showValAxisTitle: true, valAxisTitleFontSize: 10,
    catGridLine: { style: "none" }, valGridLine: { color: "E5E5EF", size: 0.75 },
  });

  // Below the chart: how each bar was actually computed — the ANCOVA-style delta
  // estimator and why Welch's t-test, not a pooled-variance t-test or a z-test.
  slide.addText("Method: ANCOVA-style delta estimator", {
    x: 0.6, y: 4.7, w: 7.2, h: 0.28, fontSize: 12.5, bold: true, color: NAVY, fontFace: "Cambria",
  });
  slide.addText(
    "① Per-venue delta = campaign-window avg − pre-period avg — nets out that venue's own baseline.\n"
    + "② Effect = mean(treated deltas) − mean(holdout deltas) — a DiD-style comparison; any trend common to both arms cancels out too.\n"
    + "③ Welch's t-test on the two delta samples (unequal variance, unequal n) → SE, 95% CI, p-value.",
    { x: 0.6, y: 5.0, w: 7.2, h: 1.15, fontSize: 10, color: TEXT_DARK, fontFace: "Calibri", lineSpacing: 13.5 }
  );
  slide.addText(
    "Why delta, not raw post-period levels: individual venues differ a lot in baseline traffic even within one arm — differencing each against its own pre-period average removes that noise, so 15–19 venues/arm reach significance a raw-level comparison couldn't. Why Welch's, not Student's or z: arms are small and unequal in size, so we don't assume equal variance, and we use the t- (not z-) distribution — for both the p-value and the CI — because that variance is itself estimated from so few venues.",
    { x: 0.6, y: 6.15, w: 7.2, h: 0.85, fontSize: 9, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 12 }
  );

  // right-side detail table (n per arm + 95% CI + p-value)
  let ty = 1.3;
  slide.addText("Venue type      n (T/H)   95% CI               p-value", {
    x: 8.1, y: ty, w: 4.6, h: 0.3, fontSize: 9.5, bold: true, color: TEXT_MUTED, fontFace: "Courier New",
  });
  ty += 0.35;
  rct.forEach((r) => {
    const nStr = `${r.n_treated}/${r.n_holdout}`;
    slide.addText(
      `${VTYPE_LABEL[r.venue_type].padEnd(14)} ${nStr.padEnd(9)} [${r.ci_low.toFixed(1)}, ${r.ci_high.toFixed(1)}]   ${pFmt(r.p_value)}`,
      { x: 8.1, y: ty, w: 4.6, h: 0.35, fontSize: 10, color: TEXT_DARK, fontFace: "Courier New" }
    );
    ty += 0.42;
  });
  slide.addText("Why 2/16 isn't a red flag", {
    x: 8.1, y: ty + 0.3, w: 4.6, h: 0.3, fontSize: 12, bold: true, color: NAVY, fontFace: "Cambria",
  });
  slide.addText(
    "16 t-tests = 4 pre-treatment covariates (baseline traffic level, dwell time, screen count, audience quality) × 4 venue types — a separate check from the 136 RCT venues themselves. Only 2 came back significant at p≤0.05.",
    { x: 8.1, y: ty + 0.65, w: 4.6, h: 1.0, fontSize: 10.5, color: TEXT_DARK, fontFace: "Calibri", lineSpacing: 14 }
  );
  slide.addText(
    "If randomization is clean, the count of false positives across 16 independent t-tests follows Binomial(16, 0.05): mean 0.8, P(≥2) ≈ 19%. Two sits well inside that distribution's main mass — nowhere near a red-flag tail value like 8+. Randomization worked as designed, not assumed.",
    { x: 8.1, y: ty + 1.7, w: 4.6, h: 1.35, fontSize: 10.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 14 }
  );

  addFooter(slide, "Causal measurement — RCT");
}

// ---------------------------------------------------------------------------
// Slide 8 — RCT persistence check: does the lift survive after the campaign ends?
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("How long does the lift last after the campaign ends?", {
    x: 0.6, y: 0.45, w: 11.8, h: 0.65, fontSize: 26, bold: true, color: NAVY, fontFace: "Cambria",
  });
  addStepTag(slide, "Step 1 persistence check · Q1", QCOLOR.Q1);
  slide.addText(
    "Same treated-vs-holdout contrast as the previous slide, applied to the weeks after the campaign ends — no new design, no new assumption.",
    { x: 0.6, y: 1.1, w: 12, h: 0.5, fontSize: 12.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri" }
  );

  const decay = DATA.rct_decay; // [during_campaign, weeks_0_10_after, weeks_10_20_after, full_post_campaign]
  const decayLabels = ["During campaign", "0–10 wks after", "10–20 wks after", "Full post-campaign"];
  const decayTableLabels = ["During campaign", "0–10 wks after", "10–20 wks after", "Full post (34wk)"];
  const decayColors = [NAVY, AMBER, "B7BCCB", "B7BCCB"];

  slide.addChart(pres.ChartType.bar, [
    { name: "Estimated lift (network-pooled)", labels: decayLabels, values: decay.map((d) => d.estimated_lift) },
  ], {
    x: 0.6, y: 1.75, w: 7.2, h: 3.1,
    barDir: "col", chartColors: decayColors, showTitle: false, showLegend: false,
    showValue: true, dataLabelFontSize: 10.5, dataLabelPosition: "outEnd", dataLabelColor: TEXT_DARK,
    dataLabelFormatCode: "+0.0;-0.0;0.0",
    catAxisLabelFontSize: 9.5, catAxisLabelColor: TEXT_DARK,
    valAxisLabelFontSize: 9, valAxisLabelColor: TEXT_MUTED,
    valAxisTitle: "Weekly incremental foot traffic", showValAxisTitle: true, valAxisTitleFontSize: 10,
    catGridLine: { style: "none" }, valGridLine: { color: "E5E5EF", size: 0.75 },
  });

  // Below the chart: same estimator as the RCT slide, just re-pointed at later windows.
  slide.addText("Method: same estimator, later windows", {
    x: 0.6, y: 4.95, w: 7.2, h: 0.28, fontSize: 12.5, bold: true, color: NAVY, fontFace: "Cambria",
  });
  slide.addText(
    "Same 3-step ANCOVA-style delta as the RCT slide — per-venue delta (window avg − pre-period avg) → treated-mean minus holdout-mean → Welch's t-test for SE, CI, p-value — but pooled across all 4 venue types here (not split like the RCT slide), and re-applied to each window instead of the single week 60–69 window.",
    { x: 0.6, y: 5.25, w: 7.2, h: 0.8, fontSize: 10, color: TEXT_DARK, fontFace: "Calibri", lineSpacing: 13 }
  );
  slide.addText(
    "Splitting was already thin at ~15–19 venues/arm for one window; spreading that across four venue types and four windows, on top of decay effects that are smaller than the in-campaign lift, would push the noise past what a week-level estimate can resolve.",
    { x: 0.6, y: 6.1, w: 7.2, h: 0.85, fontSize: 9, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 12 }
  );

  let ty = 1.75;
  slide.addText(`n = ${DATA.rct_decay_n_treated} treated / ${DATA.rct_decay_n_holdout} holdout (same venues, every window)`, {
    x: 8.1, y: ty, w: 4.6, h: 0.26, fontSize: 9.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri",
  });
  ty += 0.32;
  slide.addText("Window              95% CI              p-value", {
    x: 8.1, y: ty, w: 4.6, h: 0.3, fontSize: 9.5, bold: true, color: TEXT_MUTED, fontFace: "Courier New",
  });
  ty += 0.32;
  decay.forEach((d, i) => {
    const ciStr = `[${d.ci_low.toFixed(1)}, ${d.ci_high.toFixed(1)}]`;
    slide.addText(
      `${decayTableLabels[i].padEnd(18)} ${ciStr.padEnd(15)} ${pFmt(d.p_value)}`,
      { x: 8.1, y: ty, w: 4.6, h: 0.32, fontSize: 10, color: TEXT_DARK, fontFace: "Courier New" }
    );
    ty += 0.36;
  });

  slide.addText("A small tail, then nothing", {
    x: 8.1, y: ty + 0.18, w: 4.6, h: 0.3, fontSize: 12, bold: true, color: NAVY, fontFace: "Cambria",
  });
  slide.addText(
    "The first 10 weeks after the campaign ends still show a real, significant tail — about 19% of the in-campaign lift (p=0.031). By 10–20 weeks out it's gone (p=0.236), and averaged across the full 34-week post-campaign panel the effect is a clean +0.05 (p=0.945).",
    { x: 8.1, y: ty + 0.52, w: 4.6, h: 1.2, fontSize: 10.5, color: TEXT_DARK, fontFace: "Calibri", lineSpacing: 13.5 }
  );
  slide.addText(
    "Practical read: don't plan on meaningful carryover past the campaign's own window — each flight buys its own 10 weeks of impact, not lingering awareness. That argues for cadence, not one-and-done bursts.",
    { x: 8.1, y: ty + 1.82, w: 4.6, h: 0.95, fontSize: 10.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 13.5 }
  );

  addFooter(slide, "Causal measurement — RCT, post-campaign persistence");
}

// ---------------------------------------------------------------------------
// Slide 9 — Synthetic control results
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("Measuring the campaigns we couldn't randomize", { x: 0.6, y: 0.45, w: 11, h: 0.65, fontSize: 27, bold: true, color: NAVY, fontFace: "Cambria" });
  addStepTag(slide, "Step 2 of 6 · Answers Q1", QCOLOR.Q1);
  slide.addText("Most advertisers' campaigns already ran, on venues they picked — not us. Synthetic control reconstructs the counterfactual anyway, with its own built-in checks.", {
    x: 0.6, y: 1.1, w: 11.8, h: 0.5, fontSize: 12.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri",
  });

  const sc = byOrder(DATA.sc);
  slide.addChart(pres.ChartType.bar, [
    { name: "Measured lift", labels: sc.map((r) => VTYPE_LABEL[r.venue_type]), values: sc.map((r) => r.estimated_lift) },
  ], {
    x: 0.6, y: 1.8, w: 7.2, h: 2.85,
    barDir: "col", chartColors: [NAVY], showLegend: true, legendPos: "b", legendFontSize: 10,
    showValue: true, dataLabelFontSize: 9, dataLabelPosition: "outEnd", dataLabelColor: TEXT_DARK,
    catAxisLabelFontSize: 10, catAxisLabelColor: TEXT_DARK,
    valAxisLabelFontSize: 9, valAxisLabelColor: TEXT_MUTED,
    valAxisTitle: "Weekly incremental foot traffic", showValAxisTitle: true, valAxisTitleFontSize: 10,
    catGridLine: { style: "none" }, valGridLine: { color: "E5E5EF", size: 0.75 },
  });

  // Below the chart: how the synthetic twin behind each bar is actually built.
  slide.addText("Method: build a synthetic twin, per venue", {
    x: 0.6, y: 4.7, w: 7.2, h: 0.28, fontSize: 12.5, bold: true, color: NAVY, fontFace: "Cambria",
  });
  slide.addText(
    "① Donor pool = same-type venues that never ran a campaign (e.g. 31 never-activated bars).\n"
    + "② Fit non-negative weights, one per donor, summing to 1, via SLSQP (Sequential Least Squares Programming, scipy.optimize) minimizing the MSE between the weighted donor blend and this venue's own pre-period traffic (Abadie et al.) — a real blend, typically 5–15 donors get meaningful weight, not one single match.\n"
    + "③ Apply that same weight vector to the donors' post-period traffic → synthetic counterfactual; effect = mean(actual − synthetic) over the venue's own 16-week post-campaign window.",
    { x: 0.6, y: 5.0, w: 7.2, h: 1.55, fontSize: 9.5, color: TEXT_DARK, fontFace: "Calibri", lineSpacing: 12 }
  );
  slide.addText(
    "Unlike the RCT, each venue picks its own pre/post split at its own activation week — no shared campaign window. Each bar is the mean effect across only that type's good pre-period-fit venues (see right) — poor fits are excluded, not averaged in.",
    { x: 0.6, y: 6.6, w: 7.2, h: 0.55, fontSize: 8.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 10.5 }
  );

  let ty = 1.8;
  slide.addText("Venue type    n(used/flag)  Placebo p   RMSPE", {
    x: 8.1, y: ty, w: 4.6, h: 0.28, fontSize: 9.5, bold: true, color: TEXT_MUTED, fontFace: "Courier New",
  });
  ty += 0.32;
  sc.forEach((r) => {
    const nStr = `${r.n_treated_used}/${r.n_treated_flagged}`;
    slide.addText(
      `${VTYPE_LABEL[r.venue_type].padEnd(13)} ${nStr.padEnd(13)} ${r.placebo_p_value.toFixed(3).padEnd(11)} ${r.avg_pre_period_rmspe.toFixed(1)}`,
      { x: 8.1, y: ty, w: 4.6, h: 0.3, fontSize: 9.5, color: TEXT_DARK, fontFace: "Courier New" }
    );
    ty += 0.36;
  });
  ty += 0.08;
  slide.addText(
    "Pre-period RMSPE (root mean squared prediction error) = √mean((actual − synthetic)²) over each venue's own pre-period weeks — how well the twin matches reality before treatment starts. Flagged (excluded from the bar) if RMSPE exceeds 2.5× its type's median — restaurants' high median (26.4) is why 4 of its 46 fits got flagged.",
    { x: 8.1, y: ty, w: 4.6, h: 1.0, fontSize: 9, color: TEXT_DARK, fontFace: "Calibri", lineSpacing: 11.5 }
  );
  ty += 1.08;
  slide.addText(
    "In-space placebo test — substitutes for a p-value since synthetic control has no closed-form SE: rerun the identical fit on every never-activated donor, pretending each was treated. Placebo p = share of donor \"fake effects\" at least as extreme as the real one — restaurant's p=0.158 is the weakest signal (its worst-fitting type too); gym's p=0.054 the strongest.",
    { x: 8.1, y: ty, w: 4.6, h: 1.05, fontSize: 9, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 11.5 }
  );
  ty += 1.15;
  slide.addText("Consistent with the RCT — not independently significant", {
    x: 8.1, y: ty, w: 4.6, h: 0.32, fontSize: 11, bold: true, color: NAVY, fontFace: "Cambria",
  });
  ty += 0.36;
  slide.addText(
    "No type clears p<0.05 alone (gyms closest, 0.054) — but every point estimate lands within ~1.3 of the RCT's own effect for that same type, on a completely different set of venues: real corroboration, just not from this test alone.",
    { x: 8.1, y: ty, w: 4.6, h: 0.6, fontSize: 9, color: TEXT_DARK, fontFace: "Calibri", lineSpacing: 11 }
  );

  addFooter(slide, "Causal measurement — Synthetic Control");
}

// ---------------------------------------------------------------------------
// Slide 10 — MMM calibration (the headline technical story)
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("MMM: an uncalibrated model would have underpriced results", { x: 0.6, y: 0.45, w: 12.3, h: 0.65, fontSize: 25, bold: true, color: NAVY, fontFace: "Cambria" });
  addStepTag(slide, "Step 3 of 6 · Answers Q2", QCOLOR.Q2);
  slide.addText("Adstock + saturation shape comes from the aggregate weekly series; scale is pinned by the RCT's high-confidence estimate.", {
    x: 0.6, y: 1.1, w: 12, h: 0.4, fontSize: 12.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri",
  });

  const mmm = byOrder(DATA.mmm);
  slide.addChart(pres.ChartType.bar, [
    { name: "Naive MMM (uncalibrated)", labels: mmm.map((r) => VTYPE_LABEL[r.venue_type]), values: mmm.map((r) => r.beta_naive) },
    { name: "RCT-calibrated MMM", labels: mmm.map((r) => VTYPE_LABEL[r.venue_type]), values: mmm.map((r) => r.beta_calibrated) },
  ], {
    x: 0.6, y: 1.75, w: 7.6, h: 2.5,
    barDir: "col", chartColors: ["A9AFC7", NAVY], showLegend: true, legendPos: "b", legendFontSize: 9.5,
    showValue: true, dataLabelFontSize: 8.5, dataLabelPosition: "outEnd", dataLabelColor: TEXT_DARK,
    catAxisLabelFontSize: 10, catAxisLabelColor: TEXT_DARK,
    valAxisLabelFontSize: 9, valAxisLabelColor: TEXT_MUTED,
    valAxisTitle: "Max lift at saturation", showValAxisTitle: true, valAxisTitleFontSize: 10,
    catGridLine: { style: "none" }, valGridLine: { color: "E5E5EF", size: 0.75 },
  });

  // Below the chart: how the two bars are actually fit — shape from the aggregate
  // series, scale pinned by the RCT anchor. Two steps, kept deliberately separate.
  slide.addText("Method: fit the shape, then pin the scale", {
    x: 0.6, y: 4.35, w: 7.6, h: 0.26, fontSize: 12.5, bold: true, color: NAVY, fontFace: "Cambria",
  });
  slide.addText(
    "① Fit shape on the aggregate weekly series (all venues of this type, RCT + observational pooled together): adstock carries exposure forward week to week (adstock_t = freq_t + decay×adstock_{t−1}), then a Hill curve turns that into diminishing returns (sat(x) = x^shape / (x^shape + half^shape)). decay, half, and shape are grid-searched — 7 × 6 × 4 = 168 combinations — picking whichever minimizes squared error against actual weekly traffic (with trend + seasonality controls, plain OLS). This gives β_naive, the raw uncalibrated max-lift.\n"
    + "② Pin scale only, via the RCT: simulate the RCT's own exposure (6 plays/wk for 10 weeks) through this same fitted decay/saturation curve to get its implied saturation level, then rescale β so the model's predicted lift there matches the RCT's point estimate exactly. decay/half/shape stay exactly as fit in step ① — only β moves.",
    { x: 0.6, y: 4.63, w: 7.6, h: 1.6, fontSize: 9, color: TEXT_DARK, fontFace: "Calibri", lineSpacing: 10.8 }
  );
  slide.addText(
    "Simplified for the demo: a real deployment would add more controls (competitor spend, price/promo, macro trend), validate the shape out-of-time rather than on in-sample SSE alone, and often blend the experiment in as a Bayesian prior rather than a hard rescale.",
    { x: 0.6, y: 6.28, w: 7.6, h: 0.6, fontSize: 8.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 10.5 }
  );

  let ty = 1.75;
  slide.addText("Calibration adjustment", { x: 8.5, y: ty, w: 4.2, h: 0.3, fontSize: 11.5, bold: true, color: NAVY, fontFace: "Cambria" });
  ty += 0.38;
  mmm.forEach((r) => {
    const sign = r.calibration_adjustment_pct >= 0 ? "+" : "";
    slide.addText(VTYPE_LABEL[r.venue_type], { x: 8.5, y: ty, w: 1.9, h: 0.42, fontSize: 11, color: TEXT_DARK, fontFace: "Calibri" });
    slide.addText(`${sign}${r.calibration_adjustment_pct.toFixed(0)}%`, {
      x: 10.4, y: ty, w: 2.3, h: 0.42, fontSize: 15, bold: true,
      color: Math.abs(r.calibration_adjustment_pct) > 50 ? "B8500A" : GOOD_GREEN, fontFace: "Calibri",
    });
    ty += 0.44;
  });
  ty += 0.14;
  slide.addText("Worked example: restaurant's β, step by step", {
    x: 8.5, y: ty, w: 4.2, h: 0.28, fontSize: 10.5, bold: true, color: NAVY, fontFace: "Cambria",
  });
  ty += 0.32;
  slide.addText(
    "RCT design:      6 plays/wk × 10 wks\n"
    + "Adstock (decay .7): 6.0→10.2→13.1→…→19.4\n"
    + "Saturation (half 6, shape 3): .50→.83→.91→…→.97, avg≈0.90\n"
    + "Naive predicts:  7.97 × 0.90 ≈ 7.2\n"
    + "RCT measured:   16.79 (real, from Slide 7)\n"
    + "Calibrated β:   16.79 ÷ 0.90 ≈ 18.7",
    { x: 8.5, y: ty, w: 4.2, h: 1.3, fontSize: 8.7, color: TEXT_DARK, fontFace: "Courier New", lineSpacing: 13 }
  );
  ty += 1.42;
  slide.addText(
    "Only β is rescaled — decay/half/shape stay exactly as fit in step ①. calibration_adjustment_pct is just (β_calibrated − β_naive) ÷ β_naive: (18.69 − 7.97) ÷ 7.97 ≈ +134%, the number shown for restaurants above.",
    { x: 8.5, y: ty, w: 4.2, h: 1.0, fontSize: 9, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 11.5 }
  );

  addFooter(slide, "Media-mix model");
}

// ---------------------------------------------------------------------------
// Slide 11 — MMM robustness check: competing media as a confounder
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("Robustness check: does competing media break this MMM?", {
    x: 0.6, y: 0.45, w: 12.3, h: 0.65, fontSize: 24, bold: true, color: NAVY, fontFace: "Cambria",
  });
  addStepTag(slide, "Step 3 robustness check · Q2", QCOLOR.Q2);
  slide.addText(
    "A stress-test scenario: a competing advertiser ramps up on the same venues at the same time, correlated with Atmosphere's own exposure — the kind of overlap a real MMM has to prove it's robust to.",
    { x: 0.6, y: 1.1, w: 12, h: 0.4, fontSize: 12, italic: true, color: TEXT_MUTED, fontFace: "Calibri" }
  );

  const cc = DATA.mmm_confounder_check;
  const ccRows = byOrder(cc.rows);
  slide.addChart(pres.ChartType.bar, [
    { name: "Naive MMM (blind to competing media)", labels: ccRows.map((r) => VTYPE_LABEL[r.venue_type]), values: ccRows.map((r) => r.beta_naive_confound_blind) },
    { name: "Confound-aware MMM (controls for it)", labels: ccRows.map((r) => VTYPE_LABEL[r.venue_type]), values: ccRows.map((r) => r.beta_confound_aware) },
  ], {
    x: 0.6, y: 1.75, w: 7.6, h: 4.3,
    barDir: "col", chartColors: ["C44E52", "55A868"], showLegend: true, legendPos: "b", legendFontSize: 9,
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
    `Naive MMM, by contrast, swings from useful to actively misleading: for 3 of 4 venue types the confound-blind fit was off by 2–4× — even at a moderate ${cc.corr_with_own_exposure} correlation between competing media and Atmosphere's own exposure ramp, nowhere near a worst case. Controlling for the confound (green) recovers this model's own baseline from the previous slide — the RCT-scale calibration from that same slide is what closes the rest of the gap.`,
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
// Slide 12a — Why a greedy allocator can lose (worked failure mechanism)
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("Why a greedy allocator can lose to equal-split", { x: 0.6, y: 0.45, w: 12.2, h: 0.65, fontSize: 26, bold: true, color: NAVY, fontFace: "Cambria" });
  addStepTag(slide, "Step 4 motivation · Answers Q2", QCOLOR.Q2);
  slide.addText(
    "A Hill/S-curve (shape > 1, as fit here) is convex before its inflection point — the next dollar's marginal return isn't monotonically falling, so \"chase today's best marginal $\" can get stuck.",
    { x: 0.6, y: 1.1, w: 12, h: 0.45, fontSize: 12, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 14 }
  );

  slide.addChart(pres.ChartType.line, [
    { name: "Restaurant: incremental lift per $1,000 spent", labels: [".25", ".5", ".75", "1.0", "1.5", "2.0"], values: [5.0, 34.2, 86.9, 147.5, 205.8, 198.0] },
  ], {
    x: 0.6, y: 1.75, w: 7.2, h: 3.35,
    chartColors: [NAVY], showLegend: false, lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 6,
    showValue: true, dataLabelFontSize: 9, dataLabelPosition: "t", dataLabelColor: TEXT_DARK, dataLabelFormatCode: "0.0",
    catAxisTitle: "Frequency (plays/venue/wk)", showCatAxisTitle: true, catAxisTitleFontSize: 9.5,
    catAxisLabelFontSize: 10, catAxisLabelColor: TEXT_DARK,
    valAxisLabelFontSize: 9, valAxisLabelColor: TEXT_MUTED,
    valAxisTitle: "Incremental lift per $1,000", showValAxisTitle: true, valAxisTitleFontSize: 10,
    catGridLine: { style: "none" }, valGridLine: { color: "E5E5EF", size: 0.75 },
    title: "The next dollar's return rises, THEN falls — not monotonic", showTitle: true, titleFontSize: 11, titleColor: NAVY,
  });
  slide.addText(
    "This real curve (restaurant, from this deck's own calibrated MMM) is convex up to ~freq 1.0–1.5, concave after. At very low frequency every venue type's next dollar buys almost nothing — still in the flat, convex trough — so a rule comparing \"which type's next dollar looks best right now\" can't see that committing a lump sum to ONE type would pay off later. It only sees today's small, similar-looking numbers.",
    { x: 0.6, y: 5.2, w: 7.2, h: 1.55, fontSize: 10, color: TEXT_DARK, fontFace: "Calibri", lineSpacing: 13 }
  );

  slide.addText("At freq ≈ .25, every type looks similarly unpromising", { x: 8.1, y: 1.75, w: 4.6, h: 0.4, fontSize: 12, bold: true, color: NAVY, fontFace: "Cambria", lineSpacing: 14 });
  slide.addText(
    "Venue type      Lift per $1,000\nBar                    1.4\nRestaurant             5.0\nGym                    6.1\nWaiting room           8.4",
    { x: 8.1, y: 2.25, w: 4.6, h: 1.05, fontSize: 9.5, color: TEXT_DARK, fontFace: "Courier New", lineSpacing: 15 }
  );
  slide.addText(
    "...but each type's own PEAK (always somewhere around freq 1–2) is 15–30× higher:",
    { x: 8.1, y: 3.4, w: 4.6, h: 0.5, fontSize: 10, italic: true, color: TEXT_DARK, fontFace: "Calibri", lineSpacing: 13 }
  );
  slide.addText(
    "Bar ~124      Restaurant ~206\nGym ~132      Waiting room ~247",
    { x: 8.1, y: 3.95, w: 4.6, h: 0.6, fontSize: 9.5, color: TEXT_DARK, fontFace: "Courier New", lineSpacing: 15 }
  );
  slide.addText(
    "A greedy rule that only ever compares \"today's next dollar\" has no way to see that peak from here — it can only react to which of these near-tied numbers is currently largest, one tiny step at a time. This is the mechanism that let an earlier greedy version of this allocator underperform naive equal-split at larger budgets — the retired code itself isn't preserved, but this is the exact response-curve shape it was walking.",
    { x: 8.1, y: 4.65, w: 4.6, h: 2.1, fontSize: 9.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 12.5 }
  );

  addFooter(slide, "Productization — budget allocator, why not greedy");
}

// ---------------------------------------------------------------------------
// Slide 12 — Budget allocator: how the exact DP works
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("Budget allocator: how the exact DP actually works", { x: 0.6, y: 0.45, w: 12.2, h: 0.65, fontSize: 25, bold: true, color: NAVY, fontFace: "Cambria" });
  addStepTag(slide, "Step 4 of 6 · Answers Q2", QCOLOR.Q2);
  slide.addText(
    "No concavity requirement — every discretized spend level is actually evaluated, so by construction it can never do worse than equal-split.",
    { x: 0.6, y: 1.1, w: 12, h: 0.4, fontSize: 12.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri" }
  );

  slide.addText("Method: exact DP in four steps (multiple-choice knapsack)", {
    x: 0.6, y: 1.55, w: 7.3, h: 0.28, fontSize: 12.5, bold: true, color: NAVY, fontFace: "Cambria",
  });
  slide.addText(
    "① Discretize: for each venue_type, sweep frequency 0→14/venue in 0.25 steps (57 points). At each point, read network lift = per-venue lift (from the calibrated MMM response curve) × venue count, and $ spend = freq × cost-per-frequency-unit × venue count.\n"
    + "② Snap every candidate's spend onto a shared $250 grid, so all venue types' options line up on one budget axis — keeping only the highest-lift option at each grid point per type. This is that type's \"menu.\"\n"
    + "③ Process venue types one at a time: for every $ grid point b, try each of that type's menu options with spend ≤ b, add it to whatever the types-already-processed achieved at (b − spend), and keep whichever combination gives the highest total lift — every option is actually tried, not estimated from a local slope.\n"
    + "④ Backtrack from the full-budget column to read off which frequency was actually chosen for each venue type.",
    { x: 0.6, y: 1.85, w: 7.3, h: 2.05, fontSize: 9.3, color: TEXT_DARK, fontFace: "Calibri", lineSpacing: 11.5 }
  );
  slide.addText(
    "Grid granularity ($250 budget steps, 0.25 frequency steps) trades a little precision for tractability — the same principle real deployments use, just at production-scale resolution.",
    { x: 0.6, y: 4.0, w: 7.3, h: 0.5, fontSize: 8.7, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 11 }
  );

  const b100 = DATA.budgets.find((b) => b.budget === 100000);
  const alloc = byOrder(b100.allocation);
  slide.addChart(pres.ChartType.bar, [
    { name: "Allocated weekly budget ($)", labels: alloc.map((r) => VTYPE_LABEL[r.venue_type]), values: alloc.map((r) => r.allocated_weekly_budget) },
  ], {
    x: 0.6, y: 4.6, w: 7.3, h: 2.35,
    barDir: "col", chartColors: [NAVY], showLegend: false,
    showValue: true, dataLabelFontSize: 9.5, dataLabelPosition: "outEnd", dataLabelColor: TEXT_DARK,
    dataLabelFormatCode: "$#,##0",
    catAxisLabelFontSize: 10, catAxisLabelColor: TEXT_DARK,
    valAxisLabelFontSize: 8.5, valAxisLabelColor: TEXT_MUTED, valAxisLabelFormatCode: "$#,##0",
    catGridLine: { style: "none" }, valGridLine: { color: "E5E5EF", size: 0.75 },
    title: "$100,000 weekly budget — DP-optimal allocation", showTitle: true, titleFontSize: 10.5, titleColor: NAVY,
  });

  slide.addText("Gain vs. naive equal-split", { x: 8.2, y: 1.55, w: 4.5, h: 0.35, fontSize: 13, bold: true, color: NAVY, fontFace: "Cambria" });
  DATA.budgets.forEach((b, i) => {
    const y = 2.05 + i * 1.15;
    slide.addText(`$${b.budget.toLocaleString()} budget`, { x: 8.2, y, w: 2.0, h: 0.5, fontSize: 12, color: TEXT_DARK, fontFace: "Calibri" });
    slide.addText(`+${b.gain_pct}%`, { x: 10.2, y: y - 0.05, w: 2.5, h: 0.6, fontSize: 20, bold: true, color: AMBER, fontFace: "Calibri" });
    slide.addText("vs. naive equal-split", { x: 8.2, y: y + 0.42, w: 4.5, h: 0.3, fontSize: 9.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri" });
  });
  slide.addText(
    "The optimizer's edge is largest when budget is scarce — exactly when allocation decisions matter most. (Previous slide: why a greedy walk can lose this edge entirely.)",
    { x: 8.2, y: 5.55, w: 4.6, h: 0.9, fontSize: 10.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 14 }
  );

  addFooter(slide, "Productization — budget allocator");
}

// ---------------------------------------------------------------------------
// Slide 13 — The other side of the business
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: NAVY_DARK };
  slide.addText("The other side of the business", { x: 0.6, y: 0.5, w: 12, h: 0.7, fontSize: 28, bold: true, color: WHITE, fontFace: "Cambria" });
  addStepTag(slide, "Transition · Q1–Q2 → Q3–Q4", TEXT_MUTED);
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
// Slide 14a — Venue revenue model: what feeds in, and why this model
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("Venue revenue model: what feeds in, and why this model", { x: 0.6, y: 0.45, w: 12.2, h: 0.65, fontSize: 23, bold: true, color: NAVY, fontFace: "Cambria" });
  addStepTag(slide, "Step 5 setup · Answers Q3", QCOLOR.Q3);
  slide.addText(
    "Can this venue's own characteristics + a validated advertising effect predict what it actually earns — and surface who's under-monetized or high-potential?",
    { x: 0.6, y: 1.1, w: 12, h: 0.45, fontSize: 12.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 15 }
  );

  // Left: model choice + target
  slide.addText("Model: HistGradientBoostingRegressor (sklearn)", {
    x: 0.6, y: 1.8, w: 5.9, h: 0.55, fontSize: 13.5, bold: true, color: NAVY, fontFace: "Cambria", lineSpacing: 16,
  });
  slide.addText(
    "Chosen because it handles venue_type / geo_cluster / traffic_tier as native categorical splits. geo_cluster alone has 20+ levels — one-hot encoding that would blow the feature space up and dilute each split's signal. categorical_features=\"from_dtype\" avoids that entirely, no preprocessing needed.",
    { x: 0.6, y: 2.4, w: 5.9, h: 1.3, fontSize: 10.5, color: TEXT_DARK, fontFace: "Calibri", lineSpacing: 14 }
  );
  slide.addText("Target: realized_ad_revenue", {
    x: 0.6, y: 3.85, w: 5.9, h: 0.4, fontSize: 13.5, bold: true, color: NAVY, fontFace: "Cambria",
  });
  slide.addText(
    "The venue's actual weekly $ ad revenue — not a proxy, not a survey response.",
    { x: 0.6, y: 4.35, w: 5.9, h: 0.4, fontSize: 10.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 14 }
  );

  // Right: the two-source feature list
  slide.addText("Features — two sources", { x: 6.85, y: 1.8, w: 5.9, h: 0.35, fontSize: 13.5, bold: true, color: NAVY, fontFace: "Cambria" });

  slide.addShape(pres.ShapeType.roundRect, { x: 6.85, y: 2.22, w: 5.9, h: 1.75, rectRadius: 0.07, fill: { color: "F5F7FC" }, line: { type: "none" } });
  slide.addText("This venue's own characteristics", { x: 7.1, y: 2.35, w: 5.4, h: 0.3, fontSize: 11, bold: true, color: NAVY, fontFace: "Cambria" });
  slide.addText(
    "venue_type · geo_cluster · traffic_tier\nbaseline_level · dwell_time_min\nscreen_count · audience_quality",
    { x: 7.1, y: 2.7, w: 5.4, h: 1.15, fontSize: 10.5, color: TEXT_DARK, fontFace: "Courier New", lineSpacing: 17 }
  );

  slide.addShape(pres.ShapeType.roundRect, { x: 6.85, y: 4.12, w: 5.9, h: 1.45, rectRadius: 0.07, fill: { color: "FDF1E3" }, line: { type: "none" } });
  slide.addText("From the Q1/Q2 causal pipeline (RCT: Slide 7 · MMM: Slide 10)", { x: 7.1, y: 4.25, w: 5.4, h: 0.3, fontSize: 10.3, bold: true, color: "8A4B0A", fontFace: "Cambria" });
  slide.addText(
    "calibrated_lift_feature — the RCT-calibrated per-exposure lift from the MMM. This is where the advertising-incrementality pipeline plugs into the venue-economics side — the connection promised on Slide 14, not a separate silo.",
    { x: 7.1, y: 4.58, w: 5.4, h: 0.95, fontSize: 9.7, color: "8A4B0A", fontFace: "Calibri", lineSpacing: 12.5 }
  );

  slide.addShape(pres.ShapeType.roundRect, { x: 0.6, y: 5.75, w: 12.13, h: 1.05, rectRadius: 0.06, fill: { color: "F5F7FC" }, line: { type: "none" } });
  slide.addText(
    "Method, honestly: held-out metrics (next slide) come from a genuine 30% test split, stratified by venue_type — never train-set fit. Under-monetization flags come from 5-fold out-of-fold predictions — every venue's flag uses a model that never saw its own revenue. Prospect venues (no revenue history) are scored by that same trained model, not a separate heuristic.",
    { x: 0.85, y: 5.87, w: 11.6, h: 0.85, fontSize: 10.5, italic: true, color: TEXT_DARK, fontFace: "Calibri", lineSpacing: 14 }
  );

  addFooter(slide, "Venue economics — model & inputs");
}

// ---------------------------------------------------------------------------
// Slide 14 — Venue revenue model results
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("Predicting venue ad-revenue, honestly", { x: 0.6, y: 0.45, w: 12.2, h: 0.65, fontSize: 25, bold: true, color: NAVY, fontFace: "Cambria" });
  addStepTag(slide, "Step 5 of 6 · Answers Q3", QCOLOR.Q3);
  slide.addText("Held-out evaluation, feature importance, and the venues these numbers actually flag (model & features: previous slide).", {
    x: 0.6, y: 1.1, w: 12, h: 0.4, fontSize: 12.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri",
  });

  const p2 = DATA.venue_revenue;
  const metricY = 1.65;
  const metrics = [
    { label: "Held-out R²", value: p2.r2_test.toFixed(2) },
    { label: "Held-out MAPE", value: `${p2.mape_test.toFixed(1)}%` },
    { label: "Held-out MAE", value: `$${p2.mae_test.toFixed(0)}` },
    { label: "Venues flagged", value: String(p2.n_flagged) },
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
    x: 0.6, y: 3.15, w: 5.9, h: 3.1, barDir: "bar", chartColors: ["55A868"], showLegend: false,
    showValue: true, dataLabelFontSize: 9, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00",
    catAxisLabelFontSize: 10, catAxisLabelColor: TEXT_DARK,
    valAxisLabelFontSize: 8.5, valAxisLabelColor: TEXT_MUTED,
    catGridLine: { style: "none" }, valGridLine: { color: "E5E5EF", size: 0.75 },
    title: "Feature importance (permutation, test set)", showTitle: true, titleFontSize: 11.5, titleColor: NAVY,
  });
  slide.addText(
    "Permutation, not gain-based — gain-based splits are biased toward high-cardinality categoricals like geo_cluster (20+ levels).",
    { x: 0.6, y: 6.28, w: 5.9, h: 0.35, fontSize: 8.5, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 10.5 }
  );

  // top under-monetized venues + top prospects (right)
  let ty = 3.15;
  slide.addText(`Top under-monetized venues (of ${p2.n_flagged} flagged)`, { x: 6.85, y: ty, w: 5.9, h: 0.3, fontSize: 12, bold: true, color: NAVY, fontFace: "Cambria" });
  ty += 0.32;
  slide.addText("gap_pct = (actual − OOF predicted) ÷ OOF predicted × 100", {
    x: 6.85, y: ty, w: 5.9, h: 0.22, fontSize: 8.7, italic: true, color: TEXT_MUTED, fontFace: "Courier New",
  });
  ty += 0.26;
  p2.top_flags.slice(0, 4).forEach((f) => {
    slide.addText(`Venue #${f.venue_id} (${VTYPE_LABEL[f.venue_type]})`, { x: 6.85, y: ty, w: 4.0, h: 0.28, fontSize: 10, color: TEXT_DARK, fontFace: "Calibri" });
    slide.addText(`${f.gap_pct.toFixed(0)}%`, { x: 10.9, y: ty, w: 1.85, h: 0.28, fontSize: 10, bold: true, color: "B8500A", fontFace: "Calibri", align: "right" });
    ty += 0.28;
  });
  ty += 0.15;
  slide.addText("Top prospect venues (expansion priority)", { x: 6.85, y: ty, w: 5.9, h: 0.3, fontSize: 12, bold: true, color: NAVY, fontFace: "Cambria" });
  ty += 0.32;
  p2.top_prospects.slice(0, 4).forEach((pr) => {
    const tag = pr.in_expansion_market ? "new market" : "existing market";
    slide.addText(`${pr.prospect_id} — ${VTYPE_LABEL[pr.venue_type]} (${tag})`, { x: 6.85, y: ty, w: 4.4, h: 0.28, fontSize: 10, color: TEXT_DARK, fontFace: "Calibri" });
    slide.addText(`$${pr.predicted_revenue.toFixed(0)}`, { x: 11.15, y: ty, w: 1.6, h: 0.28, fontSize: 10, bold: true, color: GOOD_GREEN, fontFace: "Calibri", align: "right" });
    ty += 0.28;
  });

  slide.addText(
    "Flags come from 5-fold out-of-fold predictions, never a model scoring the venue it was trained on. The calibrated-lift feature carries near-zero importance — honest, since it's constant within venue_type once venue_type itself is a feature.",
    { x: 0.6, y: 6.65, w: 12.1, h: 0.45, fontSize: 10, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 12 }
  );
  addFooter(slide, "Venue economics");
}

// ---------------------------------------------------------------------------
// Slide 15 — Venue retention model results
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  slide.addText("Predicting venue churn risk, honestly", { x: 0.6, y: 0.45, w: 12.2, h: 0.65, fontSize: 25, bold: true, color: NAVY, fontFace: "Cambria" });
  addStepTag(slide, "Step 6 of 6 · Answers Q4", QCOLOR.Q4);
  slide.addText("Gradient-boosted classifier on ops-visible signals (engagement, uptime, complaints, competitor outreach) — the other half of \"what makes a venue valuable and what puts it at risk.\"", {
    x: 0.6, y: 1.1, w: 12, h: 0.4, fontSize: 12, italic: true, color: TEXT_MUTED, fontFace: "Calibri",
  });

  const p3 = DATA.venue_retention;
  const metricY = 1.65;
  const metrics2 = [
    { label: "Held-out AUC", value: p3.auc_test.toFixed(2) },
    { label: "Held-out PR-AUC", value: p3.pr_auc_test.toFixed(2) },
    { label: "Brier score", value: p3.brier_test.toFixed(2) },
    { label: "Venues flagged", value: String(p3.n_flagged) },
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
    "Flags come from 5-fold OOF predictions; AUC/PR-AUC read modest next to the revenue model's R² because churn is a rarer, noisier event to call than revenue — typical for a churn classifier, not a modeling miss. realized_ad_revenue's importance is a venue_type confound, not a causal driver. Each \"Save now\" / flagged venue also carries a SHAP top driver (from the fold model that never saw it) mapped to a concrete action — technical dispatch, AM retention call, content review — not a generic \"reach out.\"",
    { x: 0.6, y: 6.58, w: 12.1, h: 0.6, fontSize: 8.7, italic: true, color: TEXT_MUTED, fontFace: "Calibri", lineSpacing: 10.5 }
  );
  addFooter(slide, "Venue retention");
}

// ---------------------------------------------------------------------------
// Slide 16 — Closing / takeaways
// ---------------------------------------------------------------------------
{
  const slide = pres.addSlide();
  slide.background = { color: NAVY };
  slide.addText("Takeaways", { x: 0.9, y: 0.7, w: 10, h: 0.8, fontSize: 34, bold: true, color: WHITE, fontFace: "Cambria" });

  const items = [
    "Match the method to the assignment mechanism — RCT where randomization is designed, synthetic control where it isn't, each with its own validation check.",
    "An uncalibrated MMM understated the RCT-calibrated estimate by up to 165% here — experiment calibration isn't optional polish, it's the identification fix.",
    "Optimization needs the right algorithm for the curve's shape — a greedy heuristic silently lost to a naive baseline on non-concave response curves; the exact DP formulation doesn't.",
    "One connected system, not four separate projects: the venue-revenue model reuses the causal pipeline's per-exposure value as an input; the retention model then combines its own churn-risk score with that revenue prediction into one value-×-risk priority quadrant — both models are evaluated honestly out-of-fold, never scored on a venue they were trained on, before either is trusted.",
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
