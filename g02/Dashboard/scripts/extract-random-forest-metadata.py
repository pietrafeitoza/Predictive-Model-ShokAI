#!/usr/bin/env python3
"""Print metadata from a trusted Random Forest joblib bundle as JSON.

Joblib uses pickle-based deserialization, which may execute code stored in the bundle.
Only files produced by a trusted source may be passed to this helper.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


def _json_default(value: Any) -> Any:
    if hasattr(value, "item"):
        return value.item()
    if hasattr(value, "tolist"):
        return value.tolist()
    if hasattr(value, "isoformat"):
        return value.isoformat()
    raise TypeError(f"Metadata value of type {type(value).__name__} is not JSON serializable.")


def extract_metadata(bundle_path: Path) -> dict[str, Any]:
    if not bundle_path.is_file():
        raise ValueError(f"Model bundle does not exist: {bundle_path}")

    try:
        import joblib
    except ImportError as error:
        raise ValueError(
            "The configured Python environment is missing joblib or compatible model dependencies."
        ) from error

    # SECURITY: joblib.load uses pickle and may execute arbitrary code while deserializing.
    # Validating the resulting object cannot make an untrusted bundle safe to load.
    try:
        bundle = joblib.load(bundle_path)
    except Exception as error:
        raise ValueError("The trusted model bundle could not be deserialized.") from error

    if not isinstance(bundle, dict):
        raise ValueError("Malformed model bundle: expected a dictionary.")

    if "metadata" not in bundle:
        raise ValueError("Malformed model bundle: missing metadata.")

    metadata = bundle["metadata"]
    if not isinstance(metadata, dict):
        raise ValueError("Malformed model bundle: metadata must be a dictionary.")

    # After deserialization, avoid invoking or otherwise interacting with the estimator.
    return metadata


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Extract metadata from a trusted joblib bundle without invoking its estimator."
    )
    parser.add_argument("bundle_path", type=Path)
    arguments = parser.parse_args()

    try:
        metadata = extract_metadata(arguments.bundle_path)
        print(json.dumps(metadata, default=_json_default, ensure_ascii=False, separators=(",", ":")))
    except (TypeError, ValueError) as error:
        print(str(error), file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
