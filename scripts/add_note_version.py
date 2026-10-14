#!/usr/bin/env python3
"""Append a timestamped note version without replacing any uploaded files."""

import argparse
import json
import re
import secrets
import shutil
import tempfile
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
UPLOAD_TIMEZONE = ZoneInfo("Asia/Shanghai")
SLUG = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*\Z")
FILENAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*\Z")
VERSION_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_+-]*\Z")


def upload_time(value=None):
    if value is None:
        return datetime.now(UPLOAD_TIMEZONE)
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError) as error:
        raise ValueError("Upload time must be an ISO 8601 timestamp.") from error
    if parsed.tzinfo is None:
        raise ValueError("Upload time must include a timezone, such as +08:00.")
    return parsed.astimezone(UPLOAD_TIMEZONE)


def plain_text(value, field, allow_empty=False):
    if not isinstance(value, str) or any(ord(char) < 32 for char in value):
        raise ValueError(f"{field} must be plain text on one line.")
    if not allow_empty and not value.strip():
        raise ValueError(f"{field} must not be empty.")
    return value.strip()


def safe_destination(root, relative_path):
    """Refuse symlink destinations, including any existing parent directory."""
    path = root
    for part in Path(relative_path).parts:
        if part in (".", "..") or Path(part).is_absolute():
            raise ValueError("Destination paths must stay inside the repository.")
        path = path / part
        if path.is_symlink():
            raise ValueError(f"Refusing a symlink destination: {path}")
    return path


def read_pdf(filename):
    path = Path(filename).expanduser()
    if not FILENAME.fullmatch(path.name):
        raise ValueError("Upload filenames must use letters, digits, dots, hyphens, or underscores.")
    if path.suffix.lower() != ".pdf":
        raise ValueError(f"Expected a .pdf file: {path}")
    if not path.is_file():
        raise ValueError(f"Upload file does not exist or is not a regular file: {path}")
    content = path.read_bytes()
    if not content:
        raise ValueError(f"Upload file is empty: {path}")
    if not content.startswith(b"%PDF-"):
        raise ValueError(f"Upload file does not have a PDF header: {path}")
    return path.name, content


def read_notes(path):
    if not path.exists():
        return []
    notes = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(notes, list):
        raise ValueError("_data/notes.json must contain an array of notes.")
    note_ids = set()
    for note in notes:
        if not isinstance(note, dict) or not isinstance(note.get("id"), str):
            raise ValueError("Each existing note must have an id.")
        note_id = note["id"]
        if not SLUG.fullmatch(note_id) or note_id in note_ids:
            raise ValueError("Existing note ids must be unique lowercase slugs.")
        note_ids.add(note_id)
        plain_text(note.get("title"), "Existing note title")
        plain_text(note.get("description", ""), "Existing note description", allow_empty=True)
        versions = note.get("versions")
        if not isinstance(versions, list):
            raise ValueError("Each existing note must have a versions array.")
        version_ids = set()
        for version in versions:
            if not isinstance(version, dict) or not isinstance(version.get("id"), str):
                raise ValueError("Each existing version must have an id.")
            version_id = version["id"]
            if not VERSION_ID.fullmatch(version_id) or version_id in version_ids:
                raise ValueError("Existing version ids must be safe and unique within each note.")
            version_ids.add(version_id)
            upload_time(version.get("uploaded_at", ""))
            plain_text(version.get("uploaded_label"), "Existing upload label")
            prefix = f"/files/notes/{note_id}/{version_id}/"
            url = version.get("pdf")
            if not isinstance(url, str) or not url.startswith(prefix):
                raise ValueError("Existing PDF path does not belong to its version.")
            if not FILENAME.fullmatch(url[len(prefix):]):
                raise ValueError("Existing PDF path has an unsafe filename.")
    return notes


def note_page(note):
    title = (note["title"] + " | Notes | Chunhui Wei").replace("'", "''")
    return (
        "---\nlayout: splash\n"
        f"title: '{title}'\npermalink: /notes/{note['id']}/\n"
        "author_profile: false\nacademic_navigation: true\n"
        "academic_navigation_url: /notes/\nclasses:\n  - academic-page\n"
        f"note_id: {note['id']}\n---\n\n"
        "{% include note-versions.html %}\n"
    )


