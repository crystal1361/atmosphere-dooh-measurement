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
        v1, v2 = treated.var(ddof=1), holdout.var(ddof=1)
        n1, n2 = len(treated), len(holdout)
        se = np.sqrt(v1 / n1 + v2 / n2)
        # Welch-Satterthwaite df, matching the same unequal-variance t-distribution
        # that ttest_ind(equal_var=False) already uses for p_val -- a z-based CI
        # (1.96) would be narrower and inconsistent with that test's own reference
        # distribution, understating uncertainty at these small, unequal n (15-19/arm).
        df = (v1 / n1 + v2 / n2) ** 2 / ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1))
        t_crit = stats.t.ppf(0.975, df)
        ci_lo, ci_hi = effect - t_crit * se, effect + t_crit * se

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


def estimate_post_campaign_decay(venues, panel, gt):
    """Does the lift persist after the 10-week campaign ends, or does it evaporate?
    Same treated-vs-holdout contrast used for the headline effect, applied to three
    windows after the campaign instead of assuming the answer -- no new design, no
    new assumption, just the same causal comparison extended in time. Pooled across
    all four venue types (not split by type): splitting drops each arm to ~15-19
    venues, which is too small for a week-level estimate to clear its own noise."""
    n_pre = gt["n_weeks_pre"]
    start_off = gt["rct_campaign_start_week_offset"]
    n_camp_weeks = gt["rct_campaign_weeks"]
    camp_lo = n_pre + start_off
    camp_hi = camp_lo + n_camp_weeks  # exclusive

    rct_venues = venues[venues["pool"] == "rct"][["venue_id", "rct_arm"]].set_index("venue_id")
    pre = panel[panel["week"] < n_pre].groupby("venue_id")["foot_traffic"].mean().rename("pre_avg")
    last_week = int(panel["week"].max())

    windows = [
        ("during_campaign", camp_lo, camp_hi),
        ("weeks_0_10_after", camp_hi, camp_hi + 10),
        ("weeks_10_20_after", camp_hi + 10, camp_hi + 20),
        ("full_post_campaign", camp_hi, last_week + 1),
    ]
    rows = []
    for label, lo, hi in windows:
        w_avg = panel[(panel["week"] >= lo) & (panel["week"] < hi)].groupby("venue_id")["foot_traffic"].mean().rename("w_avg")
        joined = rct_venues.join([pre, w_avg])
        joined["delta"] = joined["w_avg"] - joined["pre_avg"]
        treated = joined[joined["rct_arm"] == "treated"]["delta"].dropna()
        holdout = joined[joined["rct_arm"] == "holdout"]["delta"].dropna()
        effect = treated.mean() - holdout.mean()
        v1, v2 = treated.var(ddof=1), holdout.var(ddof=1)
        n1, n2 = len(treated), len(holdout)
        se = np.sqrt(v1 / n1 + v2 / n2)
        t_stat, p_val = stats.ttest_ind(treated, holdout, equal_var=False)
        # Same Welch-Satterthwaite CI as estimate_rct_effects() -- matches the
        # unequal-variance t-distribution ttest_ind already uses for p_val.
        df = (v1 / n1 + v2 / n2) ** 2 / ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1))
        t_crit = stats.t.ppf(0.975, df)
        ci_lo, ci_hi = effect - t_crit * se, effect + t_crit * se
        rows.append(
            dict(
                window=label,
                week_start=lo,
                week_end=hi - 1,
                estimated_lift=effect,
                se=se,
                ci_low=ci_lo,
                ci_high=ci_hi,
                p_value=p_val,
                n_treated=n1,
                n_holdout=n2,
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

    decay = estimate_post_campaign_decay(venues, panel, gt)
    decay.to_csv(os.path.join(OUT_TABLES, "rct_post_campaign_decay.csv"), index=False)

    print("\n=== Does the lift persist after the campaign ends? (same RCT contrast, extended in time) ===")
    print(decay[["window", "week_start", "week_end", "estimated_lift", "se", "p_value"]].round(3).to_string(index=False))


if __name__ == "__main__":
    main()
