# `data/` — what's here and why

Two kinds of files live in this folder. Worth knowing which is which before browsing —
some columns are answer keys, not inputs.

## Observable data — what a real deployment would plausibly have

| File | Grain | What it holds |
|---|---|---|
| `venues.csv` | one row per venue | type, geo cluster, screen count, dwell time, audience quality, traffic tier, RCT pool/arm assignment |
| `weekly_panel.csv` | one row per venue-week | ad frequency, adstocked exposure, realized foot traffic |
| `venue_economics.csv` | one row per venue | realized weekly ad revenue + the venue characteristics that predict it |
| `venue_retention.csv` | one row per venue | engagement/ops signals (screen uptime, complaints, competitor outreach) + whether it actually churned next quarter |
| `prospect_venues.csv` | one row per prospective venue | venues not yet in the network, scored for expansion priority |

Every column in these five files is something a real account/ops team could plausibly
observe — **except** the ones flagged below.

## Ground truth — validation-only, never fed to any model

Every dataset here is synthetic (see the main README's *Honest scope* section), which
makes it possible to inject a known "true" answer and check that each causal/ML method
actually recovers it before trusting the method conceptually. Those known answers live in
two places:

- **`ground_truth.json`, `venue_economics_ground_truth.json`, `venue_retention_ground_truth.json`**
  — the RNG seeds and generation parameters used to build the synthetic data (e.g. each
  venue type's true media-lift ceiling, or the base weekly ad rate). A few KB each, not
  real Atmosphere figures.
- **A handful of columns embedded directly in the CSVs above**, all prefixed `true_` or
  otherwise named as a latent/flag field:
  - `weekly_panel.csv`: `true_incremental_lift`
  - `venue_economics.csv`: `true_ad_revenue_potential`, `monetization_efficiency`,
    `thin_coverage_market`, `individual_execution_gap`
  - `prospect_venues.csv`: `true_ad_revenue_potential_prospect`
  - `venue_retention.csv`: `true_churn_risk_90d`, `competitive_pressure_market`,
    `relationship_execution_gap`

None of these ever enter a model's feature set, a chart in the deck, or a number pitched
as "the answer" — they exist purely so `src/causal_rct.py`, `src/venue_revenue_model.py`,
`src/venue_retention_model.py`, etc. can print a recovery/correlation check against a
known target before the method is trusted, then get out of the way. Same reason anyone
builds a synthetic test with a known ground truth before trusting a method on real data.
