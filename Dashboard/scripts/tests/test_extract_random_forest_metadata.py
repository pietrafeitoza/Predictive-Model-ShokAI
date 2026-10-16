from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import joblib


SCRIPT = Path(__file__).parents[1] / "extract-random-forest-metadata.py"


class MetadataHelperTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory(dir=Path(__file__).parent)
        self.directory = Path(self.temporary_directory.name)

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def run_helper(self, bundle: object) -> subprocess.CompletedProcess[str]:
        bundle_path = self.directory / "bundle.joblib"
        joblib.dump(bundle, bundle_path)
        before = sorted(path.name for path in self.directory.iterdir())
        result = subprocess.run(
            [sys.executable, str(SCRIPT), str(bundle_path)],
            check=False,
            capture_output=True,
            text=True,
        )
        after = sorted(path.name for path in self.directory.iterdir())
        self.assertEqual(before, after)
        return result

    def test_extracts_only_metadata_as_valid_json(self) -> None:
        result = self.run_helper({"model": "MODEL_SENTINEL", "metadata": {"version": 1}})
        self.assertEqual(result.returncode, 0)
        self.assertEqual(json.loads(result.stdout), {"version": 1})
        self.assertNotIn("MODEL_SENTINEL", result.stdout)

    def test_rejects_a_malformed_bundle(self) -> None:
        result = self.run_helper(["not", "a", "dictionary"])
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("expected a dictionary", result.stderr)

    def test_rejects_a_bundle_without_metadata(self) -> None:
        result = self.run_helper({"model": "MODEL_SENTINEL"})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("missing metadata", result.stderr)


if __name__ == "__main__":
    unittest.main()
