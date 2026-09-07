"""
mmm_confounder_check.py
========================
A sensitivity / robustness check, NOT a change to this project's core
synthetic world: does a naive, single-channel MMM stay unbiased if a
*competing media* signal exists that correlates with Atmosphere's own
exposure decisions -- and is the RCT estimate robust to the same shock?

Why this is Atmosphere's DS's job at all (and why it's scoped this way, not
as a full multi-channel MMM): deciding how an ADVERTISER should split budget
across Atmosphere + TV + social is the advertiser's/agency's call, not
Atmosphere's -- and Atmosphere has no visibility into competitors' channel
data anyway. What IS Atmosphere's job is proving ITS OWN incremental foot
traffic net of everything else going on in that market. The JD names
"competing media" alongside organic visitation trends and seasonality as a
confounder to net OUT of Atmosphere's own causal read, not a channel to
optimize on someone else's behalf. This ties directly to Atmosphere's own
sell-side incentive: it needs to show clients the lift IT caused, so they
keep buying its ad slots.

Construction: a market_heat shock, one value per (venue_type, week) --
standing in for "how much concurrent promotional/organic activity is
happening in this market this week" (other advertisers' campaigns, local
events) -- correlated with Atmosphere's OWN observational-pool exposure that
week (advertisers tend to ramp Atmosphere spend during generally "hot"
periods, not independently of them), and given its own direct, additive
effect on foot traffic. This is layered ON TOP of the existing, already-
validated weekly_panel.csv as a labeled counterfactual overlay via a new
synthetic_traffic column -- it does NOT touch venues.csv, weekly_panel.csv,
ground_truth.json, or any headline number produced elsewhere in this project.

Because market_heat is common to every venue of a type in a given week
regardless of RCT arm, a randomized treated-vs-holdout comparison is
mechanically immune to it -- exactly why the RCT should anchor this
measurement. A single-channel time-series MMM that does not condition on it
is not, unless the confounder is explicitly added as a control -- which is
also demonstrated here (the "confound-aware" fit).

Output: outputs/tables/mmm_confounder_ablation.csv
"""

import json
import os
from itertools import product

import numpy as np
import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUT_TABLES = os.path.join(BASE_DIR, "outputs", "tables")

RNG_SEED = 20260907
rng = np.random.default_rng(RNG_SEED)

DECAY_GRID = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]
HALF_GRID = [2.0, 3.0, 4.0, 5.0, 6.0, 8.0]
SHAPE_GRID = [1.5, 2.0, 2.5, 3.0]

CORR_WITH_OWN_EXPOSURE = 0.35  # how strongly competing media tracks Atmosphere's own ramp-up --
                                # deliberately moderate (not a worst-case, near-collinear correlation),
                                # so the resulting bias reads as a real, plausible risk rather than a
                                # contrived worst case tuned for a dramatic before/after
CONFOUND_EFFECT_SD = 5.0       # foot-traffic units per 1 SD of competing-media intensity --
                                # roughly a quarter to a half of the venue_type max_lift ground
                                # truths (9-22 units), a meaningful but not overwhelming shock


def hill_saturation(x, half, shape):
    x = np.maximum(x, 0.0)
    return (x ** shape) / (x ** shape + half ** shape)


def apply_adstock(freq_series, decay):
    out = np.zeros_like(freq_series, dtype=float)
    carry = 0.0
    for i, f in enumerate(freq_series):
        carry = f + decay * carry
        out[i] = carry
    return out


def build_weekly_aggregate(panel):
    return (
        panel.groupby(["venue_type", "week"])
        .agg(mean_freq=("ad_frequency", "mean"), mean_traffic=("foot_traffic", "mean"))
        .reset_index()
    )


def inject_confound(agg):
    """Add a market_heat column (one value per venue_type x week), correlated
    with that venue_type's OWN mean exposure that week, plus its direct
    additive effect on a NEW synthetic_traffic column. mean_traffic (the
    real, already-validated series) is left untouched."""
    agg = agg.sort_values(["venue_type", "week"]).reset_index(drop=True)
    agg["market_heat"] = 0.0
    for vtype, idx in agg.groupby("venue_type").groups.items():
        freq = agg.loc[idx, "mean_freq"].values
        freq_sd = freq.std()
        freq_z = (freq - freq.mean()) / (freq_sd if freq_sd > 1e-9 else 1.0)
        noise = rng.normal(0, 1, size=len(freq))
        heat = CORR_WITH_OWN_EXPOSURE * freq_z + np.sqrt(1 - CORR_WITH_OWN_EXPOSURE ** 2) * noise
        agg.loc[idx, "market_heat"] = heat
    agg["synthetic_traffic"] = agg["mean_traffic"] + CONFOUND_EFFECT_SD * agg["market_heat"]
    return agg


def fit_mmm(agg_vtype, traffic_col, extra_regressor_col=None):
    """Same grid-search adstock/saturation fit as mmm_model.py, generalized
    to take an arbitrary traffic column and an optional extra regressor
    (the confound-aware path controls for market_heat; the blind path
    doesn't)."""
    agg_vtype = agg_vtype.sort_values("week").reset_index(drop=True)
    weeks = agg_vtype["week"].values
    freq = agg_vtype["mean_freq"].values
    traffic = agg_vtype[traffic_col].values
    season_sin = np.sin(2 * np.pi * weeks / 52)
    season_cos = np.cos(2 * np.pi * weeks / 52)
    trend = weeks.astype(float)

    best = None
    for decay, half, shape in product(DECAY_GRID, HALF_GRID, SHAPE_GRID):
        adstocked = apply_adstock(freq, decay)
        sat = hill_saturation(adstocked, half, shape)
        cols = [sat, trend, season_sin, season_cos]
        if extra_regressor_col is not None:
            cols.append(agg_vtype[extra_regressor_col].values)
        cols.append(np.ones_like(trend))
        X = np.column_stack(cols)
        coef, _, _, _ = np.linalg.lstsq(X, traffic, rcond=None)
        pred = X @ coef
        sse = float(np.sum((traffic - pred) ** 2))
        if best is None or sse < best["sse"]:
            best = dict(decay=decay, half=half, shape=shape, sse=sse, beta_media=float(coef[0]))
    return best


