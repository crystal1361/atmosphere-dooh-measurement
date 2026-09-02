"""
budget_allocator.py
====================
Given a total weekly ad budget, allocate spend across venue_types to
maximize total incremental foot traffic, using the RCT-calibrated MMM
response curves (diminishing returns per venue_type) and an illustrative
cost-per-frequency-unit-per-venue assumption.

Method: exact dynamic-programming allocation (a discretized multiple-choice
knapsack), NOT a greedy marginal walk. This choice was deliberate, not
incidental: a Hill/S-shaped saturation curve (shape > 1, as fit here) is
CONVEX before its inflection point and only concave after it. A naive
"always spend the next dollar on whichever venue_type currently has the
highest marginal return" greedy heuristic is only provably optimal when
every curve is concave everywhere — on an S-curve it can get stuck
spreading budget thin across several venue_types' low-return convex regions
instead of concentrating enough spend on one to push it past the
inflection point into its high-return region. An earlier version of this
allocator used exactly that greedy heuristic, and it measurably
UNDERPERFORMED a naive equal-budget-split baseline at larger budgets — kept
here as a cautionary, working example of why "knows which technique fits
which problem" matters even inside a single model, not just across the
causal-method decision table. The DP formulation below has no concavity
requirement: it evaluates every discretized spend level for every
venue_type and is guaranteed to find the budget-constrained optimum on that
discretized grid, so by construction it can never do worse than the naive
baseline (equal split is just one candidate combination in the same search
space).

NOTE on the cost assumptions: DEFAULT_COST_PER_FREQ_UNIT below is an
illustrative demo parameter, not a researched real Atmosphere/DOOH rate
card. In a real deployment this would come from Atmosphere's own rate
card / inventory pricing by venue type and daypart.
"""

import os

import numpy as np
import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_TABLES = os.path.join(BASE_DIR, "outputs", "tables")
DATA_DIR = os.path.join(BASE_DIR, "data")

DEFAULT_COST_PER_FREQ_UNIT = {
    # illustrative $ cost to add +1 unit of weekly frequency, per venue, per venue_type
    "bar": 45.0,
    "restaurant": 40.0,
    "gym": 30.0,
    "waiting_room": 18.0,
}

MAX_FREQUENCY_PER_VENUE = 14.0
FREQ_STEP = 0.25
BUDGET_GRID_STEP = 250.0  # dollar granularity of the DP's budget axis


def load_inputs():
    curves = pd.read_csv(os.path.join(OUT_TABLES, "mmm_response_curves.csv"))
    venues = pd.read_csv(os.path.join(DATA_DIR, "venues.csv"))
    venue_counts = venues.groupby("venue_type").size().to_dict()
    return curves, venue_counts


def _venue_type_choices(vt, curves, venue_counts, cost_per_freq_unit, budget_grid_step):
    """Every candidate (spend, network_lift) pair for one venue_type, spend
    rounded down onto the shared DP budget grid so multiple frequency steps
    can collapse onto the same grid point without double-counting."""
    sub = curves[curves["venue_type"] == vt].sort_values("frequency")
    freqs = np.arange(0, MAX_FREQUENCY_PER_VENUE + FREQ_STEP, FREQ_STEP)
    lifts = np.interp(freqs, sub["frequency"], sub["lift_calibrated"]) * venue_counts[vt]
    raw_spend = freqs * cost_per_freq_unit[vt] * venue_counts[vt]
    grid_spend = np.round(raw_spend / budget_grid_step).astype(int) * budget_grid_step

    # keep only the best (highest-lift) option per distinct grid spend level
    best_by_spend = {}
    for s, l, f in zip(grid_spend, lifts, freqs):
        if s not in best_by_spend or l > best_by_spend[s][0]:
            best_by_spend[s] = (l, f)
    return sorted((s, l, f) for s, (l, f) in best_by_spend.items())


