"""
Read/write Fluffy Mod Manager state and control the Fluffy process.

Fluffy has no API, so this works through its files (formats reverse-engineered
from a real install, Fluffy v3.07x):
- installed.ini: one [section] per installed mod option, in install order
- ModinfoCache.bin: every option Fluffy has scanned, with its archive and ID
- Presets/*.prt: a list of options; clicking a preset in Fluffy installs it
  (or uninstalls it if already installed). Presets are only read at startup.

Strings are decoded as latin-1 so bytes round-trip exactly (Fluffy is ANSI).
"""
import json
import os
import struct
import subprocess
import time
from dataclasses import asdict, dataclass, field
from typing import Dict, List, Optional

ENCODING = "latin-1"
EXE_NAME = "Modmanager.exe"
CACHE_MAGIC = b"MICH"
CACHE_STRING_FIELDS = 22
CACHE_TAIL_SIZE = 43
PRESET_PREFIX = "TrackerUpdate"


@dataclass
class InstalledOption:
    section: str
    mod_name: str
    mod_id: int
    short_id: int
    install_type: str = ""
    files: List[str] = field(default_factory=list)


@dataclass
class CachedOption:
    folder: str
    name: str
    archive: str
    version: str
    mod_id: int
    short_id: int


class FluffyError(Exception):
    pass


def game_dir() -> str:
    """Fluffy's per-game folder (parent of MODS_DIR)."""
    mods_dir = os.getenv("MODS_DIR", "")
    if not mods_dir:
        raise FluffyError("MODS_DIR not configured")
    return os.path.dirname(os.path.normpath(mods_dir))


def fluffy_root() -> str:
    """Fluffy install folder: <root>/Games/<Game>/Mods."""
    return os.path.dirname(os.path.dirname(game_dir()))


def installed_ini_path() -> str:
    return os.path.join(game_dir(), "installed.ini")


def cache_path() -> str:
    return os.path.join(game_dir(), "ModinfoCache.bin")


def presets_dir() -> str:
    return os.path.join(game_dir(), "Presets")


# ---------------------------------------------------------------------------
# File formats
# ---------------------------------------------------------------------------

def read_installed(path: Optional[str] = None) -> List[InstalledOption]:
    """Parse installed.ini, preserving install order."""
    options: List[InstalledOption] = []
    current: Optional[InstalledOption] = None
    with open(path or installed_ini_path(), encoding=ENCODING, newline="") as f:
        for raw in f:
            line = raw.rstrip("\r\n")
            if line.startswith("[") and line.endswith("]"):
                current = InstalledOption(section=line[1:-1], mod_name="", mod_id=0, short_id=0)
                options.append(current)
                continue
            if current is None or "=" not in line:
                continue
            key, value = line.split("=", 1)
            if key == "ModID_v1":
                current.mod_id = int(value)
            elif key == "ShortModID_v1":
                current.short_id = int(value)
            elif key == "ModName":
                current.mod_name = value
            elif key == "installtype":
                current.install_type = value
            elif key == "file":
                current.files.append(value)
    return options


def read_cache(path: Optional[str] = None) -> List[CachedOption]:
    """Parse ModinfoCache.bin.

    Layout: u32 version, b"MICH", u32 count, then per record 22 length-prefixed
    strings (folder, name, screenshot, author, description, version, homepage,
    ..., NameAsBundle, archive, categories...) followed by a 43-byte tail:
    2 flag bytes, archive FILETIME, archive size, ModID_v1, ShortModID_v1, 9 bytes.
    """
    with open(path or cache_path(), "rb") as f:
        data = f.read()
    if data[4:8] != CACHE_MAGIC:
        raise FluffyError("Unrecognized ModinfoCache.bin format")
    (count,) = struct.unpack_from("<I", data, 8)
    pos = 12
    options: List[CachedOption] = []
    try:
        for _ in range(count):
            strings = []
            for _ in range(CACHE_STRING_FIELDS):
                (n,) = struct.unpack_from("<I", data, pos)
                strings.append(data[pos + 4:pos + 4 + n].decode(ENCODING))
                pos += 4 + n
            mod_id, short_id = struct.unpack_from("<QQ", data, pos + 18)
            pos += CACHE_TAIL_SIZE
            options.append(CachedOption(
                folder=strings[0],
                name=strings[1],
                version=strings[5],
                archive=strings[10],
                mod_id=mod_id,
                short_id=short_id,
            ))
    except struct.error as e:
        raise FluffyError(f"Truncated ModinfoCache.bin: {e}")
    if pos != len(data):
        raise FluffyError("Unexpected trailing data in ModinfoCache.bin")
    return options


def read_cache_with_retry(attempts: int = 5) -> List[CachedOption]:
    """Fluffy may be rewriting the cache while we read it."""
    for i in range(attempts):
        try:
            return read_cache()
        except (FluffyError, OSError):
            if i == attempts - 1:
                raise
            time.sleep(1)
    return []


def known_options(installed: List[InstalledOption], cache: List[CachedOption]) -> List[CachedOption]:
    """The cache plus remembered records of installed options whose archive is gone.

    Fluffy drops an archive's options from its cache once the archive is deleted, but
    the options stay installed; remembering them keeps old options mapped to their mod.
    """
    path = os.path.join(game_dir(), "tracker_fluffy_options.json")
    remembered: Dict[str, Dict] = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            remembered = json.load(f)

    installed_ids = {o.mod_id for o in installed}
    cached_ids = {c.mod_id for c in cache}
    remembered.update({str(c.mod_id): asdict(c) for c in cache if c.mod_id in installed_ids})
    remembered = {k: v for k, v in remembered.items() if int(k) in installed_ids}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(remembered, f, ensure_ascii=False)

    return cache + [CachedOption(**v) for k, v in remembered.items() if int(k) not in cached_ids]


