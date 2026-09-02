"""
streamlit_app.py
=================
Interactive dashboard for the Atmosphere TV DOOH Venue Incrementality &
Media-Mix Measurement demo project.

Run with:  streamlit run dashboard/streamlit_app.py
(run from the project root, or the relative paths below still resolve
 correctly either way since they're built off this file's own location)

All numbers on this page come from synthetic demo data with a known,
injected ground-truth effect — see src/data_generation.py and the project
README for the honest-scope notes (illustrative parameters, why MTA isn't
built, etc.).
"""

import os
import sys

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import streamlit as st

DASHBOARD_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(DASHBOARD_DIR)
SRC_DIR = os.path.join(BASE_DIR, "src")
DATA_DIR = os.path.join(BASE_DIR, "data")
OUT_TABLES = os.path.join(BASE_DIR, "outputs", "tables")

sys.path.append(SRC_DIR)
from budget_allocator import (  # noqa: E402
    DEFAULT_COST_PER_FREQ_UNIT,
    allocate_budget,
    equal_split_baseline,
)

st.set_page_config(page_title="Atmosphere TV — DOOH Measurement", layout="wide")

VENUE_TYPE_LABELS = {
    "restaurant": "Restaurants",
    "gym": "Gyms",
    "bar": "Bars",
    "waiting_room": "Waiting Rooms",
}
VENUE_COLORS = {
    "restaurant": "#4C72B0",
    "gym": "#55A868",
    "bar": "#C44E52",
    "waiting_room": "#8172B2",
}


@st.cache_data
def load_all():
    venues = pd.read_csv(os.path.join(DATA_DIR, "venues.csv"))
    rct = pd.read_csv(os.path.join(OUT_TABLES, "rct_effects.csv"))
    balance = pd.read_csv(os.path.join(OUT_TABLES, "rct_balance_check.csv"))
    sc = pd.read_csv(os.path.join(OUT_TABLES, "synthetic_control_effects.csv"))
    mmm_params = pd.read_csv(os.path.join(OUT_TABLES, "mmm_params.csv"))
    mmm_curves = pd.read_csv(os.path.join(OUT_TABLES, "mmm_response_curves.csv"))
    sc_curves = np.load(os.path.join(OUT_TABLES, "sc_example_curves.npy"), allow_pickle=True).item()
    return venues, rct, balance, sc, mmm_params, mmm_curves, sc_curves


venues, rct, balance, sc, mmm_params, mmm_curves, sc_curves = load_all()

st.title("Atmosphere TV — DOOH Venue Incrementality & Media-Mix Measurement")
st.caption(
    "Demo project built for interview preparation. All figures come from synthetic data "
    "with a known injected ground-truth effect, used to validate that each method below "
    "actually recovers it before trusting it conceptually."
)

tab_overview, tab_causal, tab_mmm, tab_budget = st.tabs(
    ["Overview", "Causal Measurement", "Media-Mix Model", "Budget Allocator"]
)

