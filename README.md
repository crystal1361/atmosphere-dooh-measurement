# Atmosphere TV: DOOH Venue Incrementality & Media-Mix Measurement

A technical demo project built for a Senior Data Scientist interview, answering the two
questions Atmosphere's advertising business runs on:

1. **Did the campaign actually work?** — isolate the true incremental foot traffic caused
   by ad exposure, net of seasonality, trend, and each venue's own baseline pattern.
2. **How should budget be spent?** — given a fixed weekly budget, how should it be split
   across venue types (restaurants / gyms / bars / waiting rooms), accounting for each
   type's own diminishing-returns curve?

> **This is a synthetic demo, not a claim about Atmosphere's real data or production
> systems.** Every dataset here is generated with a *known, injected ground-truth effect*
> — see [Honest scope](#honest-scope) — specifically so each method below can be
> validated against a known answer before being trusted conceptually.

## Design

One pipeline, not four disconnected methods. Confidence flows from a designed experiment
into the models that scale it across the whole network:

| Stage | Method | Confidence | Why |
|---|---|---|---|
| 1 | **RCT geo-holdout** | High | Venues are randomly split treated/holdout within `venue_type × geo_cluster × traffic_tier` strata. Balance is directly verified (Table 1 check), not assumed. |
| 2 | **Synthetic control** | Moderate | Covers historical, non-randomized campaigns where advertisers self-selected which venues to activate. Validated with pre-period fit quality (RMSPE) and an in-space placebo test — synthetic control has no closed-form standard error. |
| 3 | **Media-mix model (MMM)** | Shape from data, scale from RCT | Adstock + saturation curves fit on the aggregate weekly exposure series are not causally identified on their own — the RCT's point estimate is used to *calibrate* the model's scale, while its shape (decay, saturation) comes from the richer aggregate series. |
| 4 | **Budget allocator** | Exact DP | An exact dynamic-programming (multiple-choice knapsack) solve over the calibrated response curves — **not** a greedy marginal-value walk. A Hill/S-shaped response curve is convex before its inflection point, so a greedy heuristic isn't guaranteed optimal; an earlier greedy version of this allocator measurably underperformed a naive equal-split baseline. The DP has no concavity requirement and is guaranteed to find the grid-optimal allocation. |

## Key results (synthetic, see `outputs/tables/`)

- **RCT balance check**: 2 of 16 covariate × venue-type tests significant at p≤0.05 — in
  line with chance alone, consistent with randomization working as designed.
- **RCT effect recovery**: estimated lift within ~0.4–3.3 units of the injected ground
  truth across all four venue types (see `outputs/tables/rct_effects.csv`).
- **MMM calibration matters**: the naive, uncalibrated MMM understated true incremental
  lift by **100–165%** for 3 of 4 venue types before RCT calibration
  (`outputs/tables/mmm_params.csv`).
- **Budget allocator**: the exact-DP allocation beats a naive equal-split baseline by
  **+48.6%** at a $20K weekly budget, narrowing to +2.4% at $100K — the optimizer's edge
  is largest exactly when budget is scarce and allocation decisions matter most
  (`src/budget_allocator.py`).

## Repo layout

```
src/
  data_generation.py          # synthetic venues + weekly panel + injected ground truth
  causal_rct.py                # RCT geo-holdout: balance check + effect estimation
  causal_synthetic_control.py  # synthetic control: donor weighting + placebo test
  mmm_model.py                  # adstock/saturation MMM + RCT calibration
  budget_allocator.py           # exact DP budget allocation across venue types
data/                          # generated venues.csv, weekly_panel.csv, ground_truth.json
outputs/tables/                # every script's output tables (effect estimates, params)
outputs/figures/               # (reserved for exported static figures)
dashboard/
  streamlit_app.py              # interactive dashboard — run: streamlit run dashboard/streamlit_app.py
deck/
  build_deck.js                  # pptxgenjs script that builds the presentation deck
  deck_data.json                 # numbers pulled from outputs/tables/ for the deck
  AtmosphereTV_DOOH_Measurement.pptx
```

## Running it

```bash
pip install pandas numpy scipy scikit-learn statsmodels streamlit

python3 src/data_generation.py            # 1. generate synthetic data + ground truth
python3 src/causal_rct.py                  # 2. RCT geo-holdout effects (high confidence)
python3 src/causal_synthetic_control.py    # 3. synthetic control effects (moderate confidence)
python3 src/mmm_model.py                    # 4. MMM, calibrated against the RCT
python3 src/budget_allocator.py             # 5. budget allocation examples (CLI)

streamlit run dashboard/streamlit_app.py    # interactive dashboard
```

## Phase 2 (designed, not built): the other side of the business

Phase 1 above answers the *advertising* side — proving and pricing incrementality, which
feeds Atmosphere's go-to-market motion as a sell-side differentiator. Atmosphere's other
growth lever is its *venue network*: which venue types are worth prioritizing for
expansion, and which existing venues are under-monetized relative to their traffic and
audience quality.

Phase 2's design (not implemented here, given the project timeline): predict a venue's
intrinsic ad-revenue potential using venue characteristics (type, geography, baseline
traffic, screen count, audience-quality proxy) plus Phase 1's validated per-exposure
incremental value as a feature input — a gradient-boosted-trees model with calibration
and honest out-of-sample evaluation, used to (a) rank prospective venues for acquisition
priority and (b) flag existing venues where realized ad revenue lags what their traffic
and audience quality should support.

## Honest scope

- **All data is synthetic**, generated with a known injected ground-truth effect used to
  validate that each method recovers it. Not a claim about any real company's data or
  systems.
- **Media-effectiveness figures** (dwell time, screen count, audience-quality score)
  shown around the dashboard are illustrative demo parameters, not researched real
  industry benchmarks. In production these would come from Nielsen OOH ratings, DSP data
  (e.g. Vistar), or Atmosphere's own play logs.
- **Multi-touch attribution (MTA) was deliberately not built.** Atmosphere's ambient-
  screen exposure model has no individual-level, cross-venue touchpoint log by default —
  building MTA would require purchased mobile location/device-matching data, a real but
  non-default assumption. Rather than force a model onto a data structure that doesn't
  exist, MTA is scoped out and the reason is named directly.
- **Cost-per-frequency-unit assumptions** behind the budget allocator are illustrative,
  editable placeholders (see `DEFAULT_COST_PER_FREQ_UNIT` in `src/budget_allocator.py`),
  not a researched Atmosphere rate card.
- **A real production deployment** would additionally need independent model-risk
  validation (documented intended use, assumptions, and limitations; a conceptual-
  soundness review by a separate team; ongoing monitoring of whether estimated effects
  hold up over time), none of which is in scope for this demo.
