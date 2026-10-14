# Adding a note or another version

The Notes index links to a version selection page for each note. Each upload is
listed by its upload time in Asia/Shanghai (UTC+08:00), newest first. Each version
links to its PDF.

From the repository root, create a note with Python 3.9 or newer:

```sh
python3 scripts/add_note_version.py \
  --id su-toda-systems-survey \
  --title 'SU(n+1) Toda Systems on Riemann Surfaces' \
  --description 'A brief survey of existence and classification results for SU(n+1) Toda systems on Riemann surfaces.' \
  --pdf /path/to/SU_Toda_Systems_Survey.pdf
```

To add another version, use the **same note id** and the new PDF. The title and
description can be omitted; the existing values are preserved. Upload filenames
must start with a letter or digit and contain only letters, digits, dots,
underscores, and hyphens.

The script creates a unique directory under
`files/notes/<note-id>/<timestamp-and-unique-suffix>/`, keeps the original filenames
and file bytes, appends a version to `_data/notes.json`, and creates the note's
page in `_pages/` if needed. Uploading the same filename twice, even in the same
second, creates two distinct versions. It does not overwrite previous files or
change the note's existing title or description.

Keep uploaded version directories and existing version entries unchanged. To
correct a document, upload a new version. To deliberately change the note title
or description, edit its metadata (and the page title when applicable) separately.
Run imports one at a time so each invocation reads the latest version list.

The upload time defaults to the current time. For an import with a known upload
time, pass `--uploaded-at '2026-10-14T20:28:18+08:00'`; a timezone is required.
The script converts other timezone offsets to Asia/Shanghai. Review and commit
the new files, note page, and metadata, then push through the usual GitHub Pages
workflow. This is a local maintenance command; the public site has no upload form.

Run the preservation and failure-handling checks with:

```sh
python3 -m unittest discover -s scripts/tests -p 'test_add_note_version.py' -v
```
