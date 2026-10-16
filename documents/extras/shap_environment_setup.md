# SHAP environment setup

SHAP is used to interpret the Random Forest demand model of
`notebooks/17_random_forest.ipynb`. This note records how it was
added to the project environment and how to reproduce it.

## Versions

| Package | Version | In `requirements.txt` |
|---|---|---|
| numpy | 2.5.2 | unchanged |
| pandas | 3.0.5 | unchanged |
| scikit-learn | 1.9.0 | unchanged |
| **shap** | **0.52.0** | new, pinned |
| numba | 0.67.0 | new, pinned (shap dependency) |
| llvmlite | 0.49.0 | new, pinned (numba dependency) |
| slicer | 0.0.8 | new, pinned (shap dependency) |

Installing shap did not upgrade or downgrade any existing package, and
`pip check` reports no broken requirements.

## Python version

The repo doesn't pin a Python version, and neither does this setup. The one
hard limit is that **shap 0.52.0 requires Python 3.12 or later**: PyPI has no
wheel for it on 3.10 or 3.11.

| Python | Platform | What was verified |
|---|---|---|
| 3.14.3 | Windows 11 | installed, `import shap`, smoke test `OK` |
| 3.14.5 | Windows, fresh venv | installed from wheels, `pip check` clean, smoke test `OK` (MR reviewer) |
| 3.12, 3.13 | Windows x64, Linux x86_64 | the full `requirements.txt` resolves to prebuilt wheels (`pip download --only-binary=:all:`); not installed |

## System-level dependencies

None. shap, numba and llvmlite publish prebuilt wheels for Windows x64 and
Linux x86_64 on Python 3.12–3.14, so no C/C++ compiler or Visual Studio Build
Tools is needed. If pip ever starts building shap from source (a
`Building wheel for shap` line during install), no wheel matches your Python
version. Check the version table above rather than installing build tools.

## Setup in VS Code

1. From the repository root, create and activate the venv, then install:

   ```bash
   python -m venv .venv
   .venv\Scripts\activate      # Windows; on Linux/macOS: source .venv/bin/activate
   pip install -r requirements.txt
   python -c "import shap; print(shap.__version__)"   # 0.52.0
   ```

2. Open `notebooks/17_random_forest.ipynb` and pick the kernel:
   **Select Kernel → Python Environments → `.venv`**. If a kernel was already
   open, **restart it** so it sees shap.
3. Run notebook 17 at least once. It writes the model bundle
   `data/processed/north_region_mama_2025_demand_forest_v1.joblib`.
4. In the VS Code terminal, with `.venv` active:

   ```bash
   python scripts/shap_smoke_test.py            # 200 sampled rows + NaN rows
   python scripts/shap_smoke_test.py --rows 1000
   ```

## What the smoke test checks

The script loads the persisted forest, explains a sample of holdout rows with
`shap.TreeExplainer`, and ends with `OK` if the values are finite and additive
(`expected_value + sum(SHAP) == predict()`). It exits with `FAIL` instead if:

* the bundle is stale: the forest was fitted on different columns than its
  metadata lists, or its `train_rows` doesn't match the matrix's rows before
  the holdout cutoff. Re-run notebook 17.
* no sampled row has a `NaN` predictor, so the missing-value path would go
  untested.

The checks use `sys.exit`, not `assert`, so they still run under `python -O`.

The stale-bundle check only compares the bundle with the local matrix. If both
are old (e.g. the data was built before notebook 13 moved to the Medicina de
Grupo population), they agree and the check passes. After pulling changes to
notebooks 09–17, rebuild them with
`python scripts/run_pipeline.py --modeling-only`.

## Findings from the smoke test

Run on the bundle regenerated on 2026-09-25 (`train_rows=7716`, holdout
cutoff 2025-10-01, 3,810 holdout rows):

* **`TreeExplainer` works on the forest as-is.** `RandomForestRegressor` needs
  no wrapper or conversion.
* **`NaN` predictors are handled.** Notebook 17 keeps the lag burn-in `NaN`s
  and relies on scikit-learn's native missing-value splits. `TreeExplainer`
  follows the same splits. The sample had 220 rows, 30 of them with `NaN`, and
  every row got SHAP values that add up to `predict()` (max gap 1.7e-11). No
  imputation is needed before explaining.
* **Cost.** The 600-tree forest took about 10 s for 220 rows (~0.04 s/row,
  all cores). The full holdout of 3,810 rows takes about 2–3 minutes, so use a
  sample for exploratory plots, as notebook 17 already does for partial
  dependence.
* **First import is slow.** numba compiles on first use, so the first
  `import shap` in a fresh environment can take several seconds. This is
  expected.
