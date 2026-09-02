"""
causal_rct.py
=============
High-confidence causal read: the RCT geo-holdout design.

Within the RCT pool, venues were randomly split (stratified by venue_type x
geo_cluster x baseline traffic tier) into "treated" (gets a fixed benchmark
campaign) vs "holdout" (gets nothing) for a defined window. Because
assignment was randomized, treated and holdout venues should be comparable
on every pre-treatment covariate *by construction* — we verify that
directly (a "Table 1" balance check) rather than assuming it, then estimate
the incremental lift as the treated-vs-holdout difference in the change from
each venue's own pre-period average to its campaign-window average (an
ANCOVA-style estimator: removes venue-level baseline noise, which is what
randomization does NOT remove on its own).

Output: rct_effects.csv — one row per venue_type with point estimate, 95% CI,
p-value, and the recovered-vs-true-effect comparison. This is the
high-confidence anchor used later to calibrate the MMM.
"""

import json
import os

import numpy as np
import pandas as pd
from scipy import stats

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUT_TABLES = os.path.join(BASE_DIR, "outputs", "tables")
OUT_FIGS = os.path.join(BASE_DIR, "outputs", "figures")
os.makedirs(OUT_TABLES, exist_ok=True)
os.makedirs(OUT_FIGS, exist_ok=True)


def load_data():
    venues = pd.read_csv(os.path.join(DATA_DIR, "venues.csv"))
    panel = pd.read_csv(os.path.join(DATA_DIR, "weekly_panel.csv"))
    with open(os.path.join(DATA_DIR, "ground_truth.json")) as f:
        gt = json.load(f)
    return venues, panel, gt


def balance_check(venues):
    """Table 1: compare treated vs holdout on pre-treatment covariates,
    per venue_type. All of these covariates are fixed venue attributes
    (not affected by treatment), so any assignment-related difference here
    would flag a broken randomization."""
    covariates = ["baseline_level", "dwell_time_min", "screen_count", "audience_quality"]
    rct = venues[venues["pool"] == "rct"]

    rows = []
    for vtype, g in rct.groupby("venue_type"):
        treated = g[g["rct_arm"] == "treated"]
        holdout = g[g["rct_arm"] == "holdout"]
        for cov in covariates:
            t_stat, p_val = stats.ttest_ind(
                treated[cov].dropna(), holdout[cov].dropna(), equal_var=False
            )
            rows.append(
                dict(
                    venue_type=vtype,
                    covariate=cov,
                    treated_mean=treated[cov].mean(),
                    holdout_mean=holdout[cov].mean(),
                    p_value=p_val,
                    n_treated=len(treated),
                    n_holdout=len(holdout),
                )
            )
    balance = pd.DataFrame(rows)
    n_sig = (balance["p_value"] <= 0.05).sum()
    print(f"[balance check] {n_sig}/{len(balance)} covariate x venue_type tests significant at p<=0.05 "
          f"(chance alone predicts ~{0.05*len(balance):.1f}) -> "
          f"{'CONSISTENT with successful randomization' if n_sig <= max(1, round(0.05*len(balance))+1) else 'INVESTIGATE randomization'}")
    return balance


def estimate_rct_effects(venues, panel, gt):
    n_pre = gt["n_weeks_pre"]
    start_off = gt["rct_campaign_start_week_offset"]
    n_camp_weeks = gt["rct_campaign_weeks"]
    camp_week_lo = n_pre + start_off
    camp_week_hi = n_pre + start_off + n_camp_weeks  # exclusive

    rct_venues = venues[venues["pool"] == "rct"][["venue_id", "venue_type", "rct_arm"]]
    p = panel.merge(rct_venues, on="venue_id", suffixes=("", "_v"))
    p = p[p["pool"] == "rct"]

    pre = p[p["week"] < n_pre].groupby("venue_id")["foot_traffic"].mean().rename("pre_avg")
    camp = (
        p[(p["week"] >= camp_week_lo) & (p["week"] < camp_week_hi)]
        .groupby("venue_id")["foot_traffic"].mean().rename("camp_avg")
    )
    true_lift_camp = (
        p[(p["week"] >= camp_week_lo) & (p["week"] < camp_week_hi)]
        .groupby("venue_id")["true_incremental_lift"].mean().rename("true_lift_avg")
    )

    venue_level = rct_venues.set_index("venue_id").join([pre, camp, true_lift_camp])
    venue_level["delta"] = venue_level["camp_avg"] - venue_level["pre_avg"]

    rows = []
    for vtype, g in venue_level.groupby("venue_type"):
        treated = g[g["rct_arm"] == "treated"]["delta"].dropna()
        holdout = g[g["rct_arm"] == "holdout"]["delta"].dropna()
        t_stat, p_val = stats.ttest_ind(treated, holdout, equal_var=False)
        effect = treated.mean() - holdout.mean()
        se = np.sqrt(treated.var(ddof=1) / len(treated) + holdout.var(ddof=1) / len(holdout))
        ci_lo, ci_hi = effect - 1.96 * se, effect + 1.96 * se

        true_effect = g[g["rct_arm"] == "treated"]["true_lift_avg"].mean()

        rows.append(
            dict(
                venue_type=vtype,
                method="RCT_geo_holdout",
                confidence="high",
                n_treated=len(treated),
                n_holdout=len(holdout),
                estimated_lift=effect,
                ci_low=ci_lo,
                ci_high=ci_hi,
                p_value=p_val,
                true_lift_ground_truth=true_effect,
                recovery_error=effect - true_effect,
            )
        )
    return pd.DataFrame(rows)


def main():
    venues, panel, gt = load_data()

    balance = balance_check(venues)
    balance.to_csv(os.path.join(OUT_TABLES, "rct_balance_check.csv"), index=False)

    effects = estimate_rct_effects(venues, panel, gt)
    effects.to_csv(os.path.join(OUT_TABLES, "rct_effects.csv"), index=False)

    print("\n=== RCT geo-holdout effect estimates (high confidence) ===")
    print(effects[["venue_type", "estimated_lift", "ci_low", "ci_high", "p_value",
                    "true_lift_ground_truth", "recovery_error"]].to_string(index=False))


if __name__ == "__main__":
    main()
