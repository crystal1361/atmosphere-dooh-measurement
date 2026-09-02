"""
venue_revenue_model.py
========================
Predicts a venue's realized weekly ad revenue from observable
characteristics (venue_type, geo_cluster, baseline traffic, screen count,
dwell time, audience quality, traffic tier) plus the RCT-calibrated
per-exposure lift (from the causal/MMM pipeline) as a feature. Two uses of
the same model:

  (a) EXISTING venues — an honest, out-of-fold predicted revenue for every
      venue lets us flag venues realizing meaningfully less than peers with
      similar characteristics ("under-monetized": pricing, fill rate, or
      advertiser-awareness gaps worth a sales/ops look).
  (b) PROSPECT venues — not yet in the network, no revenue history — score
      them on the same model, ranked for expansion/acquisition priority.

Model: gradient-boosted trees (HistGradientBoostingRegressor), which handles
venue_type / geo_cluster / traffic_tier as native categoricals without
one-hot blowing up geo_cluster into 20+ columns.

Honesty checks built in, same ground-truth-first pattern used throughout
this project:
  - Evaluation metrics (R^2, MAE, MAPE) come from a genuine held-out test
    split, not train-set fit.
  - Under-monetization flags come from 5-fold OUT-OF-FOLD predictions (every
    venue's flag uses a model that never saw that venue), not train
    residuals -- avoids the classic "flag the venues the model overfit to"
    failure mode.
  - Because this is a synthetic demo, venue_economics.csv also carries LATENT
    ground truth (true_ad_revenue_potential, monetization_efficiency,
    thin_coverage_market, individual_execution_gap) that the model is never
    given. This script checks whether the model's OOF predictions and flags
    actually recover that latent structure -- the same "validate against a
    known answer before trusting it conceptually" discipline as the causal
    methods elsewhere in this project.
"""

import os

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.inspection import permutation_importance
from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error, r2_score
from sklearn.model_selection import KFold, train_test_split

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUT_TABLES = os.path.join(BASE_DIR, "outputs", "tables")

FEATURES = [
    "venue_type", "geo_cluster", "traffic_tier", "baseline_level",
    "dwell_time_min", "screen_count", "audience_quality", "calibrated_lift_feature",
]
CATEGORICAL = ["venue_type", "geo_cluster", "traffic_tier"]
TARGET = "realized_ad_revenue"
RANDOM_STATE = 20260903
N_FOLDS = 5
N_FLAGS = 20


def _prep_features(df):
    df = df.copy()
    for c in CATEGORICAL:
        df[c] = df[c].astype("category")
    return df


def _make_model():
    return HistGradientBoostingRegressor(
        max_depth=4,
        max_iter=250,
        learning_rate=0.06,
        l2_regularization=0.5,
        categorical_features="from_dtype",
        random_state=RANDOM_STATE,
    )


def train_test_evaluate(econ):
    X = _prep_features(econ[FEATURES])
    y = econ[TARGET].values

    X_train, X_test, y_train, y_test, idx_train, idx_test = train_test_split(
        X, y, econ.index, test_size=0.3, random_state=RANDOM_STATE,
        stratify=econ["venue_type"],
    )
    model = _make_model()
    model.fit(X_train, y_train)
    pred_test = model.predict(X_test)

    r2 = r2_score(y_test, pred_test)
    mae = mean_absolute_error(y_test, pred_test)
    mape = mean_absolute_percentage_error(y_test, pred_test)

    # calibration by predicted-revenue decile on the held-out test set
    calib = pd.DataFrame({"predicted": pred_test, "actual": y_test})
    calib["decile"] = pd.qcut(calib["predicted"], 5, labels=False, duplicates="drop")
    calib_table = (
        calib.groupby("decile")
        .agg(n=("actual", "size"), predicted_mean=("predicted", "mean"), actual_mean=("actual", "mean"))
        .reset_index()
    )

    # permutation importance on the held-out test set (model-agnostic,
    # honest for categorical splits, unlike relying on gain-based importances)
    perm = permutation_importance(
        model, X_test, y_test, n_repeats=20, random_state=RANDOM_STATE, scoring="r2"
    )
    importance = pd.DataFrame({
        "feature": FEATURES,
        "importance_mean": perm.importances_mean,
        "importance_std": perm.importances_std,
    }).sort_values("importance_mean", ascending=False)

    # ground-truth check: does the trained model's test-set prediction rank
    # correlate with the LATENT true potential it was never trained on?
    potential_test = econ.loc[idx_test, "true_ad_revenue_potential"].values
    potential_corr = float(np.corrcoef(pred_test, potential_test)[0, 1])

    eval_row = pd.DataFrame([dict(
        r2_test=r2, mae_test=mae, mape_test=mape,
        n_train=len(X_train), n_test=len(X_test),
        predicted_vs_true_potential_corr=potential_corr,
    )])
    return model, eval_row, calib_table, importance


