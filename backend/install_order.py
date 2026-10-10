"""
Install order of Fluffy options.

Fluffy installs an option by copying its files into the game folder, so when two
installed options share a file, the one installed later wins. Ver.R-style mods rely on
that: an addon or physics option replaces one or two files of a part (body, legs, ...)
and only works when installed after that part. installed.ini records the install
order, and normally the user's order stands (keeps_order). Only on request does this
module find options that lost files to an option that belongs before them
(must_follow) and order a reinstall so each ends up on top of what it overlays.
Reinstalling appends an option to the end of installed.ini, after everything else.
"""
import collections
import heapq
import os
import re
import subprocess
import zipfile
import zlib
from dataclasses import dataclass, field
from typing import Callable, Dict, Iterable, List, Optional, Set, Tuple

from fluffy import CachedOption, InstalledOption, fluffy_root


@dataclass(eq=False)
class Option:
    """An installed option (or the new version of one), compared by identity."""
    index: int  # position in install order
    section: str
    mod_id: str
    short_id: str
    mod_name: str
    archive: Optional[str]
    folder: Optional[str]
    # Options of one Nexus mod share a family (one archive's options if untracked)
    family: str
    files: Set[str]  # normalized with norm()
    dir_counts: Dict[str, int] = field(default_factory=dict)

    def __post_init__(self):
        self.dir_counts = collections.Counter(part_dir(f) for f in self.files)

    def entry(self) -> Dict:
        """Preset entry / session record."""
        return {"section": self.section, "mod_id": self.mod_id,
                "short_id": self.short_id, "mod_name": self.mod_name}


def norm(path: str) -> str:
    return path.replace("\\", "/").lower()


def part_dir(f: str) -> str:
    """The folder of one armor part, the same for its male (ch02) and female (ch03)
    model folders: an F-M body ships male physics next to the female mesh."""
    return re.sub(r"/ch0[23]/", "/ch0x/", os.path.dirname(f))


def load_options(installed: List[InstalledOption], cache: List[CachedOption],
                 families: Dict[str, str]) -> List[Option]:
    """families: archive file name -> family key (e.g. the tracked Nexus mod ID)."""
    by_id = {c.mod_id: c for c in cache}
    options = []
    for i, o in enumerate(installed):
        rec = by_id.get(o.mod_id)
        archive = rec.archive if rec else None
        options.append(Option(
            index=i, section=o.section, mod_id=str(o.mod_id), short_id=str(o.short_id),
            mod_name=o.mod_name, archive=archive, folder=rec.folder if rec else None,
            family=families.get(archive or "") or archive or o.section,
            files={norm(f) for f in o.files},
        ))
    return options


Follows = Callable[["Option", "Option"], bool]


def keeps_order(a: Option, b: Option) -> bool:
    """Whether a belongs after b in the user's own install order."""
    return a.index > b.index


def must_follow(a: Option, b: Option) -> bool:
    """Whether a belongs after b, for two options that share files.

    Within one mod, the option with fewer files in the parts they share overlays the
    other (an addon swaps a part's material, the part itself ships mesh, material,
    physics...), so it goes last. Across mods, or on a tie (e.g. two options that
    each ship the same prefab), keep the user's order.
    """
    if a.family == b.family:
        dirs = {part_dir(f) for f in a.files & b.files}
        diff = sum(a.dir_counts[d] - b.dir_counts[d] for d in dirs)
        if diff:
            return diff < 0
    return a.index > b.index


def last_writers(options: List[Option]) -> Dict[str, Option]:
    """File -> the option whose copy is in the game folder (the last one installed)."""
    last: Dict[str, Option] = {}
    for o in sorted(options, key=lambda o: o.index):
        for f in o.files:
            last[f] = o
    return last


def misordered_files(option: Option, last: Dict[str, Option]) -> List[Tuple[str, Option]]:
    """Files option lost to a later option that belongs before it."""
    return [(f, last[f]) for f in sorted(option.files)
            if last[f] is not option and must_follow(option, last[f])]


# ---------------------------------------------------------------------------
# Checking the game folder
# ---------------------------------------------------------------------------

def game_install_dir(game_folder_name: str) -> Optional[str]:
    """The game's install folder (WSL path), from Fluffy's Data/config.cfg.

    config.cfg has "modman_<game>_dir: c:/...\\MonsterHunterWilds" lines; the one whose
    folder name matches Fluffy's game folder (Games/<name>) is ours.
    """
    path = os.path.join(fluffy_root(), "Data", "config.cfg")
    if not os.path.exists(path):
        return None
    with open(path, encoding="latin-1") as f:
        dirs = [line.split(":", 1)[1].strip() for line in f
                if line.startswith("modman_") and line.split(":", 1)[0].endswith("_dir")]
    for win_path in dirs:
        win_path = win_path.replace("\\", "/").rstrip("/")
        if win_path.rsplit("/", 1)[-1].lower() != game_folder_name.lower():
            continue
        try:
            wsl = subprocess.run(["wslpath", "-u", win_path], capture_output=True,
                                 text=True, check=True).stdout.strip()
        except (OSError, subprocess.CalledProcessError):
            return None
        return wsl if os.path.isdir(wsl) else None
    return None


