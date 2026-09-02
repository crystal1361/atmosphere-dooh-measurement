"""
data_generation.py
===================
Synthetic data generator for the Atmosphere TV DOOH Venue Incrementality &
Media-Mix Measurement demo project.

IMPORTANT — this is entirely synthetic demo data with a KNOWN, injected
ground-truth effect. The point of injecting a known answer is to be able to
validate, before trusting them conceptually, that the causal designs used
downstream (RCT geo-holdout, synthetic control) and the media-mix model
actually recover it. It is not a claim about any real company's data.

Business scenario
------------------
Atmosphere TV runs ambient screens in venues (restaurants, gyms, bars,
waiting rooms). Advertisers run campaigns that get played on a subset of
venues at a given weekly frequency. We want to measure the TRUE incremental
lift in venue foot traffic caused by ad exposure, net of baseline trend,
seasonality, and each venue's own idiosyncratic pattern.

Two assignment regimes are generated on purpose:

1. RCT_POOL: a subset of venues Atmosphere uses for a designed measurement
   product. Within venue_type x geo_cluster x baseline-traffic-tier strata,
   venues are RANDOMLY split into "treated" (gets a fixed benchmark
   campaign) vs "holdout" (gets nothing) for a defined window. This gives a
   clean, directly-verifiable (via covariate balance) causal read.

2. OBS_POOL: the rest of the network, running real historical advertiser
   campaigns. Advertisers do NOT pick venues at random — they preferentially
   activate venues with higher baseline foot traffic (a real selection
   mechanism), and exposure frequency varies venue-to-venue and week-to-week
   (needed variation for MMM adstock/saturation fitting). A naive
   before/after or treated-vs-untreated comparison on this pool is
   confounded by that selection.

Ground truth
------------
True incremental lift is a function of adstocked, saturating ad exposure,
with venue_type-specific decay (adstock) and saturation parameters, plus a
venue_type-specific maximum effect size. All of this is stored in
ground_truth.json so downstream analysis scripts can be scored against it.
"""

import json
import os

import numpy as np
import pandas as pd

RNG_SEED = 20260902
rng = np.random.default_rng(RNG_SEED)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

VENUE_TYPES = ["restaurant", "gym", "bar", "waiting_room"]
N_VENUES_PER_TYPE = 100
N_GEO_CLUSTERS = 20  # proxy for DMA / zip-cluster
N_WEEKS_PRE = 52     # pre-period, no campaigns anywhere (used for pre-trend / placebo)
N_WEEKS_CAMPAIGN = 52  # campaign period
N_WEEKS = N_WEEKS_PRE + N_WEEKS_CAMPAIGN

RCT_POOL_SHARE = 0.30      # share of venues (within stratum) reserved for the designed RCT
RCT_TREATED_SHARE = 0.50   # within the RCT pool, share that gets the benchmark campaign

# venue_type-specific ground truth: max weekly incremental lift (in foot-traffic
# units), adstock decay (share of last week's adstocked exposure carried over),
# and Hill-saturation half-max point (frequency at which lift = 50% of max) and
# shape parameter.
GROUND_TRUTH_PARAMS = {
    "restaurant":   {"max_lift": 18.0, "adstock_decay": 0.35, "sat_half": 5.0, "sat_shape": 2.0},
    "gym":          {"max_lift": 14.0, "adstock_decay": 0.55, "sat_half": 7.0, "sat_shape": 2.2},
    "bar":          {"max_lift": 22.0, "adstock_decay": 0.20, "sat_half": 4.0, "sat_shape": 1.8},
    "waiting_room": {"max_lift": 9.0,  "adstock_decay": 0.45, "sat_half": 4.0, "sat_shape": 2.5},
}

# venue_type-specific baseline weekly foot traffic (mean, sd across venues)
BASELINE_PARAMS = {
    "restaurant":   {"mean": 420, "sd": 90},
    "gym":          {"mean": 260, "sd": 60},
    "bar":          {"mean": 310, "sd": 80},
    "waiting_room": {"mean": 150, "sd": 40},
}

NOISE_SD_FRAC = 0.06  # weekly observation noise as a fraction of a venue's baseline level


def hill_saturation(x, half, shape):
    x = np.maximum(x, 0.0)
    return (x ** shape) / (x ** shape + half ** shape)


