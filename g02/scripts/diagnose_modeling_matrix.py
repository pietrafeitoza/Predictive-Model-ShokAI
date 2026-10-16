"""Diagnostic audit of the supervised modeling matrix built in notebook 13.

Answers three questions about `modeling_matrix_v1` (in-memory, 26 columns) or
about the persisted training matrix parquet (13 columns):

  * which columns may be X, which is y, which must never be either;
  * which columns leak, and why -- decided by lineage, not by column name;
  * which temporal split is valid given how the lag features were built.

Every statistic that describes the target or its relationship to a feature is
computed on the trainable rows only (`TARGET_USABLE_FOR_TRAINING`). Rows whose
target is unknown (all-bundled) or partially measured are reported separately
and never mixed into a describe(), a correlation or a zero count.

Usage
-----
In a kernel that has already run notebook 13::

    import sys; sys.path.append("../scripts")
    from diagnose_modeling_matrix import diagnose
    diagnose(modeling_matrix_v1)

Standalone, against the persisted training matrix::

    python scripts/diagnose_modeling_matrix.py \
        data/processed/north_region_mama_2025_modeling_matrix_atuantes_v1.parquet

The persisted matrix is already filtered to trainable rows and carries only
keys, target and the approved predictors, so the target-status and leakage
sections report absent columns there by design -- that is the point of the
file: the leaking columns never reach it.
"""

from __future__ import annotations

import argparse
import sys

import numpy as np
import pandas as pd

# --------------------------------------------------------------------------
# Column contract -- mirrors notebook 13 (FEATURE_ORDER / CURRENT_X_COLUMNS).
# A column's role is a statement about its lineage, not about its name.
# --------------------------------------------------------------------------

UNIT_KEYS = ["ID_PLANO", "treatment_line_primary", "UF_PRESTADOR", "MES"]
TARGET = "volume_demanda_proxy"
TIME_COL = "MES"
GROUP_COL = "ID_PLANO"
PANEL_KEYS_NO_MONTH = ["ID_PLANO", "treatment_line_primary", "UF_PRESTADOR"]

KEY = "KEY"
TARGET_ROLE = "TARGET"
DIAGNOSTIC = "TARGET_DIAGNOSTIC"
LEAK_SAME_PERIOD = "LEAK_SAME_PERIOD"
LEAK_FULL_YEAR = "LEAK_FULL_YEAR"
POPULATION_FILTER = "POPULATION_FILTER"
PREDICTOR = "PREDICTOR"
CANDIDATE = "CANDIDATE"
UNCLASSIFIED = "UNCLASSIFIED"

COLUMN_ROLES = {
    "ID_PLANO": (KEY, "grouping key; 3289 levels, never a numeric feature"),
    "treatment_line_primary": (KEY, "grouping key; priority convention still unvalidated"),
    "UF_PRESTADOR": (KEY, "grouping key"),
    "MES": (KEY, "time index; drives the split, not a feature"),
    TARGET: (TARGET_ROLE, "y"),
    "TARGET_MEASUREMENT_STATUS": (DIAGNOSTIC, "describes how y was measured"),
    "TARGET_USABLE_FOR_TRAINING": (DIAGNOSTIC, "row filter derived from y"),
    "IS_STRUCTURAL_ZERO": (DIAGNOSTIC, "says y == 0; using it predicts y from y"),
    "N_SOURCE_ROWS": (LEAK_SAME_PERIOD, "counted from the target month's own claims"),
    "N_BUNDLED_ROWS": (LEAK_SAME_PERIOD, "counted from the target month's own claims"),
    "BUNDLING_RATE": (LEAK_SAME_PERIOD, "N_BUNDLED_ROWS / N_SOURCE_ROWS, same month as y"),
    "STATUS_ATUACAO": (POPULATION_FILTER, "as of the row's month, prior claims only; selects rows, never a feature"),
    "n_municipality_pairs_total": (CANDIDATE, "cumulative municipality activity as of the row's month; not in the approved X"),
    "n_municipality_pairs_active": (CANDIDATE, "as-of active pairs behind STATUS_ATUACAO; not in the approved X"),
    "share_active_municipality_pairs": (CANDIDATE, "ratio of the two as-of counts above; not in the approved X"),
    "DEMAND_LAG_1M": (PREDICTOR, "strictly past: groupby.shift(1) over usable history"),
    "DEMAND_LAG_3M": (PREDICTOR, "strictly past: groupby.shift(3) over usable history"),
    "DEMAND_LAG_6M": (PREDICTOR, "strictly past: groupby.shift(6) over usable history"),
    "DEMAND_MEAN_3M": (PREDICTOR, "rolling mean of shift(1); invalid windows set to NaN"),
    "DEMAND_MEAN_6M": (PREDICTOR, "rolling mean of shift(1); invalid windows set to NaN"),
    "DEMAND_STD_3M": (PREDICTOR, "rolling std of shift(1); invalid windows set to NaN"),
    "PORTE_ORDINAL": (PREDICTOR, "static operator attribute, pre-period"),
    "MONTH": (PREDICTOR, "calendar month of MES"),
    "DEMAND_GROWTH_MOM": (CANDIDATE, "past-only (lag1 vs lag2) but not in the approved X"),
    "PORTE": (CANDIDATE, "redundant with PORTE_ORDINAL; needs encoding if used"),
    "QUARTER": (CANDIDATE, "redundant with MONTH"),
}

