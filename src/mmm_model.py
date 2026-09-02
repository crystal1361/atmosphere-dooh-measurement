"""
mmm_model.py
============
Media-mix model (MMM): adstock + saturation, fit per venue_type on the
AGGREGATE weekly exposure/foot-traffic series (the view an advertiser or a
sell-side benchmarking product would actually have — not the venue-level
RCT/observational split, which the MMM itself is blind to, exactly like a
real MMM would be).

Two known issues with a plain, uncalibrated MMM motivate the second half of
this script:
  - Its regression coefficients are not causally identified on their own
    (the same endogeneity concern real MMM practitioners raise) — they can
    be biased by whatever correlated confounders and s. In this synthetic
    dataset the aggregate series pools both the randomized RCT venues and
    the non-randomly-selected observational venues, so a naive fit is not
    guaranteed to recover the true effect either.
  - Its adstock/saturation shape parameters are chosen by grid search on
    in-sample fit, which can overfit a shape that happens to explain the
    aggregate series without being causally correct.

To address both, the RCT geo-holdout estimate (the one design in this
project with a directly-testable identifying assumption) is used as a
CALIBRATION ANCHOR: after fitting the naive model, its implied lift at the
RCT's own exposure level is rescaled to match the RCT's point estimate. This
mirrors how modern MMM practice (e.g., experiment-calibrated MMM) resolves
the identification gap — a designed experiment tells you the true scale,
the aggregate time series tells you the shape (adstock decay + saturation
curve) and cross-venue-type variation.

Output: mmm_params.csv (naive vs. calibrated), mmm_response_curves.csv
(frequency -> lift, before/after calibration, for the dashboard).
"""

import json
import os
from itertools import product

import numpy as np
import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUT_TABLES = os.path.join(BASE_DIR, "outputs", "tables")
OUT_FIGS = os.path.join(BASE_DIR, "outputs", "figures")
os.makedirs(OUT_TABLES, exist_ok=True)
os.makedirs(OUT_FIGS, exist_ok=True)

DECAY_GRID = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]
HALF_GRID = [2.0, 3.0, 4.0, 5.0, 6.0, 8.0]
SHAPE_GRID = [1.5, 2.0, 2.5, 3.0]

FREQ_RANGE = np.linspace(0, 14, 57)  # for response-curve export


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
    agg = (
        panel.groupby(["venue_type", "week"])
        .agg(mean_freq=("ad_frequency", "mean"), mean_traffic=("foot_traffic", "mean"))
        .reset_index()
    )
    return agg


def fit_mmm_for_venue_type(agg_vtype):
    agg_vtype = agg_vtype.sort_values("week").reset_index(drop=True)
    weeks = agg_vtype["week"].values
    freq = agg_vtype["mean_freq"].values
    traffic = agg_vtype["mean_traffic"].values

    season_sin = np.sin(2 * np.pi * weeks / 52)
    season_cos = np.cos(2 * np.pi * weeks / 52)
    trend = weeks.astype(float)

    best = None
    for decay, half, shape in product(DECAY_GRID, HALF_GRID, SHAPE_GRID):
        adstocked = apply_adstock(freq, decay)
        sat = hill_saturation(adstocked, half, shape)

        X = np.column_stack([sat, trend, season_sin, season_cos, np.ones_like(trend)])
        coef, residuals, rank, sv = np.linalg.lstsq(X, traffic, rcond=None)
        pred = X @ coef
        sse = float(np.sum((traffic - pred) ** 2))

        if best is None or sse < best["sse"]:
            best = dict(decay=decay, half=half, shape=shape, sse=sse,
                        beta_media=coef[0], coef_full=coef, adstocked=adstocked, sat=sat)

    return best


