"""Smoke test: SHAP TreeExplainer on the Random Forest demand model (notebook 17).

Confirms that the environment can compute SHAP values for the forest persisted
by notebook 17, section 14, before any interpretability work is built on it.
It does not interpret anything; it only checks three things:

  * `shap.TreeExplainer` accepts the fitted `RandomForestRegressor`;
  * it handles the lag burn-in `NaN`s the forest was trained with (sklearn's
    native missing-value splits), rather than requiring imputation;
  * the values are additive: expected_value + sum(SHAP row) == predict(row).

It refuses a stale bundle (one fitted on other columns than its metadata lists,
or whose `train_rows` does not match the matrix's rows before the holdout
cutoff) instead of explaining the wrong model.

Usage
-----
Run notebook 17 at least once so the model bundle exists, then::

    python scripts/shap_smoke_test.py            # 200 holdout rows
    python scripts/shap_smoke_test.py --rows 1000
"""
import argparse
import sys
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap

REPO_ROOT = Path(__file__).resolve().parent.parent
PROC = REPO_ROOT / "data" / "processed"
MODEL_PATH = PROC / "north_region_mama_2025_demand_forest_v1.joblib"
MATRIX_PATH = PROC / "north_region_mama_2025_modeling_matrix_atuantes_v1.parquet"
RANDOM_STATE = 42


def check(condition, message):
    # Not `assert`: `python -O` strips asserts and the script would print OK unchecked.
    if not condition:
        sys.exit(f"FAIL: {message}")


def main(n_rows):
    for path in (MODEL_PATH, MATRIX_PATH):
        check(path.is_file(), f"missing {path.relative_to(REPO_ROOT)} -- run notebook 17 first")

    bundle = joblib.load(MODEL_PATH)
    model, meta = bundle["model"], bundle["metadata"]
    # list(): a tuple would never compare equal below, and pandas reads df[tuple]
    # as one column key instead of a list of columns.
    features = list(meta["features"])
    # A bundle trained on other columns can still have the right row count.
    fitted_features = list(getattr(model, "feature_names_in_", []))
    check(fitted_features == features,
          f"stale model bundle: the forest was fitted on {fitted_features}, "
          f"the metadata lists {features} -- re-run notebook 17")

    matrix = pd.read_parquet(MATRIX_PATH)
    matrix["MES"] = pd.to_datetime(matrix["MES"])
    is_holdout = matrix["MES"] >= pd.Timestamp(meta["holdout_cutoff"])
    # A bundle fitted on a different matrix explains the wrong model; refuse it.
    check(int((~is_holdout).sum()) == meta["train_rows"],
          f"stale model bundle: trained on {meta['train_rows']:,} rows, the matrix has "
          f"{int((~is_holdout).sum()):,} before {meta['holdout_cutoff']} -- re-run notebook 17")
    holdout = matrix[is_holdout]
    X = holdout[features].sample(min(n_rows, len(holdout)), random_state=RANDOM_STATE)
    # Force NaN rows into the sample so the missing-value path is always exercised.
    nan_rows = holdout.loc[holdout[features].isna().any(axis=1), features]
    X = pd.concat([X, nan_rows.head(20)]).loc[lambda d: ~d.index.duplicated()]
    n_nan = int(X.isna().any(axis=1).sum())
    check(n_nan > 0, "no holdout row has a NaN predictor -- the missing-value path is untested")

    print(f"shap {shap.__version__} | model {meta['model_name']} "
          f"({model.n_estimators} trees, {meta['train_rows']:,} train rows) | "
          f"{len(X)} rows, {n_nan} with NaN")

    t0 = time.perf_counter()
    explainer = shap.TreeExplainer(model)
    values = explainer.shap_values(X)
    seconds = time.perf_counter() - t0

    check(values.shape == X.shape, f"unexpected SHAP shape {values.shape}")
    check(np.isfinite(values).all(), "non-finite SHAP values")
    expected = float(np.ravel(explainer.expected_value)[0])
    pred = model.predict(X)
    gap = np.abs(expected + values.sum(axis=1) - pred).max()
    check(gap < 1e-6 * max(1.0, float(np.abs(pred).max())),
          f"SHAP values are not additive (max gap {gap:.3g})")

    print(f"computed in {seconds:.1f} s | expected_value {expected:.3f} | "
          f"max additivity gap {gap:.2e}")
    print("\nmean |SHAP| per feature (smoke-test sample, not an interpretation):")
    print(pd.Series(np.abs(values).mean(axis=0), index=features)
          .sort_values(ascending=False).round(3).to_string())
    print("\nOK")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--rows", type=int, default=200, help="holdout rows to explain")
    main(parser.parse_args().rows)