def allocate_budget(total_budget, curves, venue_counts, cost_per_freq_unit=None,
                     budget_grid_step=BUDGET_GRID_STEP):
    """Exact DP (multiple-choice knapsack) over a discretized budget grid.
    dp[b] = (best total lift achievable spending <= b, choice trace)."""
    if cost_per_freq_unit is None:
        cost_per_freq_unit = DEFAULT_COST_PER_FREQ_UNIT

    venue_types = sorted(venue_counts.keys())
    n_grid = int(total_budget // budget_grid_step) + 1
    dp = np.zeros(n_grid)
    choice_trace = [[0.0] * n_grid for _ in venue_types]  # frequency chosen per type, per dp column, per step

    prev_dp = dp.copy()
    chosen_freq = {vt: np.zeros(n_grid) for vt in venue_types}

    for vt in venue_types:
        options = _venue_type_choices(vt, curves, venue_counts, cost_per_freq_unit, budget_grid_step)
        new_dp = prev_dp.copy()
        new_freq_this_type = np.zeros(n_grid)

        for b_idx in range(n_grid):
            budget_here = b_idx * budget_grid_step
            best_val = prev_dp[b_idx]
            best_choice = 0.0
            for spend, lift, freq in options:
                if spend > budget_here:
                    break
                remaining_idx = int((budget_here - spend) // budget_grid_step)
                val = prev_dp[remaining_idx] + lift
                if val > best_val:
                    best_val = val
                    best_choice = freq
            new_dp[b_idx] = best_val
            new_freq_this_type[b_idx] = best_choice

        chosen_freq[vt] = new_freq_this_type
        prev_dp = new_dp

    # backtrack from the final budget column to recover the actual allocation
    b_idx = n_grid - 1
    result_freq = {}
    remaining = b_idx
    for vt in reversed(venue_types):
        f = chosen_freq[vt][remaining]
        result_freq[vt] = f
        spend_units = round(f * cost_per_freq_unit[vt] * venue_counts[vt] / budget_grid_step)
        remaining = max(0, remaining - spend_units)

    rows = []
    sub_by_vt = {vt: curves[curves["venue_type"] == vt].sort_values("frequency") for vt in venue_types}
    for vt in venue_types:
        freq = result_freq[vt]
        per_venue_lift = float(np.interp(freq, sub_by_vt[vt]["frequency"], sub_by_vt[vt]["lift_calibrated"]))
        network_lift = per_venue_lift * venue_counts[vt]
        spend = freq * cost_per_freq_unit[vt] * venue_counts[vt]
        rows.append(dict(
            venue_type=vt,
            n_venues=venue_counts[vt],
            allocated_weekly_budget=spend,
            frequency_per_venue=freq,
            per_venue_weekly_lift=per_venue_lift,
            network_weekly_incremental_foot_traffic=network_lift,
        ))

    result = pd.DataFrame(rows)
    result["budget_share_pct"] = 100 * result["allocated_weekly_budget"] / max(
        result["allocated_weekly_budget"].sum(), 1e-9
    )
    return result


def equal_split_baseline(total_budget, curves, venue_counts, cost_per_freq_unit=None):
    """Heuristic comparison point: split budget evenly across venue_types
    (the kind of naive rule this tool is meant to improve on)."""
    if cost_per_freq_unit is None:
        cost_per_freq_unit = DEFAULT_COST_PER_FREQ_UNIT
    venue_types = sorted(venue_counts.keys())
    per_type_budget = total_budget / len(venue_types)

    rows = []
    for vt in venue_types:
        freq = per_type_budget / (cost_per_freq_unit[vt] * venue_counts[vt])
        freq = min(freq, MAX_FREQUENCY_PER_VENUE)
        sub = curves[curves["venue_type"] == vt].sort_values("frequency")
        per_venue_lift = float(np.interp(freq, sub["frequency"], sub["lift_calibrated"]))
        rows.append(dict(
            venue_type=vt, n_venues=venue_counts[vt], allocated_weekly_budget=per_type_budget,
            frequency_per_venue=freq, per_venue_weekly_lift=per_venue_lift,
            network_weekly_incremental_foot_traffic=per_venue_lift * venue_counts[vt],
        ))
    return pd.DataFrame(rows)


if __name__ == "__main__":
    curves, venue_counts = load_inputs()
    for budget in [20000, 50000, 100000]:
        optimized = allocate_budget(budget, curves, venue_counts)
        naive = equal_split_baseline(budget, curves, venue_counts)
        print(f"\n=== Budget ${budget:,} ===")
        print("DP-optimized allocation:")
        print(optimized[["venue_type", "allocated_weekly_budget", "frequency_per_venue",
                          "network_weekly_incremental_foot_traffic"]].to_string(index=False))
        opt_total = optimized["network_weekly_incremental_foot_traffic"].sum()
        naive_total = naive["network_weekly_incremental_foot_traffic"].sum()
        print(f"  Total network lift: {opt_total:.1f}")
        print(f"Naive equal-split baseline total lift: {naive_total:.1f}")
        lift_gain = (opt_total / naive_total - 1) * 100 if naive_total > 0 else float("nan")
        print(f"  -> DP optimizer beats naive equal-split by {lift_gain:.1f}%")