def add_note_version(*, note_id, pdf, title=None, description=None,
                     uploaded_at=None, root=REPOSITORY_ROOT):
    """Validate the complete import, append its files, then atomically save metadata."""
    root = Path(root).expanduser().resolve(strict=True)
    if not root.is_dir():
        raise ValueError("Repository root must be a directory.")
    if not isinstance(note_id, str) or not SLUG.fullmatch(note_id):
        raise ValueError("Note id must be a lowercase slug, such as su-toda-systems-survey.")
    if title is not None:
        title = plain_text(title, "Title")
    if description is not None:
        description = plain_text(description, "Description", allow_empty=True)
    timestamp = upload_time(uploaded_at)
    filename, content = read_pdf(pdf)

    metadata_path = safe_destination(root, "_data/notes.json")
    page_path = safe_destination(root, f"_pages/notes-{note_id}.html")
    version_parent = safe_destination(root, f"files/notes/{note_id}")
    for directory in (metadata_path.parent, page_path.parent, version_parent):
        for ancestor in (directory, *directory.parents):
            if ancestor == root:
                break
            if ancestor.exists() and not ancestor.is_dir():
                raise ValueError(f"Expected a destination directory: {ancestor}")
    if page_path.exists() and not page_path.is_file():
        raise ValueError(f"Expected a note page file: {page_path}")
    notes = read_notes(metadata_path)
    note = next((item for item in notes if item["id"] == note_id), None)
    if note is None:
        if title is None:
            raise ValueError("--title is required when creating a new note.")
        note = {"id": note_id, "title": title, "description": description or "", "versions": []}
        notes.append(note)
    else:
        for field, value in (("title", title), ("description", description)):
            if value is not None and value != note.get(field, ""):
                raise ValueError(f"The existing {field} differs; edit note metadata explicitly to change it.")

    # Exclusive directory creation also handles the unlikely random suffix collision.
    version_parent.mkdir(parents=True, exist_ok=True)
    existing_ids = {version["id"] for version in note["versions"]}
    while True:
        version_id = timestamp.strftime("%Y%m%dT%H%M%S%z") + "-" + secrets.token_hex(4)
        version_directory = version_parent / version_id
        if version_id in existing_ids:
            continue
        try:
            version_directory.mkdir()
            break
        except FileExistsError:
            continue

    months = ("January", "February", "March", "April", "May", "June", "July",
              "August", "September", "October", "November", "December")
    version = {
        "id": version_id,
        "uploaded_at": timestamp.isoformat(timespec="seconds"),
        "uploaded_label": f"{timestamp.day} {months[timestamp.month - 1]} {timestamp.year}, "
                          f"{timestamp:%H:%M:%S} (UTC+08:00)",
        "pdf": f"/files/notes/{note_id}/{version_id}/{filename}",
    }
    # Stable sorting leaves a newly uploaded version first if timestamps are equal.
    note["versions"].insert(0, version)
    note["versions"].sort(key=lambda item: upload_time(item["uploaded_at"]), reverse=True)
    metadata = json.dumps(notes, ensure_ascii=False, indent=2) + "\n"
    created_page = False
    temporary_path = None
    try:
        with (version_directory / filename).open("xb") as output:
            output.write(content)
        if not page_path.exists():
            page_path.parent.mkdir(parents=True, exist_ok=True)
            with page_path.open("x", encoding="utf-8") as output:
                created_page = True
                output.write(note_page(note))
        metadata_path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=metadata_path.parent,
                                         prefix=".notes-", suffix=".tmp", delete=False) as output:
            temporary_path = Path(output.name)
            output.write(metadata)
        temporary_path.replace(metadata_path)
    except Exception:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
        if created_page:
            page_path.unlink()
        shutil.rmtree(version_directory)
        raise
    return version


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--id", dest="note_id", required=True, help="Stable lowercase note slug")
    parser.add_argument("--title", help="Required for a new note; existing titles are preserved")
    parser.add_argument("--description", help="Optional plain-text description for a new note")
    parser.add_argument("--pdf", required=True, type=Path)
    parser.add_argument("--uploaded-at", help="ISO timestamp with timezone; defaults to now in Asia/Shanghai")
    parser.add_argument("--root", type=Path, default=REPOSITORY_ROOT, help="Repository root")
    arguments = parser.parse_args()
    try:
        version = add_note_version(**vars(arguments))
    except (OSError, ValueError) as error:
        parser.exit(2, f"error: {error}\n")
    print(f"Added {arguments.note_id}: {version['uploaded_label']}")
    print(f"Version: {version['id']}")
    print(f"PDF: {version['pdf']}")


if __name__ == "__main__":
    main()