# ---------------------------------------------------------------------------
# TAB 1: Overview
# ---------------------------------------------------------------------------
with tab_overview:
    st.subheader("What this answers")
    col1, col2 = st.columns(2)
    with col1:
        st.markdown(
            "**Advertiser-facing (sell-side differentiator):**\n\n"
            "Did the campaign actually cause incremental foot traffic — net of "
            "seasonality, trend, and each venue's own baseline pattern? Isolating "
            "this incremental effect turns measurement into something Atmosphere's "
            "go-to-market team can take to market and clients can trust."
        )
    with col2:
        st.markdown(
            "**Media planning (budget allocation):**\n\n"
            "Given a fixed budget, how should it be split across venue types "
            "(restaurants / gyms / bars / waiting rooms) to maximize incremental "
            "foot traffic, accounting for each venue type's own diminishing-returns "
            "curve?"
        )

    st.divider()
    st.subheader("Design at a glance")
    st.markdown(
        "- **RCT geo-holdout** (high confidence): a subset of venues is randomly split "
        "into treated/holdout within venue_type x geo x traffic-tier strata. Randomization "
        "is verified directly with a pre-treatment covariate balance check, not assumed.\n"
        "- **Synthetic control** (moderate confidence): covers historical, non-randomized "
        "campaigns. A weighted combination of never-activated venues approximates each "
        "treated venue's counterfactual; validated with pre-period fit quality and an "
        "in-space placebo test (synthetic control has no closed-form standard error).\n"
        "- **Media-mix model**: adstock + saturation curves fit on the aggregate weekly "
        "exposure series, then *calibrated* against the RCT's high-confidence estimate — "
        "because a purely observational MMM fit is not causally identified on its own.\n"
        "- **Budget allocator**: an exact DP (multiple-choice knapsack) over the "
        "calibrated response curves — not a greedy walk, because these S-shaped curves "
        "are not globally concave and a greedy heuristic measurably underperformed a "
        "naive baseline in an earlier version of this tool."
    )

    st.divider()
    st.subheader("Honest scope notes")
    st.markdown(
        "- **Media-effectiveness figures** (dwell time, screen count, audience quality) "
        "shown around this dashboard are illustrative demo parameters, not researched real "
        "industry benchmarks. In a real deployment these would come from Nielsen OOH "
        "ratings, DSP data (e.g. Vistar), or Atmosphere's own play logs.\n"
        "- **Multi-touch attribution (MTA) was deliberately not built.** Atmosphere's "
        "ambient-screen exposure model has no individual-level, cross-venue touchpoint "
        "log by default — that would require purchased mobile location/device-matching "
        "data, which isn't assumed here. Rather than force a model onto a data structure "
        "that doesn't exist, this project scopes MTA out and names why."
    )

# ---------------------------------------------------------------------------
# TAB 2: Causal Measurement
# ---------------------------------------------------------------------------
with tab_causal:
    st.subheader("RCT geo-holdout — high confidence")
    n_sig = (balance["p_value"] <= 0.05).sum()
    st.caption(
        f"Pre-treatment covariate balance check: {n_sig}/{len(balance)} covariate x venue_type "
        f"tests significant at p<=0.05 (chance alone predicts ~{0.05*len(balance):.1f}) — "
        "consistent with randomization having worked as designed."
    )
    rct_display = rct.copy()
    rct_display["venue_type"] = rct_display["venue_type"].map(VENUE_TYPE_LABELS)
    st.dataframe(
        rct_display[["venue_type", "estimated_lift", "ci_low", "ci_high", "p_value",
                     "true_lift_ground_truth"]]
        .rename(columns={
            "venue_type": "Venue type", "estimated_lift": "Estimated lift",
            "ci_low": "95% CI low", "ci_high": "95% CI high", "p_value": "p-value",
            "true_lift_ground_truth": "True lift (ground truth)",
        })
        .style.format({"Estimated lift": "{:.1f}", "95% CI low": "{:.1f}", "95% CI high": "{:.1f}",
                        "p-value": "{:.4f}", "True lift (ground truth)": "{:.1f}"}),
        width='stretch',
    )

    fig, ax = plt.subplots(figsize=(7, 3.2))
    order = rct["venue_type"].tolist()
    y = np.arange(len(order))
    ax.errorbar(
        rct["estimated_lift"], y,
        xerr=[rct["estimated_lift"] - rct["ci_low"], rct["ci_high"] - rct["estimated_lift"]],
        fmt="o", color="#4C72B0", capsize=4, label="RCT estimate (95% CI)",
    )
    ax.scatter(rct["true_lift_ground_truth"], y, marker="x", color="#C44E52", s=80,
               label="True lift (ground truth)", zorder=5)
    ax.set_yticks(y)
    ax.set_yticklabels([VENUE_TYPE_LABELS[v] for v in order])
    ax.set_xlabel("Incremental weekly foot traffic")
    ax.legend(loc="lower right", fontsize=8)
    ax.set_title("RCT estimate vs. injected ground truth")
    st.pyplot(fig)

    st.divider()
    st.subheader("Synthetic control — moderate confidence")
    st.caption(
        "Covers historical, non-randomized campaigns. Confidence is lower because the "
        "identifying assumption (the donor pool approximates the counterfactual) can't be "
        "directly tested the way randomization can — only checked indirectly."
    )
    sc_display = sc.copy()
    sc_display["venue_type"] = sc_display["venue_type"].map(VENUE_TYPE_LABELS)
    st.dataframe(
        sc_display[["venue_type", "estimated_lift", "placebo_p_value", "avg_pre_period_rmspe",
                    "n_treated_flagged_poor_fit", "true_lift_ground_truth"]]
        .rename(columns={
            "venue_type": "Venue type", "estimated_lift": "Estimated lift",
            "placebo_p_value": "Placebo p-value", "avg_pre_period_rmspe": "Pre-period RMSPE",
            "n_treated_flagged_poor_fit": "Venues flagged (poor fit, excluded)",
            "true_lift_ground_truth": "True lift (ground truth)",
        })
        .style.format({"Estimated lift": "{:.1f}", "Placebo p-value": "{:.3f}",
                        "Pre-period RMSPE": "{:.1f}", "True lift (ground truth)": "{:.1f}"}),
        width='stretch',
    )

    example_vtype = st.selectbox(
        "Show an example venue's actual vs. synthetic-control trajectory:",
        options=list(sc_curves.keys()), format_func=lambda v: VENUE_TYPE_LABELS[v],
    )
    ex = sc_curves[example_vtype]
    fig2, ax2 = plt.subplots(figsize=(8, 3))
    ax2.plot(ex["week"], ex["actual"], label="Actual", color=VENUE_COLORS[example_vtype])
    ax2.plot(ex["week"], ex["synthetic"], label="Synthetic control", color="gray", linestyle="--")
    ax2.axvline(ex["start_week"], color="black", linestyle=":", linewidth=1, label="Campaign start")
    ax2.set_xlabel("Week")
    ax2.set_ylabel("Foot traffic")
    ax2.set_title(f"Example venue — {VENUE_TYPE_LABELS[example_vtype]}: actual vs. synthetic")
    ax2.legend(fontsize=8)
    st.pyplot(fig2)