APPROVED_X = [
    "DEMAND_LAG_1M", "DEMAND_LAG_3M", "DEMAND_LAG_6M",
    "DEMAND_MEAN_3M", "DEMAND_MEAN_6M", "DEMAND_STD_3M",
    "PORTE_ORDINAL", "MONTH",
]

EXCLUDED_ROLES = {KEY, TARGET_ROLE, DIAGNOSTIC, LEAK_SAME_PERIOD, LEAK_FULL_YEAR, POPULATION_FILTER}
ELIGIBLE_ROLES = {PREDICTOR, CANDIDATE, UNCLASSIFIED}


def _role_of(column):
    return COLUMN_ROLES.get(
        column, (UNCLASSIFIED, "not in the notebook 13 contract -- audit before use")
    )


def _banner(number, title):
    print("\n" + "=" * 80)
    print(f"{number}. {title}")
    print("=" * 80)


def _trainable_mask(df):
    """Rows whose target is actually measured. Everything downstream uses this."""
    if "TARGET_USABLE_FOR_TRAINING" in df.columns:
        return df["TARGET_USABLE_FOR_TRAINING"].astype(bool)
    # Persisted training matrix: already filtered, but never assume it silently.
    if TARGET in df.columns:
        return df[TARGET].notna()
    return pd.Series(True, index=df.index)


def _numeric_columns(df):
    """np.number excludes bool, and the bool columns here are diagnostics."""
    return df.select_dtypes(include=np.number).columns.tolist()


# --------------------------------------------------------------------------
# Sections
# --------------------------------------------------------------------------

def _section_structure(df, trainable):
    _banner(1, "STRUCTURE")
    print(f"Shape: {df.shape}  ({len(df):,} rows x {df.shape[1]} columns)")
    print(f"Trainable rows (measured target): {int(trainable.sum()):,}")
    print(f"Excluded rows (unknown/partial target): {int((~trainable).sum()):,}")

    roles = pd.DataFrame(
        [(c,) + _role_of(c) for c in df.columns], columns=["column", "role", "reason"]
    )
    print("\nColumns by role:")
    print(roles.to_string(index=False))

    unclassified = roles.loc[roles["role"] == UNCLASSIFIED, "column"].tolist()
    if unclassified:
        print("\nWARNING -- columns outside the notebook 13 contract:", unclassified)


def _section_dtypes(df):
    _banner(2, "DTYPES AND MISSINGNESS (all columns, bool and datetime included)")
    report = pd.DataFrame({
        "column": df.columns,
        "role": [_role_of(c)[0] for c in df.columns],
        "dtype": df.dtypes.astype(str).values,
        "n_unique": [df[c].nunique(dropna=False) for c in df.columns],
        "missing": [int(df[c].isna().sum()) for c in df.columns],
        "missing_pct": [round(df[c].isna().mean() * 100, 2) for c in df.columns],
    })
    print(report.to_string(index=False))