class ContentChecker:
    """Whether the game folder holds an option's copy of a file, by CRC-32.

    Zip archives store each file's CRC, so nothing is extracted. Other archives
    (rar, 7z) and missing archives can't be checked (None).
    """

    def __init__(self, game_dir: Optional[str], mods_dir: str):
        self.game_dir = game_dir
        self.mods_dir = mods_dir
        self._archive_crcs: Dict[str, Optional[Dict[str, int]]] = {}
        self._game_crcs: Dict[str, Optional[int]] = {}

    def _crcs(self, archive: str) -> Optional[Dict[str, int]]:
        """'<option folder>/<file>' (normalized) -> CRC for every file in a zip."""
        if archive not in self._archive_crcs:
            path = os.path.join(self.mods_dir, archive)
            crcs = None
            if archive.lower().endswith(".zip") and os.path.exists(path):
                try:
                    with zipfile.ZipFile(path) as z:
                        crcs = {norm(i.filename): i.CRC for i in z.infolist() if not i.is_dir()}
                except (zipfile.BadZipFile, OSError):
                    crcs = None
            self._archive_crcs[archive] = crcs
        return self._archive_crcs[archive]

    def _game_crc(self, f: str) -> Optional[int]:
        if f not in self._game_crcs:
            crc = None
            path = os.path.join(self.game_dir, f) if self.game_dir else None
            if path and os.path.exists(path):
                crc = 0
                with open(path, "rb") as fh:
                    while chunk := fh.read(1 << 20):
                        crc = zlib.crc32(chunk, crc)
            self._game_crcs[f] = crc
        return self._game_crcs[f]

    def has_copy(self, option: Option, f: str) -> Optional[bool]:
        if not (option.archive and option.folder and self.game_dir):
            return None
        crcs = self._crcs(option.archive)
        if crcs is None:
            return None
        # The option folder may sit under a top-level folder in the archive
        suffix = f"{norm(option.folder)}/{f}"
        crc = next((c for name, c in crcs.items()
                    if name == suffix or name.endswith("/" + suffix)), None)
        if crc is None:
            return None
        game = self._game_crc(f)
        return None if game is None else game == crc


def find_issues(options: List[Option], has_copy: Callable[[Option, str], Optional[bool]]) -> List[Dict]:
    """Options whose files in the game folder are another option's copy.

    kind "misordered": lost files to a later option it should have been installed
    after (fixable by reinstalling). kind "overridden": every file replaced by options
    that legitimately come later, e.g. two variants of one armor; informational.
    Files whose replacement has identical content don't count. verified is False when
    some lost file couldn't be compared.
    """
    last = last_writers(options)
    issues = []
    for o in options:
        lost = [(f, last[f]) for f in sorted(o.files) if last[f] is not o]
        if not lost:
            continue
        kept = [(f, w, has_copy(o, f)) for f, w in lost]
        kept = [(f, w, same) for f, w, same in kept if same is not True]
        misordered = [(f, w, same) for f, w, same in kept if must_follow(o, w)]
        if misordered:
            kind, files = "misordered", misordered
        elif kept and len(kept) == len(o.files):
            kind, files = "overridden", kept
        else:
            continue
        winners = {id(w): w for _, w, _ in files}
        issues.append({
            "kind": kind,
            "option": o,
            "files": [f for f, _, _ in files],
            "overridden_by": sorted(winners.values(), key=lambda w: w.index),
            "verified": all(same is False for _, _, same in files),
        })
    return issues


# ---------------------------------------------------------------------------
# Planning a reinstall
# ---------------------------------------------------------------------------

def reinstall_order(moving: List[Option], staying: Iterable[Option],
                    follows: Follows = keeps_order) -> List[Option]:
    """Options to reinstall, in install order.

    Reinstalling appends moving after every other option. A staying option that
    must remain after one of them is reinstalled too (and so on). Within the
    result, options sharing files are ordered by follows; others keep their order.
    With keeps_order (moving options carry the position they replace), every
    option ends up on top of the same options as before.
    """
    by_file: Dict[str, List[Option]] = collections.defaultdict(list)
    for o in staying:
        for f in o.files:
            by_file[f].append(o)

    result = list(moving)
    chosen = {id(o) for o in moving}
    queue = list(moving)
    while queue:
        m = queue.pop()
        for f in m.files:
            for w in by_file.get(f, ()):
                if id(w) not in chosen and follows(w, m):
                    chosen.add(id(w))
                    result.append(w)
                    queue.append(w)
    return _sort(result, follows)


def _sort(options: List[Option], follows: Follows) -> List[Option]:
    """Topological sort on follows between options that share files, earliest
    install position first among the ready ones (and to break any cycle)."""
    after = {id(o): [] for o in options}  # b -> options that must follow b
    pending = {id(o): 0 for o in options}
    for i, a in enumerate(options):
        for b in options[i + 1:]:
            if not (a.files & b.files):
                continue
            first, second = (b, a) if follows(a, b) else (a, b)
            after[id(first)].append(second)
            pending[id(second)] += 1

    remaining = {id(o): o for o in options}
    ready = [(o.index, id(o)) for o in options if pending[id(o)] == 0]
    heapq.heapify(ready)
    ordered = []
    while remaining:
        if not ready:  # cycle: release the earliest remaining option
            o = min(remaining.values(), key=lambda o: o.index)
            ready = [(o.index, id(o))]
        _, key = heapq.heappop(ready)
        if key not in remaining:
            continue
        o = remaining.pop(key)
        ordered.append(o)
        for nxt in after[key]:
            pending[id(nxt)] -= 1
            if pending[id(nxt)] == 0 and id(nxt) in remaining:
                heapq.heappush(ready, (nxt.index, id(nxt)))
    return ordered