def rct_robustness_check(venues, panel, gt, agg_with_heat):
    """Apply the identical (venue_type, week) market_heat shock to every RCT
    venue of that type in that week -- both arms alike -- and recompute the
    same ANCOVA-style estimator causal_rct.py uses. If the design is robust,
    the estimate barely moves, because the shock is common to both arms of
    the same venue_type in the same week and cancels in the treated-minus-
    holdout comparison by construction."""
    n_pre = gt["n_weeks_pre"]
    start_off = gt["rct_campaign_start_week_offset"]
    n_camp_weeks = gt["rct_campaign_weeks"]
    camp_week_lo = n_pre + start_off
    camp_week_hi = n_pre + start_off + n_camp_weeks

    heat_map = agg_with_heat.set_index(["venue_type", "week"])["market_heat"].to_dict()

    rct_venues = venues[venues["pool"] == "rct"][["venue_id", "venue_type", "rct_arm"]]
    p = panel.merge(rct_venues, on="venue_id", suffixes=("", "_v"))
    p = p[p["pool"] == "rct"].copy()
    p["heat"] = list(map(lambda vt, wk: heat_map.get((vt, wk), 0.0), p["venue_type"], p["week"]))
    p["confounded_traffic"] = p["foot_traffic"] + CONFOUND_EFFECT_SD * p["heat"]

    pre = p[p["week"] < n_pre].groupby("venue_id")["confounded_traffic"].mean().rename("pre_avg")
    camp = (
        p[(p["week"] >= camp_week_lo) & (p["week"] < camp_week_hi)]
        .groupby("venue_id")["confounded_traffic"].mean().rename("camp_avg")
    )
    venue_level = rct_venues.set_index("venue_id").join([pre, camp])
    venue_level["delta"] = venue_level["camp_avg"] - venue_level["pre_avg"]

    rows = []
    for vtype, g in venue_level.groupby("venue_type"):
        treated = g[g["rct_arm"] == "treated"]["delta"].dropna()
        holdout = g[g["rct_arm"] == "holdout"]["delta"].dropna()
        rows.append(dict(venue_type=vtype, rct_estimate_under_confounding=float(treated.mean() - holdout.mean())))
    return pd.DataFrame(rows)


def main():
    panel = pd.read_csv(os.path.join(DATA_DIR, "weekly_panel.csv"))
    venues = pd.read_csv(os.path.join(DATA_DIR, "venues.csv"))
    panel = panel.merge(venues[["venue_id", "venue_type"]], on="venue_id", how="left")
    with open(os.path.join(DATA_DIR, "ground_truth.json")) as f:
        gt = json.load(f)
    rct_effects = pd.read_csv(os.path.join(OUT_TABLES, "rct_effects.csv")).set_index("venue_type")
    mmm_params = pd.read_csv(os.path.join(OUT_TABLES, "mmm_params.csv")).set_index("venue_type")

    agg = inject_confound(build_weekly_aggregate(panel))

    rows = []
    for vtype, agg_vtype in agg.groupby("venue_type"):
        blind = fit_mmm(agg_vtype, traffic_col="synthetic_traffic")
        aware = fit_mmm(agg_vtype, traffic_col="synthetic_traffic", extra_regressor_col="market_heat")
        beta_clean = float(mmm_params.loc[vtype, "beta_naive"])  # mmm_model.py's own fit, no injected confound
        rows.append(dict(
            venue_type=vtype,
            true_max_lift_ground_truth=gt["venue_type_params"][vtype]["max_lift"],
            beta_clean_no_confound=beta_clean,
            beta_naive_confound_blind=blind["beta_media"],
            beta_confound_aware=aware["beta_media"],
            bias_introduced_by_confound=blind["beta_media"] - beta_clean,
            bias_remaining_after_controlling=aware["beta_media"] - beta_clean,
            rct_estimate_original=float(rct_effects.loc[vtype, "estimated_lift"]),
        ))

    ablation = pd.DataFrame(rows)
    rct_check = rct_robustness_check(venues, panel, gt, agg)
    ablation = ablation.merge(rct_check, on="venue_type")
    ablation["rct_shift_under_confounding"] = (
        ablation["rct_estimate_under_confounding"] - ablation["rct_estimate_original"]
    )

    ablation.to_csv(os.path.join(OUT_TABLES, "mmm_confounder_ablation.csv"), index=False)

    print("=== MMM confounder robustness check (synthetic overlay -- does not change core ground truth) ===")
    print(ablation[["venue_type", "beta_clean_no_confound", "beta_naive_confound_blind",
                     "beta_confound_aware", "bias_introduced_by_confound",
                     "bias_remaining_after_controlling"]].to_string(index=False))
    print("\n=== RCT estimate under the identical shock (should barely move -- randomization is arm-blind to it) ===")
    print(ablation[["venue_type", "rct_estimate_original", "rct_estimate_under_confounding",
                     "rct_shift_under_confounding"]].to_string(index=False))


if __name__ == "__main__":
    main()
