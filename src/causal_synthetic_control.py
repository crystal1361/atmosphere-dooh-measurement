"""
causal_synthetic_control.py
============================
Moderate-confidence causal read for the OBSERVATIONAL pool.

Advertisers picked which obs-pool venues to activate non-randomly (higher
baseline-traffic venues were more likely to be activated — a real selection
mechanism, not a randomized one). A naive before/after or treated-vs-never-
activated comparison on this pool is confounded by that selection, so a
simple average-difference estimate is NOT trustworthy here the way the RCT
estimate is.

For each activated venue, we build a synthetic counterfactual as a weighted
combination of never-activated donor venues of the same venue_type, with
weights chosen (constrained to be non-negative and sum to 1, the classic
Abadie et al. formulation) to best match that venue's OWN pre-campaign
trajectory. The incremental effect is actual-minus-synthetic during the
campaign window.

Two validation checks are reported, because synthetic control's identifying
assumption (the donor pool can approximate what the treated venue *would*
have done absent treatment) is not directly testable the way randomization
is:
  1. Pre-period fit quality (RMSPE) — a poor pre-period fit means the method
     shouldn't be trusted for that venue; such venues are flagged and
     excluded from the aggregated estimate.
  2. In-space placebo test — the identical procedure is run on every donor
     venue (pretending each was "treated"), producing a null distribution of
     placebo effects. The real treated-venue effect is compared against that
     null distribution for an informal, non-parametric significance read
     (synthetic control has no standard closed-form standard error).

Output: synthetic_control_effects.csv, one row per venue_type
(confidence = "moderate").
"""

import json
import os

import numpy as np
import pandas as pd
from scipy.optimize import minimize

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUT_TABLES = os.path.join(BASE_DIR, "outputs", "tables")
OUT_FIGS = os.path.join(BASE_DIR, "outputs", "figures")
os.makedirs(OUT_TABLES, exist_ok=True)
os.makedirs(OUT_FIGS, exist_ok=True)

POST_WINDOW = 16          # matches the ~16-week obs-pool campaign length used in data_generation.py
MIN_PRE_WEEKS = 15        # skip venues whose own pre-period is too short to fit reliably
RMSPE_FLAG_MULTIPLIER = 2.5  # flag a fit as poor if its pre-period RMSPE exceeds
                              # RMSPE_FLAG_MULTIPLIER x the donor pool's median pre-period RMSPE


def load_data():
    venues = pd.read_csv(os.path.join(DATA_DIR, "venues.csv"))
    panel = pd.read_csv(os.path.join(DATA_DIR, "weekly_panel.csv"))
    with open(os.path.join(DATA_DIR, "ground_truth.json")) as f:
        gt = json.load(f)
    return venues, panel, gt


def get_activation_info(venues, panel):
    """Reconstruct each obs-pool venue's activation status and start week
    directly from the simulated panel (ad_frequency > 0 during the campaign
    period), since data_generation.py doesn't persist obs-pool exposure
    assignment as its own file."""
    obs_panel = panel[panel["pool"] == "obs"]
    activated_weeks = (
        obs_panel[obs_panel["ad_frequency"] > 0]
        .groupby("venue_id")["week"].min()
        .rename("campaign_start_week")
    )
    info = venues[venues["pool"] == "obs"][["venue_id", "venue_type"]].set_index("venue_id")
    info = info.join(activated_weeks)
    info["activated"] = info["campaign_start_week"].notna()
    return info.reset_index()


def fit_synthetic_weights(treated_series, donor_matrix):
    """treated_series: 1D array (pre-period weeks) for the treated unit.
    donor_matrix: 2D array (pre-period weeks x n_donors).
    Returns weight vector (non-negative, sums to 1) minimizing pre-period MSE."""
    n_donors = donor_matrix.shape[1]
    x0 = np.repeat(1.0 / n_donors, n_donors)

    def objective(w):
        pred = donor_matrix @ w
        return np.mean((treated_series - pred) ** 2)

    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]
    bounds = [(0.0, 1.0)] * n_donors

    res = minimize(objective, x0, method="SLSQP", bounds=bounds, constraints=constraints,
                    options={"maxiter": 200, "ftol": 1e-8})
    w = np.clip(res.x, 0, None)
    w = w / w.sum() if w.sum() > 0 else x0
    return w


def run_synthetic_control_for_unit(target_id, start_week, panel_wide, donor_ids):
    """Fits weights on pre-period weeks [0, start_week), evaluates effect on
    [start_week, start_week+POST_WINDOW). Returns dict with effect, RMSPE, and
    the weight vector (for diagnostics)."""
    if start_week < MIN_PRE_WEEKS:
        return None

    pre_weeks = panel_wide.index[panel_wide.index < start_week]
    post_weeks = panel_wide.index[
        (panel_wide.index >= start_week) & (panel_wide.index < start_week + POST_WINDOW)
    ]
    if len(pre_weeks) < MIN_PRE_WEEKS or len(post_weeks) == 0:
        return None

    treated_pre = panel_wide.loc[pre_weeks, target_id].values
    donor_pre = panel_wide.loc[pre_weeks, donor_ids].values

    w = fit_synthetic_weights(treated_pre, donor_pre)

    synthetic_full = panel_wide[donor_ids].values @ w
    synthetic_series = pd.Series(synthetic_full, index=panel_wide.index)

    pre_rmspe = float(np.sqrt(np.mean((treated_pre - donor_pre @ w) ** 2)))
    actual_post = panel_wide.loc[post_weeks, target_id]
    synth_post = synthetic_series.loc[post_weeks]
    effect = float((actual_post - synth_post).mean())

    return dict(effect=effect, pre_rmspe=pre_rmspe, weights=w, n_pre_weeks=len(pre_weeks))


