"""Runs the full North Region breast cancer data pipeline end to end.

Executes, in order, the notebooks under notebooks/:

  01_consolidate_base.ipynb   -- once per state (AC, AM, AP,
     PA, RO, RR, TO), each run with STATE patched to that state.
  02_merge_north_states.ipynb    -- merges the 7 per-state
     parquet files into one raw North region base.
  03_tuss_sboc_crosswalk.ipynb -- builds the SBOC/TUSS code
     crosswalk used to scope the base to breast cancer.
  04_data_treatment.ipynb -- cleans, filters,
     types and exports the final processed parquet.
  05_descriptive_stats.ipynb -- descriptive statistics (numerical,
     categorical, temporal, key) over the treated parquet.
  06_eda_charts.ipynb -- relationship charts among
     the project's selected variables.
  07_hypothesis_analysis.ipynb -- formulates and
     tests the project's three exploratory hypotheses.
  data_pipeline/08_filter_medicina_de_grupo.ipynb -- filters the treated
     base to Medicina de Grupo operators (NM_MODALIDADE_Medicina De Grupo == 1). This
     filtered population is the official input for every notebook from 09 onward
     (09-13, 15-20); 14 is the only stage in that range still run on the full
     population, since its market-share audit would be circular on a population that
     is 100% verticalized by definition. 01-07 stay on the full population: they
     describe the North region market as a whole, not the modeling population.
  09_activity_matrix_operator.ipynb -- operator-level activity matrix.
  10_kmeans_operator.ipynb -- first candidate model; writes
     active_operators.parquet.
  11_activity_matrix_operator_municipality.ipynb -- operator x municipality activity
     matrix.
  12_kmeans_operator_municipality.ipynb -- second candidate model;
     writes active_operator_municipality_pairs.parquet.
  13_modeling_matrix.ipynb -- feature proposal matrix and the
     persisted supervised training matrix.
  14_verticalization_audit.ipynb -- skipped automatically unless its
     non-hospital market-share CSV is present or its download link is set in
     NON_HOSPITAL_MARKET_SHARE_URL (environment or the gitignored .env). Both are
     supplied out of band, so a clean clone skips this stage. It feeds nothing
     downstream.
  15_decision_tree.ipynb -- supervised Decision Tree candidate.
  16_linear_regression.ipynb -- supervised Linear Regression candidate.
  17_random_forest.ipynb -- supervised Random Forest demand model.
  18_model_comparison.ipynb -- evaluates the three supervised
     candidates on shared rolling-origin folds: Linear Regression v2 by fixed-
     specification cross-validation, and the Decision Tree and Random Forest by
     reproducing their searches with GridSearchCV. Its Section 5.1 adds a fourth,
     regularized-linear specification (Ridge, Lasso and ElasticNet searched together
     via GridSearchCV, model__regressor itself a grid parameter, over alpha, l1_ratio
     and the imputation strategy), with a nested-CV credibility check and a check
     against notebook 16's feature-selection rule. It audits those folds and
     fails if the tree or forest selections disagree with notebooks 15 and 17. It
     reads only notebook 13's matrix and keeps the holdout untouched.
  19_treatment_line_validation.ipynb -- validates the treatment_line_primary
     priority rule behind the target's grain (determinacy, coverage, reach into the
     target, clinical grounding). Read-only: it retrains nothing and rewrites no
     artifact.
  20_demand_model_improvement.ipynb -- improves the Random Forest under a selection
     rule fixed in advance (five rolling origins, skill against the naive forecast,
     a volume guardrail): log1p target, a wider grid, gradient boosting, bias
     corrections, a naive blend and a hurdle model. It reads the holdout once, after
     selection, and writes forest_v2 beside forest_v1 without overwriting it.

Stages 1-7 rebuild the treated parquet from the ANS downloads (roughly 1.4 GB and
tens of minutes). The supervised chain only reads it, so once the treated parquet
exists, `--modeling-only` re-runs the Medicina de Grupo filter, notebooks 09-13 and
15-20 on their own.

Each notebook is executed with papermill and the executed copy (with
outputs baked in) is saved under notebooks/runs/, so a run can be
inspected without touching the original notebooks.

Every notebook produced by a run is validated before the pipeline moves
on: a notebook that raised an exception, that contains an unexecuted code
cell, that carries a blank code cell, or that carries no output at all
fails the run. The same check can be pointed at the committed notebooks
with --validate-only, which is the gate to run before submitting -- it is
what catches a notebook committed without its outputs.

Usage:
    python scripts/run_pipeline.py
    python scripts/run_pipeline.py --states AM PA
    python scripts/run_pipeline.py --skip-states
    python scripts/run_pipeline.py --modeling-only
    python scripts/run_pipeline.py --dry-run
    python scripts/run_pipeline.py --validate-only

The notebooks need the pinned dependencies in requirements.txt. The repository
does not ship an environment, so create one first:

    python -m venv .venv
    .venv/Scripts/python -m pip install -r requirements.txt     # Windows
    .venv/bin/python -m pip install -r requirements.txt         # macOS / Linux
    .venv/Scripts/python -m ipykernel install --user --name python3

The last line matters: every notebook declares kernel `python3`, and papermill
resolves that name through the Jupyter kernel registry rather than through the
interpreter running this script.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
NOTEBOOKS_DIR = REPO_ROOT / "notebooks"
RUNS_DIR = NOTEBOOKS_DIR / "runs"
DATA_PIPELINE_DIR = NOTEBOOKS_DIR / "data_pipeline"

STATES = ["AC", "AM", "AP", "PA", "RO", "RR", "TO"]

TEMPLATE_NB = DATA_PIPELINE_DIR / "01_consolidate_base.ipynb"
MERGE_NB = DATA_PIPELINE_DIR / "02_merge_north_states.ipynb"
CROSSWALK_NB = DATA_PIPELINE_DIR / "03_tuss_sboc_crosswalk.ipynb"
TREATMENT_NB = DATA_PIPELINE_DIR / "04_data_treatment.ipynb"
STATS_NB = DATA_PIPELINE_DIR / "05_descriptive_stats.ipynb"
CHARTS_NB = DATA_PIPELINE_DIR / "06_eda_charts.ipynb"
HYPOTHESIS_NB = DATA_PIPELINE_DIR / "07_hypothesis_analysis.ipynb"
MDG_FILTER_NB = DATA_PIPELINE_DIR / "08_filter_medicina_de_grupo.ipynb"
ACTIVITY_NB = NOTEBOOKS_DIR / "09_activity_matrix_operator.ipynb"
KMEANS_NB = NOTEBOOKS_DIR / "10_kmeans_operator.ipynb"
ACTIVITY_MUNI_NB = NOTEBOOKS_DIR / "11_activity_matrix_operator_municipality.ipynb"
KMEANS_MUNI_NB = NOTEBOOKS_DIR / "12_kmeans_operator_municipality.ipynb"
FEATURES_NB = NOTEBOOKS_DIR / "13_modeling_matrix.ipynb"
AUDIT_NB = NOTEBOOKS_DIR / "14_verticalization_audit.ipynb"
TREE_NB = NOTEBOOKS_DIR / "15_decision_tree.ipynb"
LINEAR_NB = NOTEBOOKS_DIR / "16_linear_regression.ipynb"
FOREST_NB = NOTEBOOKS_DIR / "17_random_forest.ipynb"
SEARCH_NB = NOTEBOOKS_DIR / "18_model_comparison.ipynb"
TREATMENT_LINE_NB = NOTEBOOKS_DIR / "19_treatment_line_validation.ipynb"
IMPROVEMENT_NB = NOTEBOOKS_DIR / "20_demand_model_improvement.ipynb"

# Every stage after the per-state ingestion, in dependency order. `requires` names
# a repo-relative input that no notebook in this pipeline produces; when it is
# absent the stage is skipped with an explanation instead of failing the run.
# Notebook 14 is the only such case: its non-hospital market-share CSV is supplied
# out of band and is gitignored, so a clean clone cannot execute it. It can also
# download the CSV itself when AUDIT_URL_VAR is set, so that counts as available.
AUDIT_URL_VAR = "NON_HOSPITAL_MARKET_SHARE_URL"
SEQUENTIAL_STAGES = [
    ("skip_merge", MERGE_NB, "merge into North region raw base", None),
    ("skip_crosswalk", CROSSWALK_NB, "TUSS/SBOC crosswalk", None),
    ("skip_treatment", TREATMENT_NB, "data treatment -> final parquet", None),
    ("skip_stats", STATS_NB, "descriptive statistics", None),
    ("skip_charts", CHARTS_NB, "relationship charts", None),
    ("skip_hypothesis", HYPOTHESIS_NB, "hypothesis testing", None),
    ("skip_mdg_filter", MDG_FILTER_NB, "Medicina de Grupo filter (official population from here on)", None),
    ("skip_activity", ACTIVITY_NB, "operator activity matrix", None),
    ("skip_kmeans", KMEANS_NB, "K-Means operator segmentation", None),
    ("skip_activity_muni", ACTIVITY_MUNI_NB,
     "operator x municipality activity matrix", None),
    ("skip_kmeans_muni", KMEANS_MUNI_NB,
     "K-Means operator x municipality segmentation", None),
    ("skip_features", FEATURES_NB,
     "feature proposal -> supervised modeling matrix", None),
    ("skip_audit", AUDIT_NB, "non-hospital verticalization audit",
     "data/raw/ans_ambulatorial/market_share_nao_hospitalar_todas_ufs.csv"),
    ("skip_tree", TREE_NB, "Decision Tree candidate", None),
    ("skip_linear", LINEAR_NB, "Linear Regression candidate", None),
    ("skip_forest", FOREST_NB, "Random Forest demand model", None),
    ("skip_search", SEARCH_NB, "supervised search workflow and consistency check", None),
    ("skip_treatment_line", TREATMENT_LINE_NB, "treatment_line_primary rule validation (read-only)", None),
    ("skip_improvement", IMPROVEMENT_NB, "Random Forest improvement (forest_v2)", None),
]

TOTAL_STAGES = 1 + len(SEQUENTIAL_STAGES)

STATE_NEEDLE = 'STATE = "AM"'


def patch_state(template_path: Path, state: str, destination: Path) -> None:
    """Writes a copy of the template notebook with STATE = "AM" set to `state`.

    This edits the parsed notebook JSON directly (only inside code cells)
    instead of using papermill's parameter-cell injection, because Phase 0's
    derived paths (RAW_DIR, INTERIM_DIR, OUTPUT_PATH...) are computed in the
    SAME cell as the STATE assignment. A papermill-injected override cell
    runs *after* that cell, which would be too late to affect those already
    computed paths.
    """
    notebook = json.loads(template_path.read_text(encoding="utf-8"))

    matches = 0
    for cell in notebook["cells"]:
        if cell.get("cell_type") != "code":
            continue
        source = cell["source"]
        is_list = isinstance(source, list)
        text = "".join(source) if is_list else source
        count = text.count(STATE_NEEDLE)
        if not count:
            continue
        matches += count
        patched = text.replace(STATE_NEEDLE, f'STATE = "{state}"')
        cell["source"] = patched.splitlines(keepends=True) if is_list else patched

    if matches != 1:
        raise RuntimeError(
            f"Expected exactly one occurrence of {STATE_NEEDLE!r} in a code cell of "
            f"{template_path.name}, found {matches}. The template notebook's Phase 0 "
            "cell may have changed -- update STATE_NEEDLE in this script accordingly."
        )

    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(notebook, indent=1, ensure_ascii=False), encoding="utf-8")


def collect_notebook_problems(path: Path) -> list[str]:
    """Returns the reasons `path` is not a valid executed notebook.

    An empty list means the notebook is fit to commit: no cell raised, every
    code cell carries an execution count, no code cell is blank, and the
    notebook carries at least one output -- visible evidence that it really
    ran. The output check is deliberately made at notebook level and not at
    cell level: a code cell that ran but printed nothing (an import block, a
    bare `assert`, a function definition) is legitimate and is not reported.
    Execution counts alone are not enough evidence, because a notebook can
    keep them while its outputs are stripped.
    """
    problems: list[str] = []
    try:
        notebook = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return [f"could not be read as a notebook ({error})"]

    code_cells = 0
    cells_with_output = 0

    for position, cell in enumerate(notebook.get("cells", [])):
        if cell.get("cell_type") != "code":
            continue
        source = "".join(cell.get("source", []))
        if not source.strip():
            problems.append(f"cell {position}: blank code cell")
            continue
        code_cells += 1
        if cell.get("execution_count") is None:
            problems.append(f"cell {position}: never executed (no execution count)")
        outputs = cell.get("outputs", [])
        if outputs:
            cells_with_output += 1
        for output in outputs:
            if output.get("output_type") == "error":
                name = output.get("ename", "error")
                value = "".join(output.get("evalue", ""))[:120]
                problems.append(f"cell {position}: raised {name}: {value}")

    if code_cells and not cells_with_output:
        problems.append(
            f"no output anywhere in the notebook ({code_cells} code cells, none carrying "
            "an output): its evidence was stripped, re-run it before committing"
        )

    return problems


def validate_notebook(path: Path) -> bool:
    """Prints the verdict for one notebook and returns True when it is clean."""
    problems = collect_notebook_problems(path)
    if not problems:
        print(f"    OK  {path.name}")
        return True
    print(f"    FAIL {path.name}")
    for problem in problems:
        print(f"         - {problem}")
    return False


def run_notebook(notebook: Path, output: Path, label: str, dry_run: bool) -> None:
    import papermill as pm

    print(f"\n=== {label} ===")
    print(f"    input:  {notebook}")
    print(f"    output: {output}")
    if dry_run:
        print("    (dry-run: skipped)")
        return
    output.parent.mkdir(parents=True, exist_ok=True)
    pm.execute_notebook(str(notebook), str(output), cwd=str(NOTEBOOKS_DIR), progress_bar=False)
    if not validate_notebook(output):
        raise SystemExit(
            f"Stage failed validation: {output}. Fix the notebook and re-run this stage."
        )
    print("    done.")


def validate_committed_notebooks() -> int:
    """Validates the tracked notebooks -- the ones that are actually submitted."""
    notebooks = sorted(
        p for p in NOTEBOOKS_DIR.glob("**/[0-9]*.ipynb")
        if RUNS_DIR not in p.parents and ".ipynb_checkpoints" not in p.parts
    )
    if not notebooks:
        print(f"No notebooks found under {NOTEBOOKS_DIR}.")
        return 1
    print(f"Validating {len(notebooks)} committed notebooks under {NOTEBOOKS_DIR}:")
    clean = all([validate_notebook(path) for path in notebooks])
    if clean:
        print("\nAll committed notebooks carry outputs and executed without errors.")
        return 0
    print(
        "\nOne or more committed notebooks would be submitted without evidence. "
        "Re-run the pipeline and commit the executed notebooks."
    )
    return 1


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--states", nargs="+", default=STATES, choices=STATES, metavar="UF",
        help=f"States to run the template notebook for (default: all 7 -- {' '.join(STATES)}).",
    )
    parser.add_argument(
        "--skip-states", action="store_true",
        help="Skip the per-state template stage entirely (reuse existing data/interim files).",
    )
    parser.add_argument("--skip-merge", action="store_true", help="Skip the merge-into-North-region stage.")
    parser.add_argument("--skip-crosswalk", action="store_true", help="Skip the TUSS/SBOC crosswalk stage.")
    parser.add_argument("--skip-treatment", action="store_true", help="Skip the final data treatment stage.")
    parser.add_argument("--skip-stats", action="store_true", help="Skip the descriptive-statistics stage.")
    parser.add_argument("--skip-charts", action="store_true", help="Skip the relationship-charts stage.")
    parser.add_argument("--skip-hypothesis", action="store_true", help="Skip the hypothesis-testing stage.")
    parser.add_argument("--skip-mdg-filter", action="store_true",
                        help="Skip the Medicina de Grupo filter (notebook 09 onward would then run on a "
                             "stale filtered file, if one exists, instead of a fresh one).")
    parser.add_argument("--skip-activity", action="store_true", help="Skip the operator activity-matrix stage.")
    parser.add_argument("--skip-kmeans", action="store_true", help="Skip the K-Means operator segmentation stage.")
    parser.add_argument("--skip-activity-muni", action="store_true",
                        help="Skip the operator x municipality activity-matrix stage.")
    parser.add_argument("--skip-kmeans-muni", action="store_true",
                        help="Skip the K-Means operator x municipality segmentation stage.")
    parser.add_argument("--skip-features", action="store_true",
                        help="Skip the feature-proposal / modeling-matrix stage.")
    parser.add_argument("--skip-audit", action="store_true",
                        help="Skip the non-hospital verticalization audit (notebook 14).")
    parser.add_argument("--skip-tree", action="store_true",
                        help="Skip the Decision Tree candidate (notebook 15).")
    parser.add_argument("--skip-linear", action="store_true",
                        help="Skip the Linear Regression candidate (notebook 16).")
    parser.add_argument("--skip-forest", action="store_true",
                        help="Skip the Random Forest demand model (notebook 17).")
    parser.add_argument("--skip-search", action="store_true",
                        help="Skip the supervised search workflow (notebook 18).")
    parser.add_argument("--skip-treatment-line", action="store_true",
                        help="Skip the treatment_line_primary rule validation (notebook 19).")
    parser.add_argument("--skip-improvement", action="store_true",
                        help="Skip the Random Forest improvement notebook (notebook 20).")
    parser.add_argument("--modeling-only", action="store_true",
                        help="Run only the supervised chain (notebooks 09-13 and 15-20), reusing the "
                             "existing treated parquet. Shorthand for skipping stages 1-7.")
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print the execution plan (inputs/outputs for each stage) without running anything.",
    )
    parser.add_argument(
        "--validate-only", action="store_true",
        help="Check the committed notebooks for errors, unexecuted cells, blank code cells and "
             "missing outputs, then exit. Run this before submitting. Exits non-zero when a "
             "notebook fails.",
    )
    args = parser.parse_args()

    if args.validate_only:
        raise SystemExit(validate_committed_notebooks())

    if args.modeling_only:
        # Stages 1-7 rebuild the treated parquet from the ANS downloads; the
        # supervised chain only reads it, so it can be re-run on its own.
        args.skip_states = True
        for flag in ("skip_merge", "skip_crosswalk", "skip_treatment",
                     "skip_stats", "skip_charts", "skip_hypothesis"):
            setattr(args, flag, True)

    if args.skip_states:
        print(f"Stage 1/{TOTAL_STAGES} (per-state ingestion): skipped (--skip-states).")
    else:
        for state in args.states:
            patched_path = RUNS_DIR / f"_patched_TEMPLATE_{state}.ipynb"
            if not args.dry_run:
                patch_state(TEMPLATE_NB, state, patched_path)
            run_notebook(
                patched_path,
                RUNS_DIR / f"01_consolidate_base_{state}.ipynb",
                f"Stage 1/{TOTAL_STAGES} - per-state ingestion ({state})",
                args.dry_run,
            )

    for position, (flag, notebook, label, requires) in enumerate(SEQUENTIAL_STAGES, start=2):
        stage = f"Stage {position}/{TOTAL_STAGES}"
        if getattr(args, flag):
            print(f"{stage} ({label}): skipped (--{flag.replace('_', '-')}).")
            continue
        if requires is not None and not _input_available(notebook, requires):
            print(f"{stage} ({label}): skipped -- required input {requires} is not "
                  f"present and {AUDIT_URL_VAR} is not set. Both are supplied out of "
                  f"band and gitignored, so this stage cannot run from a clean clone.")
            continue
        run_notebook(notebook, RUNS_DIR / notebook.name, f"{stage} - {label}", args.dry_run)

    print("\nDry run complete -- nothing was executed." if args.dry_run else "\nPipeline finished.")


def _audit_url_configured() -> bool:
    """True when the audit's download link is set in the environment or in .env."""
    import os

    if os.environ.get(AUDIT_URL_VAR, "").strip():
        return True
    env_file = REPO_ROOT / ".env"
    if not env_file.is_file():
        return False
    for line in env_file.read_text(encoding="utf-8").splitlines():
        key, _, value = line.partition("=")
        if key.strip() == AUDIT_URL_VAR and value.strip().strip("'\""):
            return True
    return False


def _input_available(notebook: Path, requires: str) -> bool:
    if (REPO_ROOT / requires).is_file():
        return True
    return notebook == AUDIT_NB and _audit_url_configured()


if __name__ == "__main__":
    main()
