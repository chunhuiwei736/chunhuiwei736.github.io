"""Regression tests for the append-only note import workflow (standard library only)."""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "add_note_version.py"
SPEC = importlib.util.spec_from_file_location("add_note_version", SCRIPT)
importer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(importer)


class NoteVersionTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.root = self.directory / "site"
        self.root.mkdir()
        self.pdf = self.directory / "Survey.pdf"
        self.pdf.write_bytes(b"%PDF-1.7\noriginal PDF")

    def upload(self, **overrides):
        arguments = {
            "root": self.root,
            "note_id": "su-toda-survey",
            "title": "SU Toda systems: a survey",
            "description": "An informal survey.",
            "pdf": self.pdf,
            "uploaded_at": "2026-10-14T12:28:18+00:00",
        }
        arguments.update(overrides)
        return importer.add_note_version(**arguments)

    def notes(self):
        return json.loads((self.root / "_data/notes.json").read_text())

    def snapshot(self):
        return {str(path.relative_to(self.root)): path.read_bytes()
                for path in self.root.rglob("*") if path.is_file()}

    def test_same_time_upload_preserves_original_files_and_metadata(self):
        first = self.upload()
        first_pdf = (self.root / first["pdf"].lstrip("/")).read_bytes()
        original_page = (self.root / "_pages/notes-su-toda-survey.html").read_bytes()
        self.pdf.write_bytes(b"%PDF-1.7\nrevised PDF")
        second = self.upload(title=None, description=None)
        self.assertNotEqual(first["id"], second["id"])
        self.assertEqual(self.notes()[0]["versions"], [second, first])
        self.assertEqual(self.notes()[0]["title"], "SU Toda systems: a survey")
        self.assertEqual(self.notes()[0]["description"], "An informal survey.")
        self.assertEqual(first["uploaded_at"], "2026-10-14T20:28:18+08:00")
        self.assertEqual(first["uploaded_label"], "14 October 2026, 20:28:18 (UTC+08:00)")
        self.assertEqual((self.root / first["pdf"].lstrip("/")).read_bytes(), first_pdf)
        self.assertEqual((self.root / second["pdf"].lstrip("/")).read_bytes(), self.pdf.read_bytes())
        self.assertEqual((self.root / "_pages/notes-su-toda-survey.html").read_bytes(), original_page)

    def test_random_suffix_collision_is_retried_without_overwriting(self):
        with patch.object(importer.secrets, "token_hex", side_effect=["11111111", "11111111", "22222222"]):
            first = self.upload()
            second = self.upload()
        self.assertNotEqual(first["pdf"], second["pdf"])
        self.assertEqual(len(self.notes()[0]["versions"]), 2)

    def test_backdated_upload_is_sorted_after_newer_versions(self):
        first = self.upload()
        earlier = self.upload(uploaded_at="2026-10-13T20:28:18+08:00")
        self.assertEqual(self.notes()[0]["versions"], [first, earlier])
        self.assertEqual(set(earlier), {"id", "uploaded_at", "uploaded_label", "pdf"})
        page = (self.root / "_pages/notes-su-toda-survey.html").read_text()
        self.assertIn("permalink: /notes/su-toda-survey/", page)
        self.assertIn("{% include note-versions.html %}", page)

    def test_invalid_inputs_leave_existing_files_and_metadata_unchanged(self):
        self.upload()
        before = self.snapshot()
        for invalid in (
            {"pdf": self.directory / "missing.pdf"},
            {"title": "Unexpected replacement title"},
            {"description": "Unexpected replacement description"},
            {"uploaded_at": "2026-10-14T12:28:18"},
            {"uploaded_at": "not a timestamp"},
            {"note_id": "../outside"},
            {"note_id": "new-note", "title": None},
        ):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                self.upload(**invalid)
            self.assertEqual(self.snapshot(), before)

    def test_invalid_pdf_does_not_create_site_files(self):
        self.pdf.write_bytes(b"not a PDF")
        with self.assertRaisesRegex(ValueError, "PDF header"):
            self.upload()
        self.assertEqual(list(self.root.iterdir()), [])

    def test_symlink_destination_cannot_write_outside_repository(self):
        outside = self.directory / "outside"
        outside.mkdir()
        (self.root / "files").symlink_to(outside, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "symlink"):
            self.upload()
        self.assertEqual(list(outside.iterdir()), [])
        self.assertFalse((self.root / "_data").exists())

    def test_failed_metadata_replace_rolls_back_new_version(self):
        self.upload()
        before = self.snapshot()
        with patch.object(Path, "replace", side_effect=OSError("simulated disk failure")):
            with self.assertRaisesRegex(OSError, "disk failure"):
                self.upload()
        self.assertEqual(self.snapshot(), before)

    def test_invalid_existing_metadata_is_preserved(self):
        self.upload()
        metadata_path = self.root / "_data/notes.json"
        metadata_path.write_text('{"unexpected": "object"}')
        before = self.snapshot()
        with self.assertRaisesRegex(ValueError, "array"):
            self.upload()
        self.assertEqual(self.snapshot(), before)


if __name__ == "__main__":
    unittest.main()