def write_preset(title: str, entries: List[Dict]) -> str:
    """Write a preset file. entries: dicts with section, mod_id, short_id, mod_name."""
    lines = ["v2"]
    for e in entries:
        lines += [
            f"[{e['section']}]",
            f"ModID_v1={e['mod_id']}",
            f"ShortModID_v1={e['short_id']}",
            f"ModName={e['mod_name']}",
        ]
    path = os.path.join(presets_dir(), f"{title}.prt")
    os.makedirs(presets_dir(), exist_ok=True)
    with open(path, "w", encoding=ENCODING, newline="") as f:
        f.write("\r\n".join(lines) + "\r\n")
    return path


def delete_tracker_presets() -> None:
    d = presets_dir()
    if not os.path.isdir(d):
        return
    for name in os.listdir(d):
        if name.startswith(PRESET_PREFIX) and name.endswith(".prt"):
            os.remove(os.path.join(d, name))


# ---------------------------------------------------------------------------
# Update planning
# ---------------------------------------------------------------------------

def build_plan(
    old_archive: str,
    new_archive: str,
    installed: List[InstalledOption],
    cache: List[CachedOption],
) -> Dict:
    """Map the options installed from old_archive onto same-named options in new_archive.

    Options are matched by folder name, which carries no version. Returns:
    - matched: old option -> new option, in install order
    - removed: installed old options with no (unique) counterpart in the new archive
    - added: option folders that only exist in the new archive
    """
    by_id = {c.mod_id: c for c in cache}
    old_records = [c for c in cache if c.archive == old_archive]
    new_records = [c for c in cache if c.archive == new_archive]

    new_by_folder: Dict[str, List[CachedOption]] = {}
    for c in new_records:
        new_by_folder.setdefault(c.folder, []).append(c)

    matched, removed = [], []
    for opt in installed:
        rec = by_id.get(opt.mod_id)
        if not rec or rec.archive != old_archive:
            continue
        old = {"section": opt.section, "mod_id": str(opt.mod_id),
               "short_id": str(opt.short_id), "mod_name": opt.mod_name}
        candidates = new_by_folder.get(rec.folder, [])
        if len(candidates) == 1:
            new = candidates[0]
            matched.append({"folder": rec.folder, "old": old, "new": {
                "section": new.folder, "mod_id": str(new.mod_id),
                "short_id": str(new.short_id), "mod_name": new.name}})
        else:
            removed.append({"folder": rec.folder, "old": old})

    old_folders = {c.folder for c in old_records}
    added = sorted({c.folder for c in new_records} - old_folders)

    return {
        "old_in_cache": bool(old_records),
        "new_in_cache": bool(new_records),
        "new_version": new_records[0].version if new_records else None,
        "matched": matched,
        "removed": removed,
        "added": added,
    }


def count_installed_from(archive: str, installed: List[InstalledOption],
                         cache: List[CachedOption]) -> int:
    ids = {c.mod_id for c in cache if c.archive == archive}
    return sum(1 for o in installed if o.mod_id in ids)


# ---------------------------------------------------------------------------
# Process control (Fluffy runs on Windows; we run in WSL)
# ---------------------------------------------------------------------------

def _windows_path(path: str) -> str:
    return subprocess.run(["wslpath", "-w", path], capture_output=True,
                          text=True, check=True).stdout.strip()


def is_running() -> bool:
    try:
        out = subprocess.run(
            ["tasklist.exe", "/FI", f"IMAGENAME eq {EXE_NAME}", "/NH"],
            capture_output=True, text=True, timeout=15,
        ).stdout
    except (OSError, subprocess.TimeoutExpired) as e:
        raise FluffyError(f"Cannot query Windows processes: {e}")
    return EXE_NAME.lower() in out.lower()


def _wait(predicate, timeout: float, interval: float = 1.0) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(interval)
    return predicate()


def close(timeout: float = 30) -> None:
    """Ask Fluffy to close normally (no /F), so it can save its state."""
    if not is_running():
        return
    subprocess.run(["taskkill.exe", "/IM", EXE_NAME], capture_output=True, timeout=15)
    if not _wait(lambda: not is_running(), timeout):
        raise FluffyError("Fluffy did not close; check whether it is showing a dialog")


def start(timeout: float = 30) -> None:
    root = fluffy_root()
    exe = os.path.join(root, EXE_NAME)
    if not os.path.exists(exe):
        raise FluffyError(f"{EXE_NAME} not found in {root}")
    # Fluffy inherits cmd.exe's handles, so don't wait on its output; Popen and move on
    subprocess.Popen(
        ["cmd.exe", "/c", "start", "", "/D", _windows_path(root), _windows_path(exe)],
        cwd=root, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL, start_new_session=True,
    )
    if not _wait(is_running, timeout):
        raise FluffyError("Fluffy did not start")


def restart_and_scan(archives: List[str], timeout: float = 90) -> List[CachedOption]:
    """Restart Fluffy and wait until its cache lists all the given archives."""
    close()
    start()

    def scanned() -> bool:
        try:
            names = {c.archive for c in read_cache()}
        except (FluffyError, OSError):
            return False
        return all(a in names for a in archives)

    if not _wait(scanned, timeout, interval=2):
        raise FluffyError("Fluffy did not pick up the new archives; are they valid mods?")
    return read_cache_with_retry()