def calibrate_beta(best, rct_row, gt):
    """Rescale beta_media so that the model-implied lift at the RCT's own
    exposure level (RCT_FREQUENCY sustained for rct_campaign_weeks, run
    through THIS venue_type's fitted decay/shape) matches the RCT point
    estimate exactly. Decay/half/shape (the *shape* of the response) stay
    as fit from the aggregate data; only the *scale* (beta) is corrected —
    this is deliberate: the experiment is the one design here with a
    directly-tested identifying assumption, so it should pin the scale,
    while the richer aggregate series is what actually identifies the
    curve's shape."""
    rct_freq = gt["rct_frequency"]
    rct_weeks = gt["rct_campaign_weeks"]

    sim_freq = np.zeros(rct_weeks + 10)
    sim_freq[10:] = rct_freq  # 10 warm-up weeks at 0, then sustained RCT frequency
    sim_adstock = apply_adstock(sim_freq, best["decay"])
    sim_sat = hill_saturation(sim_adstock, best["half"], best["shape"])
    implied_saturation_at_rct = float(sim_sat[10:].mean())  # steady-state saturation under RCT exposure

    naive_implied_lift = best["beta_media"] * implied_saturation_at_rct
    rct_estimate = rct_row["estimated_lift"]

    if implied_saturation_at_rct > 1e-6:
        beta_calibrated = rct_estimate / implied_saturation_at_rct
    else:
        beta_calibrated = best["beta_media"]

    return dict(
        implied_saturation_at_rct=implied_saturation_at_rct,
        naive_implied_lift_at_rct_exposure=naive_implied_lift,
        rct_estimate=rct_estimate,
        beta_calibrated=beta_calibrated,
        calibration_adjustment_pct=(beta_calibrated - best["beta_media"]) / best["beta_media"] * 100
        if best["beta_media"] != 0 else np.nan,
    )


def main():
    panel = pd.read_csv(os.path.join(DATA_DIR, "weekly_panel.csv"))
    venues = pd.read_csv(os.path.join(DATA_DIR, "venues.csv"))
    panel = panel.merge(venues[["venue_id", "venue_type"]], on="venue_id", how="left")
    with open(os.path.join(DATA_DIR, "ground_truth.json")) as f:
        gt = json.load(f)
    rct_effects = pd.read_csv(os.path.join(OUT_TABLES, "rct_effects.csv")).set_index("venue_type")

    agg = build_weekly_aggregate(panel)

    param_rows = []
    curve_rows = []

    for vtype, agg_vtype in agg.groupby("venue_type"):
        best = fit_mmm_for_venue_type(agg_vtype)
        cal = calibrate_beta(best, rct_effects.loc[vtype], gt)

        true_max_lift = gt["venue_type_params"][vtype]["max_lift"]

        param_rows.append(dict(
            venue_type=vtype,
            fitted_decay=best["decay"], fitted_half=best["half"], fitted_shape=best["shape"],
            beta_naive=best["beta_media"], beta_calibrated=cal["beta_calibrated"],
            naive_implied_lift_at_rct_exposure=cal["naive_implied_lift_at_rct_exposure"],
            rct_anchor_estimate=cal["rct_estimate"],
            calibration_adjustment_pct=cal["calibration_adjustment_pct"],
            true_max_lift_ground_truth=true_max_lift,
            naive_beta_vs_true_max_lift_error=best["beta_media"] - true_max_lift,
            calibrated_beta_vs_true_max_lift_error=cal["beta_calibrated"] - true_max_lift,
        ))

        for f in FREQ_RANGE:
            # steady-state saturation at a constant weekly frequency f
            sat_ss = hill_saturation(f / (1 - best["decay"]) if best["decay"] < 1 else f,
                                      best["half"], best["shape"])
            curve_rows.append(dict(
                venue_type=vtype, frequency=f,
                lift_naive=best["beta_media"] * sat_ss,
                lift_calibrated=cal["beta_calibrated"] * sat_ss,
            ))

    params_df = pd.DataFrame(param_rows)
    curves_df = pd.DataFrame(curve_rows)

    params_df.to_csv(os.path.join(OUT_TABLES, "mmm_params.csv"), index=False)
    curves_df.to_csv(os.path.join(OUT_TABLES, "mmm_response_curves.csv"), index=False)

    print("=== MMM: naive vs. RCT-calibrated beta (max-lift-at-saturation) ===")
    print(params_df[["venue_type", "fitted_decay", "fitted_half", "fitted_shape",
                      "beta_naive", "beta_calibrated", "calibration_adjustment_pct",
                      "true_max_lift_ground_truth"]].to_string(index=False))


if __name__ == "__main__":
    main()
