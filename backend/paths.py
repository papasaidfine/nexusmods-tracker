"""
Helpers for safely resolving files inside MODS_DIR
"""
import os


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