def _section_target(df, trainable):
    _banner(3, "TARGET")
    if TARGET not in df.columns:
        print(f"{TARGET} not present -- this is not a modeling matrix.")
        return

    if "TARGET_MEASUREMENT_STATUS" in df.columns:
        print("Rows by measurement status:")
        print(df["TARGET_MEASUREMENT_STATUS"].value_counts(dropna=False).to_string())
        print("\nNaN target by status (all-bundled rows must be the only NaN):")
        nan_by_status = df.groupby("TARGET_MEASUREMENT_STATUS", observed=True)[TARGET].apply(
            lambda s: int(s.isna().sum())
        )
        print(nan_by_status.to_string())
    else:
        print("TARGET_MEASUREMENT_STATUS not present (persisted training matrix).")

    y = df.loc[trainable, TARGET]
    print(f"\n--- {TARGET}, trainable rows only (n={len(y):,}) ---")
    print("dtype:", y.dtype)
    print("missing:", int(y.isna().sum()), "(must be 0)")
    print(f"zeros: {int((y == 0).sum())} ({(y == 0).mean() * 100:.1f}% -- zero-inflated)")
    print("negative:", int((y < 0).sum()))
    print("skew:", round(float(y.skew()), 2))
    print(y.describe(percentiles=[0.25, 0.5, 0.75, 0.9, 0.99]).to_string())

    if "IS_STRUCTURAL_ZERO" in df.columns:
        struct = df["IS_STRUCTURAL_ZERO"].astype(bool)
        print("\nStructural zeros (reindexed months inside the operator span):", int(struct.sum()))
        print("Observed measured rows:", int((trainable & ~struct).sum()))
        print("NOTE: that zero mass is created by the panel reindex, not observed as")
        print("absence of demand. A model scored on it is partly scoring the reindex.")


def _section_keys(df):
    _banner(4, "MODELING KEY")
    missing = [k for k in UNIT_KEYS if k not in df.columns]
    if missing:
        print("Key columns absent:", missing)
        return
    dups = int(df.duplicated(subset=UNIT_KEYS).sum())
    print("Key:", UNIT_KEYS)
    print("Duplicated keys:", dups, "->", "UNIQUE" if dups == 0 else "VIOLATION")
    print("Nulls in key columns:", df[UNIT_KEYS].isna().sum().to_dict())
    print("Distinct operators:", df[GROUP_COL].nunique())
    print("Distinct panel units (operator x line x UF):",
          len(df[PANEL_KEYS_NO_MONTH].drop_duplicates()))


def _section_population(df):
    _banner(5, "POPULATION FILTER")
    if "STATUS_ATUACAO" not in df.columns:
        print("STATUS_ATUACAO not present -- the filter was applied upstream.")
        return
    print(df["STATUS_ATUACAO"].value_counts(dropna=False).to_string())
    if df["STATUS_ATUACAO"].nunique(dropna=False) == 1:
        print("\nConstant by design: rows are kept only when the operator was ATUANTE as")
        print("of the row's own month, so every surviving row carries that value. It is a")
        print("population filter, never a feature. Section 9 flags it as constant; that is")
        print("expected, not a finding.")


def _section_cardinality(df):
    _banner(6, "CARDINALITY")
    card = pd.DataFrame({
        "column": df.columns,
        "role": [_role_of(c)[0] for c in df.columns],
        "n_unique": [df[c].nunique(dropna=False) for c in df.columns],
        "unique_pct": [round(df[c].nunique(dropna=False) / len(df) * 100, 3) for c in df.columns],
    })
    print(card.sort_values("n_unique", ascending=False).to_string(index=False))