# ---------------------------------------------------------------------------
# TAB 3: Media-Mix Model
# ---------------------------------------------------------------------------
with tab_mmm:
    st.subheader("Adstock + saturation, calibrated against the RCT")
    st.caption(
        "The naive MMM (fit purely on the aggregate observational series) is not causally "
        "identified on its own. Its coefficient is rescaled so its implied lift at the RCT's "
        "exposure level matches the RCT's high-confidence estimate; the fitted decay/shape — "
        "the curve's *shape* — is left as estimated from the richer aggregate series."
    )
    mmm_display = mmm_params.copy()
    mmm_display["venue_type"] = mmm_display["venue_type"].map(VENUE_TYPE_LABELS)
    st.dataframe(
        mmm_display[["venue_type", "fitted_decay", "fitted_half", "fitted_shape",
                     "beta_naive", "beta_calibrated", "calibration_adjustment_pct",
                     "true_max_lift_ground_truth"]]
        .rename(columns={
            "venue_type": "Venue type", "fitted_decay": "Adstock decay", "fitted_half": "Saturation half-point",
            "fitted_shape": "Saturation shape", "beta_naive": "Beta (naive)",
            "beta_calibrated": "Beta (RCT-calibrated)", "calibration_adjustment_pct": "Calibration adj. (%)",
            "true_max_lift_ground_truth": "True max lift (ground truth)",
        })
        .style.format({"Adstock decay": "{:.2f}", "Saturation half-point": "{:.1f}",
                        "Saturation shape": "{:.1f}", "Beta (naive)": "{:.1f}",
                        "Beta (RCT-calibrated)": "{:.1f}", "Calibration adj. (%)": "{:+.0f}%",
                        "True max lift (ground truth)": "{:.1f}"}),
        width='stretch',
    )

    fig3, axes = plt.subplots(1, 4, figsize=(16, 3.5), sharey=False)
    for ax, vt in zip(axes, sorted(mmm_curves["venue_type"].unique())):
        sub = mmm_curves[mmm_curves["venue_type"] == vt]
        ax.plot(sub["frequency"], sub["lift_naive"], label="Naive", color="gray", linestyle="--")
        ax.plot(sub["frequency"], sub["lift_calibrated"], label="RCT-calibrated", color=VENUE_COLORS[vt])
        ax.set_title(VENUE_TYPE_LABELS[vt], fontsize=10)
        ax.set_xlabel("Weekly frequency")
        if vt == sorted(mmm_curves["venue_type"].unique())[0]:
            ax.set_ylabel("Incremental lift")
        ax.legend(fontsize=7)
    fig3.suptitle("Response curves: naive vs. RCT-calibrated MMM", fontsize=11)
    fig3.tight_layout()
    st.pyplot(fig3)