def main():
    venues, panel, gt = load_data()
    info = get_activation_info(venues, panel)

    n_pre_baseline = gt["n_weeks_pre"]

    all_rows = []
    example_curves = {}

    for vtype, vinfo in info.groupby("venue_type"):
        donors = vinfo[~vinfo["activated"]]["venue_id"].tolist()
        treated = vinfo[vinfo["activated"]].dropna(subset=["campaign_start_week"])

        vtype_panel = panel[panel["venue_id"].isin(vinfo["venue_id"])]
        panel_wide = vtype_panel.pivot(index="week", columns="venue_id", values="foot_traffic")
        true_lift_wide = vtype_panel.pivot(index="week", columns="venue_id", values="true_incremental_lift")

        # ---- run on every activated (truly treated) venue ----
        treated_results = []
        for _, row in treated.iterrows():
            tid = int(row["venue_id"])
            sw = int(row["campaign_start_week"])
            res = run_synthetic_control_for_unit(tid, sw, panel_wide, donors)
            if res is None:
                continue
            post_weeks = panel_wide.index[(panel_wide.index >= sw) & (panel_wide.index < sw + POST_WINDOW)]
            true_effect = true_lift_wide.loc[post_weeks, tid].mean()
            treated_results.append(dict(venue_id=tid, true_effect=true_effect, **res))

        if not treated_results:
            continue
        treated_df = pd.DataFrame(treated_results)

        # ---- in-space placebo: run identical procedure on donor venues ----
        placebo_effects = []
        rng_local = np.random.default_rng(hash(vtype) % (2**32))
        placebo_start_weeks = treated["campaign_start_week"].astype(int).tolist()
        for did in donors:
            other_donors = [d for d in donors if d != did]
            if len(other_donors) < 5:
                continue
            sw = int(rng_local.choice(placebo_start_weeks)) if placebo_start_weeks else n_pre_baseline
            res = run_synthetic_control_for_unit(did, sw, panel_wide, other_donors)
            if res is not None:
                placebo_effects.append(res["effect"])
        placebo_effects = np.array(placebo_effects)

        # ---- exclude poor pre-period fits from the aggregated estimate ----
        median_rmspe = treated_df["pre_rmspe"].median()
        good_fit = treated_df["pre_rmspe"] <= RMSPE_FLAG_MULTIPLIER * median_rmspe
        n_flagged = (~good_fit).sum()

        kept = treated_df[good_fit]
        agg_effect = kept["effect"].mean()
        agg_true = kept["true_effect"].mean()

        # informal two-sided placebo p-value
        if len(placebo_effects) > 0:
            p_val = float((np.abs(placebo_effects) >= np.abs(agg_effect)).mean())
        else:
            p_val = np.nan

        all_rows.append(
            dict(
                venue_type=vtype,
                method="Synthetic_Control",
                confidence="moderate",
                n_treated_used=int(good_fit.sum()),
                n_treated_flagged_poor_fit=int(n_flagged),
                n_donors=len(donors),
                estimated_lift=agg_effect,
                placebo_p_value=p_val,
                avg_pre_period_rmspe=median_rmspe,
                true_lift_ground_truth=agg_true,
                recovery_error=agg_effect - agg_true,
            )
        )

        # keep one representative example venue (best pre-period fit) for plotting
        if len(kept) > 0:
            best = kept.loc[kept["pre_rmspe"].idxmin()]
            tid = int(best["venue_id"])
            sw = int(treated.loc[treated["venue_id"] == tid, "campaign_start_week"].iloc[0])
            w = best["weights"]
            synth = panel_wide[donors].values @ w
            example_curves[vtype] = dict(
                week=panel_wide.index.values,
                actual=panel_wide[tid].values,
                synthetic=synth,
                start_week=sw,
            )

    effects = pd.DataFrame(all_rows)
    effects.to_csv(os.path.join(OUT_TABLES, "synthetic_control_effects.csv"), index=False)

    np.save(os.path.join(OUT_TABLES, "sc_example_curves.npy"), example_curves, allow_pickle=True)

    print("=== Synthetic Control effect estimates (moderate confidence) ===")
    print(effects[["venue_type", "estimated_lift", "placebo_p_value", "avg_pre_period_rmspe",
                    "n_treated_flagged_poor_fit", "true_lift_ground_truth", "recovery_error"]]
          .to_string(index=False))


if __name__ == "__main__":
    main()
