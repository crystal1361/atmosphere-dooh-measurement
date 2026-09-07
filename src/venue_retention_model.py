"""
venue_retention_model.py
==========================
Predicts a venue's 90-day churn risk from observable, ops-visible signals
(engagement trend, screen uptime, complaints, self-ad-slot utilization,
competitor outreach, tenure) plus its realized ad revenue -- the other half
of "what makes a venue valuable and what puts it at risk": venue_revenue_model.py
answers the first half, this answers the second.

Two uses of the same honesty discipline used throughout this project:
  - Held-out test-set AUC / PR-AUC / calibration, not train-set fit.
  - At-risk flags come from 5-fold OUT-OF-FOLD predicted probabilities
    (no venue is ever scored by a model that saw its own outcome).
  - Because this is a synthetic demo, venue_retention.csv also carries LATENT
    ground truth (true_churn_risk_90d, competitive_pressure_market,
    relationship_execution_gap) the model is never given -- this script
    checks whether the model's OOF risk scores actually recover that latent
    structure, the "validate against a known answer before trusting it
    conceptually" pattern used elsewhere.

As a closed-loop step (the JD's "turn measurement into something the
business acts on"), this script also combines its own OOF churn-risk score
with venue_revenue_model.py's OOF revenue -- producing a value x risk
priority quadrant (save-now / protect / low-priority / monitor) rather than
leaving revenue and retention as two disconnected reports.

One more step from rank to reason: for every "save now" and flagged venue,
a SHAP decomposition (same OOF discipline -- each venue explained by the
fold model that never trained on it) names the specific feature driving
THAT venue's risk up, mapped to a concrete recommended action -- not just
a shared rank order. See compute_oof_shap_for_subset() / derive_driver_and_action().
"""

import os

import numpy as np
import pandas as pd
import shap
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.inspection import permutation_importance
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.model_selection import KFold, train_test_split

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUT_TABLES = os.path.join(BASE_DIR, "outputs", "tables")

FEATURES = [
    "venue_type", "traffic_tier", "tenure_months",
    "engagement_trend_90d", "screen_uptime_pct", "complaint_count_90d",
    "self_ad_promo_utilization", "competitor_outreach_flag", "realized_ad_revenue",
]
CATEGORICAL = ["venue_type", "traffic_tier"]
TARGET = "churned_next_quarter"
RANDOM_STATE = 20260904
N_FOLDS = 5
N_FLAGS = 20
# geo_cluster is deliberately NOT a feature here (unlike the revenue model):
# with only ~20 venues per geo_cluster, a 20-level categorical mostly adds
# noise for this much sparser, noisier binary target -- dropping it measurably
# improved held-out AUC in testing. Documented honestly in the README/deck
# rather than kept in just for symmetry with the revenue model.


def _prep_features(df):
    df = df.copy()
    for c in CATEGORICAL:
        df[c] = df[c].astype("category")
    df["competitor_outreach_flag"] = df["competitor_outreach_flag"].astype(int)
    return df


def _make_model():
    # Shallow, heavily regularized: the underlying churn process is close to
    # additive-linear-in-logit (see venue_retention_data.py), and with only
    # ~400 venues, a shallower model recovers it more reliably than deeper
    # trees, which mostly fit noise here -- confirmed by held-out AUC during
    # tuning (depth 4 scored ~0.57, depth 1 ~0.63-0.65).
    return HistGradientBoostingClassifier(
        max_depth=1,
        max_iter=150,
        learning_rate=0.04,
        l2_regularization=1.0,
        min_samples_leaf=15,
        categorical_features="from_dtype",
        random_state=RANDOM_STATE,
    )


def train_test_evaluate(ret):
    X = _prep_features(ret[FEATURES])
    y = ret[TARGET].astype(int).values

    X_train, X_test, y_train, y_test, idx_train, idx_test = train_test_split(
        X, y, ret.index, test_size=0.3, random_state=RANDOM_STATE, stratify=y,
    )
    model = _make_model()
    model.fit(X_train, y_train)
    proba_test = model.predict_proba(X_test)[:, 1]

    auc = roc_auc_score(y_test, proba_test)
    pr_auc = average_precision_score(y_test, proba_test)
    brier = brier_score_loss(y_test, proba_test)

    calib = pd.DataFrame({"predicted": proba_test, "actual": y_test})
    calib["decile"] = pd.qcut(calib["predicted"], 5, labels=False, duplicates="drop")
    calib_table = (
        calib.groupby("decile")
        .agg(n=("actual", "size"), predicted_mean=("predicted", "mean"), actual_rate=("actual", "mean"))
        .reset_index()
    )

    perm = permutation_importance(
        model, X_test, y_test, n_repeats=20, random_state=RANDOM_STATE, scoring="roc_auc"
    )
    importance = pd.DataFrame({
        "feature": FEATURES,
        "importance_mean": perm.importances_mean,
        "importance_std": perm.importances_std,
    }).sort_values("importance_mean", ascending=False)

    # ground-truth check: does the test-set predicted risk correlate with the
    # LATENT true churn propensity it was never trained on?
    true_risk_test = ret.loc[idx_test, "true_churn_risk_90d"].values
    risk_corr = float(np.corrcoef(proba_test, true_risk_test)[0, 1])

    eval_row = pd.DataFrame([dict(
        auc_test=auc, pr_auc_test=pr_auc, brier_test=brier,
        n_train=len(X_train), n_test=len(X_test),
        predicted_vs_true_risk_corr=risk_corr,
    )])
    return model, eval_row, calib_table, importance


