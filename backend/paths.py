"""
Helpers for safely resolving files in MODS_DIR and DOWNLOADS_DIR
"""
import os
import re
from typing import Optional


def mod_file_path(mods_dir: str, filename: str) -> str:
    """Join a filename onto mods_dir, rejecting anything that isn't a plain file name
    (e.g. '../x', 'sub/x', absolute paths) so callers can't escape the mods directory."""
    if (
        not filename
        or filename in (".", "..")
        or os.path.basename(filename) != filename
        or os.path.isabs(filename)
    ):
        raise ValueError(f"Invalid mod file name: {filename!r}")
    return os.path.join(mods_dir, filename)


def downloaded_path(name: str) -> Optional[str]:
    """Path of an archive in DOWNLOADS_DIR (the browser's download folder), if it is there.
    Browsers save a name clash as "name (1).zip", so the newest such copy also counts."""
    downloads_dir = os.getenv("DOWNLOADS_DIR", "")
    if not downloads_dir:
        return None
    try:
        path = mod_file_path(downloads_dir, name)
    except ValueError:
        return None
    if os.path.exists(path):
        return path
    stem, ext = os.path.splitext(name)
    renamed = re.compile(rf"{re.escape(stem)} \(\d+\){re.escape(ext)}")
    copies = [
        os.path.join(downloads_dir, f) for f in os.listdir(downloads_dir) if renamed.fullmatch(f)
    ]
    return max(copies, key=os.path.getmtime) if copies else None