# ---------------------------------------------------------------------------
# TAB 4: Budget Allocator
# ---------------------------------------------------------------------------
with tab_budget:
    st.subheader("Given a weekly budget, how should it be split across venue types?")
    st.caption(
        "Uses an exact DP (multiple-choice knapsack) over the RCT-calibrated response "
        "curves — chosen deliberately over a greedy marginal-value walk, which measurably "
        "underperformed a naive equal-split baseline on these non-concave (S-shaped) curves "
        "in an earlier version of this tool."
    )

    budget = st.slider("Total weekly budget ($)", min_value=5000, max_value=200000,
                        value=50000, step=5000)

    with st.expander("Illustrative cost-per-frequency-unit assumptions (editable)"):
        cost_inputs = {}
        cols = st.columns(4)
        for c, vt in zip(cols, sorted(DEFAULT_COST_PER_FREQ_UNIT.keys())):
            with c:
                cost_inputs[vt] = st.number_input(
                    f"{VENUE_TYPE_LABELS[vt]} ($/freq/venue)",
                    value=float(DEFAULT_COST_PER_FREQ_UNIT[vt]), min_value=1.0, step=1.0,
                )
        st.caption(
            "Illustrative demo parameters, not a researched real Atmosphere rate card — "
            "in reality these would come from Atmosphere's own inventory pricing by venue "
            "type and daypart."
        )

    venue_counts = venues.groupby("venue_type").size().to_dict()
    optimized = allocate_budget(budget, mmm_curves, venue_counts, cost_per_freq_unit=cost_inputs)
    naive = equal_split_baseline(budget, mmm_curves, venue_counts, cost_per_freq_unit=cost_inputs)

    opt_total = optimized["network_weekly_incremental_foot_traffic"].sum()
    naive_total = naive["network_weekly_incremental_foot_traffic"].sum()
    lift_gain = (opt_total / naive_total - 1) * 100 if naive_total > 0 else float("nan")

    m1, m2, m3 = st.columns(3)
    m1.metric("Optimized weekly incremental foot traffic", f"{opt_total:,.0f}")
    m2.metric("Naive equal-split baseline", f"{naive_total:,.0f}")
    m3.metric("Optimizer improvement", f"+{lift_gain:.1f}%")

    disp = optimized.copy()
    disp["venue_type"] = disp["venue_type"].map(VENUE_TYPE_LABELS)
    st.dataframe(
        disp[["venue_type", "allocated_weekly_budget", "budget_share_pct", "frequency_per_venue",
              "network_weekly_incremental_foot_traffic"]]
        .rename(columns={
            "venue_type": "Venue type", "allocated_weekly_budget": "Allocated budget ($)",
            "budget_share_pct": "Share (%)", "frequency_per_venue": "Frequency / venue",
            "network_weekly_incremental_foot_traffic": "Network incremental foot traffic",
        })
        .style.format({"Allocated budget ($)": "${:,.0f}", "Share (%)": "{:.1f}%",
                        "Frequency / venue": "{:.2f}", "Network incremental foot traffic": "{:,.0f}"}),
        width='stretch',
    )

    fig4, ax4 = plt.subplots(figsize=(7, 3))
    vt_order = optimized["venue_type"].tolist()
    ax4.bar([VENUE_TYPE_LABELS[v] for v in vt_order], optimized["allocated_weekly_budget"],
            color=[VENUE_COLORS[v] for v in vt_order])
    ax4.set_ylabel("Allocated weekly budget ($)")
    ax4.set_title(f"Optimized allocation of ${budget:,} across venue types")
    st.pyplot(fig4)