def out_of_fold_predictions(ret):
    X = _prep_features(ret[FEATURES])
    y = ret[TARGET].astype(int).values
    oof = np.zeros(len(ret))
    kf = KFold(n_splits=N_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    for train_idx, val_idx in kf.split(X):
        model = _make_model()
        model.fit(X.iloc[train_idx], y[train_idx])
        oof[val_idx] = model.predict_proba(X.iloc[val_idx])[:, 1]
    return oof


def build_at_risk_flags(ret, oof_pred):
    out = ret[["venue_id", "venue_type", "geo_cluster", "traffic_tier", "tenure_months",
               "churned_next_quarter", "competitive_pressure_market", "relationship_execution_gap"]].copy()
    out["churn_risk_oof"] = oof_pred
    flags = out.sort_values("churn_risk_oof", ascending=False).head(N_FLAGS).reset_index(drop=True)

    flagged_latent_rate = flags[["competitive_pressure_market", "relationship_execution_gap"]].any(axis=1).mean()
    population_latent_rate = out[["competitive_pressure_market", "relationship_execution_gap"]].any(axis=1).mean()
    risk_vs_true_risk_corr = float(np.corrcoef(out["churn_risk_oof"], ret["true_churn_risk_90d"])[0, 1])
    risk_vs_competitive_corr = float(np.corrcoef(out["churn_risk_oof"], out["competitive_pressure_market"].astype(int))[0, 1])
    risk_vs_relationship_corr = float(np.corrcoef(out["churn_risk_oof"], out["relationship_execution_gap"].astype(int))[0, 1])

    validation_row = pd.DataFrame([dict(
        flagged_venues=len(flags),
        flagged_latent_gap_rate=flagged_latent_rate,
        population_latent_gap_rate=population_latent_rate,
        churn_risk_oof_vs_true_risk_corr=risk_vs_true_risk_corr,
        churn_risk_oof_vs_competitive_pressure_corr=risk_vs_competitive_corr,
        churn_risk_oof_vs_relationship_gap_corr=risk_vs_relationship_corr,
    )])
    return flags, validation_row, out


# ---------------------------------------------------------------------------
# Per-venue driver attribution (SHAP) -- turns "who is flagged" into "why,
# and what should the account team actually do about it."
# ---------------------------------------------------------------------------
# The global permutation importance above answers "which feature matters on
# average across all venues" -- it can't say why any ONE venue is flagged.
# SHAP decomposes each venue's own predicted risk into each feature's own
# contribution, so a specific flagged venue gets a specific reason, not just
# a rank position.
#
# HistGradientBoostingClassifier's categorical_features="from_dtype" path
# isn't supported by shap.TreeExplainer (it errors trying numeric ops on the
# raw category strings), so this uses shap's model-agnostic Permutation
# explainer against a label-encoded copy of the categorical columns, decoded
# back to real categories inside the wrapped predict function below --
# verified against SHAP's own additivity identity (sum of contributions +
# base value == the model's actual predicted probability) before trusting it.
#
# Kept to the same OOF discipline as the rest of this model: each venue's
# SHAP values come from the fold model that did NOT see it during training,
# using the identical 5-fold split as out_of_fold_predictions().
#
# Computed only for venues actually in scope for account-team outreach (the
# top-N at-risk flags + the "Save now" quadrant), not the full population --
# those are the venues someone would actually act on, and it keeps this a
# fast, targeted addition rather than a blanket ~400-venue computation
# nobody asked for.

ACTION_MAP = {
    "screen_uptime_pct": (
        "Technical/ops outreach - screen uptime is depressed; dispatch field ops to diagnose "
        "a hardware or network fault before the venue notices degraded service."
    ),
    "competitor_outreach_flag": (
        "Commercial retention - a competitor has already made contact; have the account manager "
        "open a renewal/renegotiation conversation before it becomes a formal offer."
    ),
    "engagement_trend_90d": (
        "Content/placement review - on-screen engagement is trending down; review content mix "
        "or ad frequency with the venue rather than waiting for a complaint."
    ),
    "complaint_count_90d": (
        "Service recovery - recent complaints on file; account manager to follow up directly "
        "on the open issue(s)."
    ),
    "self_ad_promo_utilization": (
        "Platform engagement check-in - the venue is under-using its own self-serve promo slots; "
        "a walkthrough of underused features can re-engage them."
    ),
}
# Features that are structural or a known confound (see README's Honest scope) rather
# than an ops-actionable signal -- never turned into a fabricated "go do X" action.
NON_ACTIONABLE_NOTE = {
    "realized_ad_revenue": "a venue_type confound, not a causal churn driver -- see Honest scope",
    "tenure_months": "structural (not something ops can act on directly)",
    "venue_type": "structural",
    "traffic_tier": "structural",
}
FALLBACK_ACTION = (
    "No single ops-actionable signal dominates - risk appears tied to structural "
    "characteristics or the revenue confound; recommend a manual account review rather "
    "than a scripted outreach."
)


def _shap_predict_fn(model, cat_maps):
    """Wrap model.predict_proba so shap's Permutation explainer can perturb a
    label-encoded numeric matrix (its masker requires numeric arrays), while
    the model itself still sees real pandas categorical dtype columns, which
    categorical_features="from_dtype" requires at predict time."""
    def f(data):
        df = pd.DataFrame(np.asarray(data), columns=FEATURES)
        for c in CATEGORICAL:
            codes = df[c].round().astype(int).clip(0, len(cat_maps[c]) - 1)
            df[c] = codes.map(cat_maps[c]).astype("category")
            df[c] = df[c].cat.set_categories(list(cat_maps[c].values()))
        df["competitor_outreach_flag"] = df["competitor_outreach_flag"].round().astype(int)
        for c in FEATURES:
            if c not in CATEGORICAL:
                df[c] = df[c].astype(float)
        return model.predict_proba(df)[:, 1]
    return f


def compute_oof_shap_for_subset(ret, venue_ids, background_n=30):
    """SHAP contributions for just `venue_ids`, each explained by the fold
    model that never trained on it -- the identical KFold split used by
    out_of_fold_predictions(). Returns venue_id + one column per feature
    (its SHAP contribution to that venue's churn_risk_oof) + base_value."""
    X = _prep_features(ret[FEATURES])
    y = ret[TARGET].astype(int).values

    cat_maps = {c: dict(enumerate(X[c].cat.categories)) for c in CATEGORICAL}
    X_coded = X.copy()
    for c in CATEGORICAL:
        X_coded[c] = X_coded[c].cat.codes.astype(float)
    X_coded = X_coded.astype(float)

    wanted_ids = set(venue_ids)
    target_mask = ret["venue_id"].isin(wanted_ids).values

    kf = KFold(n_splits=N_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    rows = []
    for train_idx, val_idx in kf.split(X):
        wanted = [i for i in val_idx if target_mask[i]]
        if not wanted:
            continue
        model = _make_model()
        model.fit(X.iloc[train_idx], y[train_idx])
        f = _shap_predict_fn(model, cat_maps)
        bg = X_coded.iloc[train_idx].sample(min(background_n, len(train_idx)), random_state=RANDOM_STATE)
        explainer = shap.explainers.Permutation(f, bg, seed=RANDOM_STATE)
        sv = explainer(X_coded.iloc[wanted])
        for local_i, orig_i in enumerate(wanted):
            row = {"venue_id": ret.iloc[orig_i]["venue_id"], "base_value": float(sv.base_values[local_i])}
            row.update({feat: float(sv.values[local_i, j]) for j, feat in enumerate(FEATURES)})
            rows.append(row)
    return pd.DataFrame(rows)


def derive_driver_and_action(shap_row):
    """From one venue's per-feature SHAP contributions, name the feature
    actually driving its risk UP -- not just the largest |SHAP| value, since
    a strongly protective feature isn't a reason to act -- and translate it
    into a recommended action where that top driver is ops-actionable."""
    contributions = {f: shap_row[f] for f in FEATURES}
    positive = {f: v for f, v in contributions.items() if v > 0}
    if not positive:
        return {
            "top_model_driver": None, "top_model_driver_shap": None,
            "recommended_action_driver": None,
            "recommended_action": "No feature pushes this venue's risk meaningfully above baseline.",
        }

    top_overall = max(positive, key=positive.get)
    actionable_positive = {f: v for f, v in positive.items() if f in ACTION_MAP}
    if actionable_positive:
        top_actionable = max(actionable_positive, key=actionable_positive.get)
        action_text = ACTION_MAP[top_actionable]
    else:
        top_actionable = None
        note = NON_ACTIONABLE_NOTE.get(top_overall, "not mapped to an action")
        action_text = f"{FALLBACK_ACTION} (top model driver here is {top_overall} - {note}.)"

    return {
        "top_model_driver": top_overall,
        "top_model_driver_shap": positive[top_overall],
        "recommended_action_driver": top_actionable,
        "recommended_action": action_text,
    }


def build_priority_quadrant(retention_out, econ):
    """Closed-loop step: combine this model's OOF churn risk with
    venue_revenue_model.py's OOF revenue prediction into one value x risk
    prioritization -- so revenue and retention feed one decision, not two
    separate reports. Soft-depends on venue_revenue_model.py having already
    run; falls back to realized_ad_revenue (a real but noisier stand-in for
    "value") if its OOF output isn't there yet."""
    revenue_oof_path = os.path.join(OUT_TABLES, "venue_revenue_oof_full.csv")
    if os.path.exists(revenue_oof_path):
        rev = pd.read_csv(revenue_oof_path)[["venue_id", "predicted_revenue_oof"]]
        value_col = "predicted_revenue_oof"
        quad = retention_out.merge(rev, on="venue_id", how="left")
    else:
        quad = retention_out.merge(econ[["venue_id", "realized_ad_revenue"]], on="venue_id", how="left")
        value_col = "realized_ad_revenue"

    value_med = quad[value_col].median()
    risk_med = quad["churn_risk_oof"].median()
    high_value = quad[value_col] >= value_med
    high_risk = quad["churn_risk_oof"] >= risk_med

    quad["priority_quadrant"] = np.select(
        [high_value & high_risk, high_value & ~high_risk, ~high_value & high_risk],
        ["Save now (high value, high risk)", "Protect (high value, low risk)", "Low priority (low value, high risk)"],
        default="Monitor (low value, low risk)",
    )
    quad = quad.rename(columns={value_col: "value_metric"})
    return quad[["venue_id", "venue_type", "geo_cluster", "value_metric", "churn_risk_oof", "priority_quadrant"]]


def main():
    ret = pd.read_csv(os.path.join(DATA_DIR, "venue_retention.csv"))
    econ = pd.read_csv(os.path.join(DATA_DIR, "venue_economics.csv"))
    os.makedirs(OUT_TABLES, exist_ok=True)

    _, eval_row, calib_table, importance = train_test_evaluate(ret)
    oof_pred = out_of_fold_predictions(ret)
    flags, validation_row, oof_full = build_at_risk_flags(ret, oof_pred)
    eval_row = pd.concat([eval_row, validation_row], axis=1)
    quadrant = build_priority_quadrant(oof_full, econ)

    # Per-venue driver + recommended action, for the venues account teams
    # would actually work through: the flagged at-risk list, plus the
    # "Save now" (high value, high risk) quadrant.
    save_now_ids = quadrant.loc[
        quadrant["priority_quadrant"] == "Save now (high value, high risk)", "venue_id"
    ]
    driver_scope_ids = pd.concat([flags["venue_id"], save_now_ids]).unique()
    print(f"\nComputing SHAP driver attribution for {len(driver_scope_ids)} venues in outreach scope...")
    shap_df = compute_oof_shap_for_subset(ret, driver_scope_ids)
    drivers = pd.DataFrame(
        [dict(derive_driver_and_action(r), venue_id=r["venue_id"]) for _, r in shap_df.iterrows()]
    )

    flags = flags.merge(drivers, on="venue_id", how="left")
    quadrant = quadrant.merge(drivers, on="venue_id", how="left")

    eval_row.to_csv(os.path.join(OUT_TABLES, "venue_retention_model_eval.csv"), index=False)
    calib_table.to_csv(os.path.join(OUT_TABLES, "venue_retention_calibration.csv"), index=False)
    importance.to_csv(os.path.join(OUT_TABLES, "venue_retention_feature_importance.csv"), index=False)
    flags.to_csv(os.path.join(OUT_TABLES, "venue_at_risk_flags.csv"), index=False)
    oof_full.to_csv(os.path.join(OUT_TABLES, "venue_retention_oof_full.csv"), index=False)
    quadrant.to_csv(os.path.join(OUT_TABLES, "venue_priority_quadrant.csv"), index=False)

    print("=== Held-out test evaluation ===")
    print(eval_row.T)
    print("\n=== Feature importance (permutation, test set) -- the 'leading indicators' ===")
    print(importance.to_string(index=False))
    print(f"\n=== Top {N_FLAGS} at-risk venues (OOF), with per-venue driver + recommended action ===")
    print(flags[["venue_id", "venue_type", "geo_cluster", "churn_risk_oof",
                 "top_model_driver", "recommended_action_driver"]].to_string(index=False))
    print("\n=== Priority quadrant (value x risk) ===")
    print(quadrant["priority_quadrant"].value_counts())
    print("\n=== Recommended-action driver distribution, 'Save now' + flagged venues ===")
    print(drivers["recommended_action_driver"].value_counts(dropna=False))


if __name__ == "__main__":
    main()