def _section_numeric(df, trainable):
    _banner(7, "NUMERIC COLUMNS (trainable rows)")
    numeric_cols = _numeric_columns(df)
    print(f"{len(numeric_cols)} numeric columns:", numeric_cols)

    if numeric_cols:
        sub = df.loc[trainable, numeric_cols]
        summary = sub.describe().T
        summary["role"] = [_role_of(c)[0] for c in summary.index]
        summary["missing_pct"] = (sub.isna().mean() * 100).round(2)
        summary["zero_count"] = (sub == 0).sum()
        summary["negative_count"] = (sub < 0).sum()
        summary["skew"] = sub.skew().round(2)
        print(summary.to_string())

    bool_cols = df.select_dtypes(include="bool").columns.tolist()
    if bool_cols:
        print("\nBoolean columns (np.number excludes them, so they are profiled here):")
        for col in bool_cols:
            print(f"  {col} [{_role_of(col)[0]}]: {df[col].mean() * 100:.2f}% True")


def _section_categorical(df):
    _banner(8, "CATEGORICAL AND DATETIME COLUMNS")
    cat_cols = df.select_dtypes(include=["object", "category", "string"]).columns.tolist()
    dt_cols = df.select_dtypes(include=["datetime", "datetimetz"]).columns.tolist()

    print(f"{len(cat_cols)} categorical:", cat_cols)
    for col in cat_cols:
        print(f"\n{col} [{_role_of(col)[0]}]: {df[col].nunique(dropna=False)} levels")
        print(df[col].value_counts(dropna=False).head(10).to_string())

    print(f"\n{len(dt_cols)} datetime (invisible to both dtype branches of the old script):",
          dt_cols)
    for col in dt_cols:
        print(f"  {col}: {df[col].min()} .. {df[col].max()}  ({df[col].nunique()} distinct)")

    needs_encoding = [c for c in cat_cols if _role_of(c)[0] in ELIGIBLE_ROLES]
    print("\nCategorical columns that would need encoding if promoted to X:",
          needs_encoding or "none -- every approved predictor is already numeric")


def _section_constants(df):
    _banner(9, "CONSTANT / NEAR-CONSTANT COLUMNS")
    rows = []
    for col in df.columns:
        freq = df[col].value_counts(normalize=True, dropna=False)
        if len(freq) == 0:
            continue
        top = float(freq.iloc[0])
        if df[col].nunique(dropna=False) <= 1 or top >= 0.99:
            rows.append((col, _role_of(col)[0], df[col].nunique(dropna=False), round(top * 100, 2)))

    if not rows:
        print("None.")
        return
    out = pd.DataFrame(rows, columns=["column", "role", "n_unique", "top_share_pct"])
    print(out.to_string(index=False))
    print("\nConstants whose role is KEY / TARGET_DIAGNOSTIC / LEAK_* are by design.")


def _spearman(a, b):
    """Pearson on average ranks -- identical to Spearman, without needing scipy
    (pandas delegates method="spearman" to scipy, which is not a declared
    dependency of this project)."""
    return float(a.rank().corr(b.rank()))


def _corr_table(features, frame, y):
    rows = []
    for col in features:
        s = pd.to_numeric(frame[col], errors="coerce")
        paired = s.notna() & y.notna()
        n = int(paired.sum())
        constant = n > 2 and (s[paired].nunique() < 2 or y[paired].nunique() < 2)
        rows.append({
            "column": col,
            "role": _role_of(col)[0],
            "n_pairs": n,
            "pearson": round(float(s[paired].corr(y[paired])), 4) if n > 2 and not constant else np.nan,
            "spearman": round(_spearman(s[paired], y[paired]), 4) if n > 2 and not constant else np.nan,
        })
    table = pd.DataFrame(rows)
    if table.empty:
        return table
    return table.sort_values("spearman", key=lambda c: c.abs(), ascending=False)