def out_of_fold_predictions(econ):
    """5-fold OOF predictions for every existing venue -- what powers the
    under-monetization flags. No venue is ever scored by a model that saw
    its own revenue."""
    X = _prep_features(econ[FEATURES])
    y = econ[TARGET].values
    oof = np.zeros(len(econ))
    kf = KFold(n_splits=N_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    for train_idx, val_idx in kf.split(X):
        model = _make_model()
        model.fit(X.iloc[train_idx], y[train_idx])
        oof[val_idx] = model.predict(X.iloc[val_idx])
    return oof


def build_underperformance_flags(econ, oof_pred):
    out = econ[["venue_id", "venue_type", "geo_cluster", "traffic_tier",
                "realized_ad_revenue", "thin_coverage_market", "individual_execution_gap",
                "monetization_efficiency"]].copy()
    out["predicted_revenue_oof"] = oof_pred
    out["gap_pct"] = 100 * (out["realized_ad_revenue"] - out["predicted_revenue_oof"]) / out["predicted_revenue_oof"].clip(lower=1e-6)
    flags = out.sort_values("gap_pct").head(N_FLAGS).reset_index(drop=True)

    # ground-truth check: do the flagged venues actually skew toward the
    # latent under-monetization mechanisms (they should, since that's
    # exactly what a negative gap_pct means by construction)?
    flagged_latent_rate = flags[["thin_coverage_market", "individual_execution_gap"]].any(axis=1).mean()
    population_latent_rate = out[["thin_coverage_market", "individual_execution_gap"]].any(axis=1).mean()
    gap_efficiency_corr = float(np.corrcoef(out["gap_pct"], out["monetization_efficiency"])[0, 1])
    # decomposition: geo_cluster is an observed feature, so a market-wide
    # thin-coverage effect should mostly get absorbed into the PREDICTION
    # itself (the model learns "that market runs low") rather than showing
    # up as individual residual -- low correlation here is the model working
    # correctly, not a miss. individual_execution_gap is venue-specific and
    # NOT observable from any feature, so it should show up more clearly in
    # the residual.
    gap_vs_thin_coverage_corr = float(np.corrcoef(
        out["gap_pct"], out["thin_coverage_market"].astype(int)
    )[0, 1])
    gap_vs_individual_gap_corr = float(np.corrcoef(
        out["gap_pct"], out["individual_execution_gap"].astype(int)
    )[0, 1])

    validation_row = pd.DataFrame([dict(
        flagged_venues=len(flags),
        flagged_latent_gap_rate=flagged_latent_rate,
        population_latent_gap_rate=population_latent_rate,
        gap_pct_vs_monetization_efficiency_corr=gap_efficiency_corr,
        gap_pct_vs_thin_coverage_market_corr=gap_vs_thin_coverage_corr,
        gap_pct_vs_individual_execution_gap_corr=gap_vs_individual_gap_corr,
    )])
    return flags, validation_row, out


def rank_prospects(econ, prospects):
    """Refit on ALL existing venues (standard practice once evaluation is
    done honestly above) to score never-before-seen prospect venues."""
    X_all = _prep_features(econ[FEATURES])
    y_all = econ[TARGET].values
    model = _make_model()
    model.fit(X_all, y_all)

    Xp = prospects[["venue_type", "geo_cluster", "baseline_level", "dwell_time_min",
                     "screen_count", "audience_quality", "calibrated_lift_feature"]].copy()
    # prospects in brand-new expansion geos have no traffic_tier (that's a
    # within-venue_type quantile computed on the EXISTING network) -- assign
    # from each prospect's baseline_level rank within its own venue_type pool
    # among prospects, same "low"/"high" vocabulary the model was trained on.
    Xp["traffic_tier"] = (
        prospects.groupby("venue_type")["baseline_level"]
        .transform(lambda s: pd.qcut(s, 2, labels=["low", "high"]))
    )
    for c in CATEGORICAL:
        Xp[c] = Xp[c].astype("category")
    Xp = Xp[FEATURES]

    prospects = prospects.copy()
    prospects["predicted_revenue"] = model.predict(Xp)
    prospects["rank_overall"] = prospects["predicted_revenue"].rank(ascending=False).astype(int)
    prospects["rank_within_type"] = (
        prospects.groupby("venue_type")["predicted_revenue"].rank(ascending=False).astype(int)
    )
    ranked = prospects.sort_values("predicted_revenue", ascending=False).reset_index(drop=True)

    # ground-truth check: does predicted revenue rank correlate with the
    # latent true potential these prospects were generated with?
    potential_corr = float(np.corrcoef(
        ranked["predicted_revenue"], ranked["true_ad_revenue_potential_prospect"]
    )[0, 1])
    return ranked, potential_corr


def main():
    econ = pd.read_csv(os.path.join(DATA_DIR, "venue_economics.csv"))
    prospects = pd.read_csv(os.path.join(DATA_DIR, "prospect_venues.csv"))
    os.makedirs(OUT_TABLES, exist_ok=True)

    _, eval_row, calib_table, importance = train_test_evaluate(econ)
    oof_pred = out_of_fold_predictions(econ)
    flags, validation_row, oof_full = build_underperformance_flags(econ, oof_pred)
    ranked_prospects, prospect_potential_corr = rank_prospects(econ, prospects)

    eval_row["prospect_predicted_vs_true_potential_corr"] = prospect_potential_corr
    eval_row = pd.concat([eval_row, validation_row], axis=1)

    eval_row.to_csv(os.path.join(OUT_TABLES, "venue_revenue_model_eval.csv"), index=False)
    calib_table.to_csv(os.path.join(OUT_TABLES, "venue_revenue_calibration.csv"), index=False)
    importance.to_csv(os.path.join(OUT_TABLES, "venue_revenue_feature_importance.csv"), index=False)
    flags.to_csv(os.path.join(OUT_TABLES, "venue_underperformance_flags.csv"), index=False)
    oof_full.to_csv(os.path.join(OUT_TABLES, "venue_revenue_oof_full.csv"), index=False)
    ranked_prospects.to_csv(os.path.join(OUT_TABLES, "prospect_ranking.csv"), index=False)

    print("=== Held-out test evaluation ===")
    print(eval_row.T)
    print("\n=== Feature importance (permutation, test set) ===")
    print(importance.to_string(index=False))
    print(f"\n=== Top {N_FLAGS} under-monetized venues (OOF) ===")
    print(flags[["venue_id", "venue_type", "geo_cluster", "gap_pct", "thin_coverage_market",
                 "individual_execution_gap"]].to_string(index=False))
    print("\n=== Top 10 prospect venues by predicted revenue ===")
    print(ranked_prospects.head(10)[["prospect_id", "venue_type", "geo_cluster",
                                       "in_expansion_market", "predicted_revenue"]].to_string(index=False))


if __name__ == "__main__":
    main()