def build_venues():
    rows = []
    venue_id = 0
    for vtype in VENUE_TYPES:
        bp = BASELINE_PARAMS[vtype]
        for _ in range(N_VENUES_PER_TYPE):
            geo_cluster = rng.integers(0, N_GEO_CLUSTERS)
            baseline_level = max(30.0, rng.normal(bp["mean"], bp["sd"]))
            # illustrative descriptive attributes (Media Effectiveness section) —
            # NOT used by any causal or MMM estimator, purely for the dashboard's
            # business-context view. Flagged in the README as demo parameters.
            dwell_time_min = {
                "restaurant": rng.normal(38, 8),
                "gym": rng.normal(52, 12),
                "bar": rng.normal(70, 15),
                "waiting_room": rng.normal(22, 6),
            }[vtype]
            screen_count = rng.integers(1, 4)
            audience_quality = np.clip(rng.normal(0.6, 0.15), 0.1, 0.95)

            rows.append(
                dict(
                    venue_id=venue_id,
                    venue_type=vtype,
                    geo_cluster=int(geo_cluster),
                    baseline_level=baseline_level,
                    dwell_time_min=max(5.0, dwell_time_min),
                    screen_count=int(screen_count),
                    audience_quality=audience_quality,
                )
            )
            venue_id += 1
    venues = pd.DataFrame(rows)

    # baseline traffic tier (for RCT stratification), computed within venue_type
    venues["traffic_tier"] = (
        venues.groupby("venue_type")["baseline_level"]
        .transform(lambda s: pd.qcut(s, 2, labels=["low", "high"]))
    )
    return venues


def assign_pools_and_arms(venues):
    """Randomly assign RCT vs observational pool, and RCT treated/holdout arm,
    stratified by venue_type x geo_cluster x traffic_tier."""
    venues = venues.copy()
    venues["pool"] = "obs"
    venues["rct_arm"] = "n/a"

    for (_vtype, _geo, _tier), idx in venues.groupby(
        ["venue_type", "geo_cluster", "traffic_tier"], observed=True
    ).groups.items():
        idx = list(idx)
        if len(idx) < 2:
            continue  # too small a stratum to split meaningfully
        rng.shuffle(idx)
        n_rct = max(0, round(len(idx) * RCT_POOL_SHARE))
        rct_idx = idx[:n_rct]
        if rct_idx:
            venues.loc[rct_idx, "pool"] = "rct"
            n_treated = max(1, round(len(rct_idx) * RCT_TREATED_SHARE)) if len(rct_idx) > 1 else (
                1 if rng.random() < RCT_TREATED_SHARE else 0
            )
            treated_idx = rct_idx[:n_treated]
            holdout_idx = rct_idx[n_treated:]
            venues.loc[treated_idx, "rct_arm"] = "treated"
            venues.loc[holdout_idx, "rct_arm"] = "holdout"

    return venues


def assign_obs_pool_exposure(venues, n_weeks_campaign):
    """For the observational pool: advertiser activation probability increases
    with baseline traffic (the real, non-random selection mechanism), and
    weekly exposure frequency (plays/day-equivalent) varies to give the MMM
    variation to fit adstock/saturation on."""
    obs = venues[venues["pool"] == "obs"].copy()

    # activation probability: higher for higher-baseline venues (selection bias)
    z = (obs["baseline_level"] - obs["baseline_level"].mean()) / obs["baseline_level"].std()
    activation_p = 1 / (1 + np.exp(-(0.9 * z - 0.2)))
    obs["activated"] = rng.random(len(obs)) < activation_p

    # for activated venues, campaign start week (within the campaign period) and
    # a venue-level average frequency (weekly, arbitrary units), which then
    # gets weekly multiplicative noise
    obs["campaign_start_week"] = rng.integers(0, max(1, n_weeks_campaign - 12), size=len(obs))
    obs["base_frequency"] = np.where(
        obs["activated"], np.clip(rng.normal(6.0, 2.5, size=len(obs)), 0.5, 14.0), 0.0
    )
    return obs[["venue_id", "activated", "campaign_start_week", "base_frequency"]]