def _section_correlation(df, trainable):
    _banner(10, "CORRELATION WITH TARGET (trainable rows)")
    if TARGET not in df.columns:
        print("No target.")
        return
    frame = df.loc[trainable]
    y = frame[TARGET]
    numeric_cols = [c for c in _numeric_columns(df) if c != TARGET]

    eligible = [c for c in numeric_cols if _role_of(c)[0] in ELIGIBLE_ROLES]
    if eligible:
        print("Eligible predictors -- read Spearman, not Pearson: y is zero-inflated")
        print("and heavily skewed, so Pearson is dominated by a few large months.")
        print(_corr_table(eligible, frame, y).to_string(index=False))
        print("\nn_pairs matters: DEMAND_LAG_6M and DEMAND_MEAN_6M only exist for units")
        print("with enough history, so their coefficient is computed on a biased subset.")

    leaking = [c for c in numeric_cols
               if _role_of(c)[0] in {LEAK_SAME_PERIOD, LEAK_FULL_YEAR, DIAGNOSTIC}]
    if leaking:
        print("\nLEAKING columns -- shown as evidence of the leak, NOT as candidates.")
        print("A high coefficient here confirms the column must stay out of X:")
        print(_corr_table(leaking, frame, y).to_string(index=False))


def _section_leakage(df):
    _banner(11, "LEAKAGE AUDIT (by lineage, not by column name)")
    rows = [(c,) + _role_of(c) for c in df.columns
            if _role_of(c)[0] in EXCLUDED_ROLES or _role_of(c)[0] == UNCLASSIFIED]
    print(pd.DataFrame(rows, columns=["column", "role", "reason"]).to_string(index=False))
    print("\nWhy this is a lineage table and not a keyword scan: no LEAK_SAME_PERIOD")
    print("column (N_SOURCE_ROWS, N_BUNDLED_ROWS, BUNDLING_RATE) and no LEAK_FULL_YEAR")
    print("column has 'target', 'volume' or 'demanda' in its name. A name-based check")
    print("clears every one of them while flagging the target itself.")
    print("\nPopulation selection: notebook 13 builds the matrix as of each month. A row")
    print("for month s exists only if the operator was ATUANTE on claims billed before s")
    print("and its operator x line x UF combination had been billed before s; each")
    print("operator's panel runs to the end of the data, not to its last claim. Selection")
    print("therefore uses no information from after the row's month, and any split on MES")
    print("is free of look-ahead. An earlier version selected rows with full-year 2025")
    print("activity -- a leak that dropping STATUS_ATUACAO from X did not remove.")


def _section_temporal(df, trainable, holdout_months):
    _banner(12, "TEMPORAL SPLIT")
    if TIME_COL not in df.columns:
        print(f"{TIME_COL} not present.")
        return

    months = pd.DatetimeIndex(sorted(pd.Series(df[TIME_COL]).dropna().unique()))
    print(f"{TIME_COL}: {months.min().date()} .. {months.max().date()}  ({len(months)} months)")

    per_month = pd.DataFrame({
        "rows": df.groupby(TIME_COL, observed=True).size(),
        "trainable": df.loc[trainable].groupby(TIME_COL, observed=True).size(),
    })
    for col in APPROVED_X:
        if col in df.columns and df[col].isna().any():
            per_month[f"{col}_nan"] = df.groupby(TIME_COL, observed=True)[col].apply(
                lambda s: int(s.isna().sum())
            )
    print("\nRows per month (the lag NaN counts are the burn-in period):")
    print(per_month.fillna(0).astype(int).to_string())

    if len(months) > holdout_months:
        cutoff = months[-holdout_months]
        train_rows = int((trainable & (df[TIME_COL] < cutoff)).sum())
        test_rows = int((trainable & (df[TIME_COL] >= cutoff)).sum())
        print(f"\nProposed split -- last {holdout_months} months as holdout:")
        print(f"  train: {TIME_COL} <  {cutoff.date()}  ->  {train_rows:,} trainable rows")
        print(f"  test:  {TIME_COL} >= {cutoff.date()}  ->  {test_rows:,} trainable rows")
        print("\nExpanding-window folds (train on everything strictly before the fold month):")
        for month in months[-holdout_months:]:
            n_train = int((trainable & (df[TIME_COL] < month)).sum())
            n_test = int((trainable & (df[TIME_COL] == month)).sum())
            print(f"  fold {month.date()}: train {n_train:,} / test {n_test:,}")

    print("\nRules the split has to respect:")
    print("  * Split on MES, not on a random KFold. A random KFold puts month t+1 of a")
    print("    unit in train and month t in test; DEMAND_LAG_1M then carries the test")
    print("    target verbatim.")
    print("  * GroupKFold by ID_PLANO does keep each unit's whole lag series on one side,")
    print("    so it avoids that specific leak. It still mixes calendar periods across")
    print("    folds -- training on an operator's late-2025 rows while testing on")
    print("    another operator's early-2025 rows -- which breaks the coherence of a")
    print("    real forecast scenario even though it is not the same leak mechanism.")
    print("    A MES-based split is still the right recommendation.")
    print("  * Lags come from groupby.shift over the panel order, so the first months of")
    print("    each unit's span are NaN by construction. Do not fill them with a")
    print("    statistic computed across the split boundary.")