def simulate_panel(venues):
    obs_exposure = assign_obs_pool_exposure(venues, N_WEEKS_CAMPAIGN)
    obs_exposure_map = obs_exposure.set_index("venue_id").to_dict("index")

    # RCT arm gets a fixed benchmark campaign at a fixed frequency for a fixed
    # window, identical across all treated RCT venues so the design stays clean
    RCT_CAMPAIGN_START = 8   # week offset within the campaign period
    RCT_CAMPAIGN_WEEKS = 10
    RCT_FREQUENCY = 6.0

    records = []
    # adstock carryover state per venue
    adstock_state = {vid: 0.0 for vid in venues["venue_id"]}

    for week in range(N_WEEKS):
        is_campaign_period = week >= N_WEEKS_PRE
        campaign_week = week - N_WEEKS_PRE  # 0-indexed within campaign period, negative in pre-period

        # smooth seasonality shared across all venues (e.g., holiday bump around
        # week ~45 and ~97) plus a mild common trend
        season = 10 * np.sin(2 * np.pi * week / 52 + 0.4) + 6 * np.exp(
            -((week % 52 - 46) ** 2) / (2 * 3.0 ** 2)
        )
        trend = 0.05 * week

        for _, v in venues.iterrows():
            vid = v["venue_id"]
            vtype = v["venue_type"]
            gt = GROUND_TRUTH_PARAMS[vtype]

            # ---- determine this week's raw ad frequency for this venue ----
            freq = 0.0
            arm = "n/a"
            if v["pool"] == "rct" and is_campaign_period:
                if RCT_CAMPAIGN_START <= campaign_week < RCT_CAMPAIGN_START + RCT_CAMPAIGN_WEEKS:
                    if v["rct_arm"] == "treated":
                        freq = RCT_FREQUENCY
                    arm = v["rct_arm"]
            elif v["pool"] == "obs" and is_campaign_period:
                oe = obs_exposure_map[vid]
                if oe["activated"] and campaign_week >= oe["campaign_start_week"]:
                    weeks_in = campaign_week - oe["campaign_start_week"]
                    if weeks_in < 16:  # campaigns run ~16 weeks
                        freq = max(0.0, rng.normal(oe["base_frequency"], 1.0))

            # ---- adstock carryover ----
            adstock_state[vid] = freq + gt["adstock_decay"] * adstock_state[vid]

            # ---- true incremental lift via saturation on adstocked exposure ----
            sat = hill_saturation(adstock_state[vid], gt["sat_half"], gt["sat_shape"])
            true_lift = gt["max_lift"] * sat

            venue_noise = rng.normal(0, NOISE_SD_FRAC * v["baseline_level"])
            geo_shock = rng.normal(0, 3.0)  # small common geo-week shock, not modeled downstream (realistic noise)

            foot_traffic = max(
                0.0, v["baseline_level"] + season + trend + true_lift + venue_noise + geo_shock
            )

            records.append(
                dict(
                    venue_id=vid,
                    week=week,
                    is_campaign_period=is_campaign_period,
                    pool=v["pool"],
                    rct_arm=arm,
                    ad_frequency=freq,
                    adstocked_exposure=adstock_state[vid],
                    true_incremental_lift=true_lift,
                    foot_traffic=foot_traffic,
                )
            )

    panel = pd.DataFrame(records)
    return panel


def main():
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
    os.makedirs(out_dir, exist_ok=True)

    venues = build_venues()
    venues = assign_pools_and_arms(venues)
    panel = simulate_panel(venues)

    venues.to_csv(os.path.join(out_dir, "venues.csv"), index=False)
    panel.to_csv(os.path.join(out_dir, "weekly_panel.csv"), index=False)

    ground_truth = {
        "rng_seed": RNG_SEED,
        "n_weeks_pre": N_WEEKS_PRE,
        "n_weeks_campaign": N_WEEKS_CAMPAIGN,
        "rct_campaign_start_week_offset": 8,
        "rct_campaign_weeks": 10,
        "rct_frequency": 6.0,
        "venue_type_params": GROUND_TRUTH_PARAMS,
        "note": (
            "Synthetic ground truth for validation only. true_incremental_lift in "
            "weekly_panel.csv is the exact answer each downstream causal/MMM method "
            "is being scored against; it would not be observable in a real deployment."
        ),
    }
    with open(os.path.join(out_dir, "ground_truth.json"), "w") as f:
        json.dump(ground_truth, f, indent=2)

    print(f"venues: {venues.shape}, panel: {panel.shape}")
    print(venues.groupby(["venue_type", "pool"]).size())
    print("\nRCT pool arm counts:")
    print(venues[venues.pool == "rct"].groupby(["venue_type", "rct_arm"]).size())
    print(f"\nWrote venues.csv, weekly_panel.csv, ground_truth.json to {out_dir}")


if __name__ == "__main__":
    main()