def _section_summary(df, trainable):
    _banner(13, "MODELING CONTRACT")
    x_cols = [c for c in APPROVED_X if c in df.columns]
    missing_x = [c for c in APPROVED_X if c not in df.columns]
    excluded = [c for c in df.columns if _role_of(c)[0] in EXCLUDED_ROLES]

    print(f"Rows: {len(df):,}   trainable: {int(trainable.sum()):,}")
    print(f"y  = {TARGET}   (TARGET_USABLE_FOR_TRAINING rows only)")
    print(f"X  = {len(x_cols)} columns: {x_cols}")
    if missing_x:
        print(f"     absent from this frame: {missing_x}")
    print(f"Excluded from X ({len(excluded)}): {excluded}")
    print(f"Key: {UNIT_KEYS}")
    print("\nEncoding: none needed -- every approved predictor is numeric.")
    if "PORTE" in df.columns:
        print("  PORTE would need encoding, but PORTE_ORDINAL already carries that information.")
    if {"UF_PRESTADOR", "treatment_line_primary"} <= set(df.columns):
        print(f"  UF_PRESTADOR ({df['UF_PRESTADOR'].nunique()} levels) and "
              f"treatment_line_primary ({df['treatment_line_primary'].nunique()}) are keys;")
        print("  one-hot them only if they are deliberately promoted to features.")

    if x_cols:
        nan_share = df.loc[trainable, x_cols].isna().mean().mul(100).round(2)
        print("\nNaN share per X column on trainable rows -- RandomForest cannot consume")
        print("NaN, so this is a decision to make before fitting (explicit imputation, or")
        print("HistGradientBoostingRegressor, which handles NaN natively):")
        print(nan_share.to_string())

    return {
        "target": TARGET,
        "x_columns": x_cols,
        "keys": UNIT_KEYS,
        "trainable_rows": int(trainable.sum()),
        "excluded_columns": excluded,
    }


def diagnose(df, holdout_months=3, preview=False):
    """Run the full audit. Returns the modeling contract as a dict."""
    trainable = _trainable_mask(df)

    _section_structure(df, trainable)
    _section_dtypes(df)
    _section_target(df, trainable)
    _section_keys(df)
    _section_population(df)
    _section_cardinality(df)
    _section_numeric(df, trainable)
    _section_categorical(df)
    _section_constants(df)
    _section_correlation(df, trainable)
    _section_leakage(df)
    _section_temporal(df, trainable, holdout_months)
    contract = _section_summary(df, trainable)

    if preview:
        _banner(14, "PREVIEW")
        print(df.head(10).to_string())
        print("\nSample:")
        print(df.sample(min(10, len(df)), random_state=42).to_string())

    return contract


def main(argv=None):
    parser = argparse.ArgumentParser(description="Audit the modeling matrix from notebook 13.")
    parser.add_argument("parquet", help="path to the modeling/training matrix parquet")
    parser.add_argument("--holdout-months", type=int, default=3)
    parser.add_argument("--preview", action="store_true", help="print head/sample rows")
    args = parser.parse_args(argv)

    pd.set_option("display.width", 200)
    pd.set_option("display.max_columns", 60)
    diagnose(pd.read_parquet(args.parquet), args.holdout_months, args.preview)
    return 0


if __name__ == "__main__":
    sys.exit(main())
