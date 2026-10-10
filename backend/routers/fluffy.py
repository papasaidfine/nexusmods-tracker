"""
Fluffy router - carry installed mod options over to a new mod version in Fluffy Mod Manager.

Flow: prepare (scan new archives, write an uninstall and an install preset, restart
Fluffy) -> user clicks the two presets in Fluffy -> session reports progress from
installed.ini -> finalize (promote updates in the DB, delete old archives).

Reinstalled options go to the end of the install order, so options that were on
top of them are reinstalled after them, keeping the user's order (see install_order).
On request, the same flow fixes the install order of addons installed before the part
they change.
"""
import collections
import json
import os
import shutil
import threading
from dataclasses import replace
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import fluffy
import games
import install_order
from database import get_all_mods, get_mod_by_id
from paths import downloaded_path, mod_file_path
from routers.mods import apply_update

router = APIRouter()

UNINSTALL_PRESET = f"{fluffy.PRESET_PREFIX}-1-Uninstall"
INSTALL_PRESET = f"{fluffy.PRESET_PREFIX}-2-Install"

_lock = threading.Lock()


class PrepareItem(BaseModel):
    mod_db_id: int
    new_archive: str


class PrepareRequest(BaseModel):
    items: List[PrepareItem]


def _mods_dir() -> str:
    return games.current().mods_dir


def _session_path() -> str:
    return os.path.join(fluffy.game_dir(), "tracker_fluffy_session.json")


def _load_session() -> Optional[dict]:
    path = _session_path()
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _save_session(session: dict) -> None:
    with open(_session_path(), "w", encoding="utf-8") as f:
        json.dump(session, f, ensure_ascii=False, indent=2)


def _held_dir() -> str:
    """Where old archives wait while an update is open (see _hold_old_archives)."""
    return os.path.join(fluffy.game_dir(), "TrackerOldArchives")


def _hold_old_archives(old_archives: List[str], mods_dir: str) -> List[str]:
    """Move old archives out of the Mods folder before Fluffy rescans it.

    Fluffy skips an archive whose contents duplicate one it already lists (e.g. both
    versions use the same folder names inside), so the new version would never show
    up. Fluffy can still uninstall options whose archive is gone.
    """
    os.makedirs(_held_dir(), exist_ok=True)
    held = []
    for name in old_archives:
        src = os.path.join(mods_dir, name)
        if os.path.exists(src):
            shutil.move(src, os.path.join(_held_dir(), name))
            held.append(name)
    return held


def _release_held(held: List[str], mods_dir: str, restore: bool) -> None:
    """Put held archives back in the Mods folder (restore) or delete them."""
    for name in held:
        path = os.path.join(_held_dir(), name)
        if not os.path.exists(path):
            continue
        if restore:
            shutil.move(path, os.path.join(mods_dir, name))
        else:
            os.remove(path)


def _clear_session() -> None:
    fluffy.delete_tracker_presets()
    path = _session_path()
    if os.path.exists(path):
        os.remove(path)


def _fluffy_call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except fluffy.FluffyError as e:
        raise HTTPException(status_code=502, detail=str(e))


def _with_status(session: dict) -> dict:
    """Annotate a session with live progress read from installed.ini."""
    installed = _fluffy_call(fluffy.read_installed)
    installed_ids = {str(o.mod_id) for o in installed}
    all_done = True
    seen_changed = False
    for mod in session["mods"]:
        for m in mod["matched"]:
            if m["old"]["mod_id"] == m["new"]["mod_id"]:
                # Fluffy gave both versions the same ID: the option is updated once it
                # has been seen uninstalled and is installed again
                present = m["new"]["mod_id"] in installed_ids
                if not present and not m.get("uninstall_seen"):
                    m["uninstall_seen"] = seen_changed = True
                m["old_installed"] = present and not m.get("uninstall_seen")
                m["new_installed"] = present and bool(m.get("uninstall_seen"))
                continue
            m["old_installed"] = m["old"]["mod_id"] in installed_ids
            m["new_installed"] = m["new"]["mod_id"] in installed_ids
        for r in mod["removed"]:
            r["old_installed"] = r["old"]["mod_id"] in installed_ids
        mod["done"] = (
            not any(m["old_installed"] or not m["new_installed"] for m in mod["matched"])
            and not any(r["old_installed"] for r in mod["removed"])
        )
        all_done = all_done and mod["done"]
    if session.get("reorder"):
        seen_changed |= _reorder_status(
            session["reorder"], installed, bool(session.get("reorder_fixes_order")))
        all_done = all_done and all(r["done"] for r in session["reorder"])
    session["done"] = all_done
    if seen_changed:
        _save_session(session)
    return session


def _reorder_status(reorder: List[dict], installed: list, fixes_order: bool) -> bool:
    """Mark reinstalled options. They keep their IDs, so removal is only seen by
    polling (uninstall_seen). When fixing the install order, an option is done once
    installed again and either seen removed or in place (nothing that belongs under
    it installed later); when reinstalled to keep the order, once installed.
    Returns whether uninstall_seen changed."""
    by_id, last = {}, {}
    if fixes_order:
        options = _order_options(installed, fluffy.known_options(
            installed, _fluffy_call(fluffy.read_cache_with_retry)))
        by_id = {o.mod_id: o for o in options}
        last = install_order.last_writers(options)
    installed_ids = {str(o.mod_id) for o in installed}
    changed = False
    for r in reorder:
        present = r["option"]["mod_id"] in installed_ids
        if not present and not r.get("uninstall_seen"):
            r["uninstall_seen"] = changed = True
        r["installed"] = present
        if fixes_order:
            o = by_id.get(r["option"]["mod_id"])
            r["in_place"] = o is not None and not install_order.misordered_files(o, last)
            r["done"] = present and (r["in_place"] or bool(r.get("uninstall_seen")))
        else:
            r["in_place"] = r["done"] = present
    return changed


def _families() -> dict:
    """Archive -> Nexus mod ID of tracked mods, so a mod's archives (AIO, nsfw
    pack, ...) are ordered as one mod."""
    return {m["local_file"]: str(m["mod_id"]) for m in get_all_mods()}


def _order_options(installed: list, cache: list) -> List[install_order.Option]:
    return install_order.load_options(installed, cache, _families())


# Checking means hashing game files; reuse the result until installed.ini changes
_issues_cache: dict = {}


def _install_order_issues(installed: list, cache: list):
    """(options, issues, whether game files could be compared) for the current installed.ini."""
    path = fluffy.installed_ini_path()
    st = os.stat(path)
    key = (path, st.st_mtime_ns, st.st_size)
    if _issues_cache.get("key") != key:
        options = _order_options(installed, cache)
        game_dir = install_order.game_install_dir(os.path.basename(fluffy.game_dir()))
        checker = install_order.ContentChecker(game_dir, _mods_dir())
        issues = install_order.find_issues(options, checker.has_copy)
        _issues_cache.update(key=key, value=(options, issues, game_dir is not None))
    return _issues_cache["value"]


def _option_json(o: install_order.Option) -> dict:
    return {"section": o.section, "archive": o.archive, "position": o.index}


@router.get("/install-order")
def get_install_order():
    """Installed options that lost files to options installed after them."""
    installed = _fluffy_call(fluffy.read_installed)
    cache = fluffy.known_options(installed, _fluffy_call(fluffy.read_cache_with_retry))
    _, issues, game_dir_found = _install_order_issues(installed, cache)
    tracked = {m["local_file"]: m["id"] for m in get_all_mods()}
    return {
        "game_dir_found": game_dir_found,
        "issues": [{
            "kind": i["kind"],
            "option": _option_json(i["option"]),
            "mod_db_id": tracked.get(i["option"].archive),
            "files": i["files"],
            "overridden_by": [_option_json(w) for w in i["overridden_by"]],
            "verified": i["verified"],
        } for i in issues],
    }


@router.post("/fix-order")
def fix_install_order():
    """Reinstall misordered options on top of what they overlay: write an uninstall
    and an install preset and restart Fluffy, like an update."""
    if not _lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Another Fluffy operation is in progress")
    try:
        if _load_session():
            raise HTTPException(status_code=409, detail="An update session is already open")
        installed = _fluffy_call(fluffy.read_installed)
        cache = fluffy.known_options(installed, _fluffy_call(fluffy.read_cache_with_retry))
        options, issues, _ = _install_order_issues(installed, cache)
        moving = [i["option"] for i in issues if i["kind"] == "misordered"]
        if not moving:
            raise HTTPException(status_code=400, detail="No install order problems to fix")
        moving_ids = {id(o) for o in moving}
        ordered = install_order.reinstall_order(
            moving, [o for o in options if id(o) not in moving_ids], install_order.must_follow)
        session = {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "held_archives": [],
            "mods": [],
            "reorder": [_reorder_item(o) for o in ordered],
            "reorder_fixes_order": True,
        }
        try:
            return _write_presets_and_restart(
                session,
                uninstall=[o.entry() for o in sorted(ordered, key=lambda o: o.index)],
                install=[o.entry() for o in ordered],
            )
        except Exception:
            _clear_session()
            raise
    finally:
        _lock.release()


def _reorder_item(o: install_order.Option) -> dict:
    return {"folder": o.folder or o.section, "archive": o.archive, "option": o.entry()}


def _downloaded_archive(mod: dict, mods_dir: str) -> Optional[str]:
    """The downloaded update: Nexusmods' file_name in the Mods or Downloads folder.
    Browsers keep that name, and a mod's files differ only by it, so no fuzzy matching."""
    latest = mod.get("latest_file_name")
    if latest and (os.path.exists(os.path.join(mods_dir, latest)) or downloaded_path(latest)):
        return latest
    return None


@router.get("/status")
def get_status():
    """Whether Fluffy is reachable and running, and whether an update session is open."""
    try:
        running = fluffy.is_running()
        error = None
    except fluffy.FluffyError as e:
        running, error = None, str(e)
    return {
        "running": running,
        "error": error,
        "installed_ini": os.path.exists(fluffy.installed_ini_path()),
        "session_active": os.path.exists(_session_path()),
    }


@router.get("/candidates")
def list_candidates():
    """Mods with a pending update, with their downloaded archive and installed option count."""
    mods_dir = _mods_dir()
    mods = get_all_mods()
    try:
        installed = fluffy.read_installed()
        cache = fluffy.known_options(installed, fluffy.read_cache_with_retry())
        fluffy_error = None
    except (fluffy.FluffyError, OSError) as e:
        # Still list pending updates, just without Fluffy's side
        installed, cache, fluffy_error = [], [], str(e)
    candidates = []
    for mod in mods:
        if not (mod.get("update_available") and mod.get("latest_file_id")):
            continue
        candidates.append({
            "mod_db_id": mod["id"],
            "mod_name": mod.get("mod_name"),
            "name": mod.get("name"),
            "author": mod.get("author"),
            "version": mod.get("version"),
            "latest_version": mod.get("latest_version"),
            "old_archive": mod["local_file"],
            "old_exists": os.path.exists(os.path.join(mods_dir, mod["local_file"])),
            "new_archive": _downloaded_archive(mod, mods_dir),
            "installed_count": fluffy.count_installed_from(mod["local_file"], installed, cache),
        })
    candidates.sort(key=lambda c: ((c["mod_name"] or "").lower(), c["old_archive"]))

    # Options installed in Fluffy for every tracked mod, for the "In Fluffy" view
    archive_of = {c.mod_id: c.archive for c in cache}
    per_archive = collections.Counter(archive_of.get(o.mod_id) for o in installed)
    installed_counts = {m["id"]: per_archive[m["local_file"]] for m in mods if per_archive[m["local_file"]]}
    return {"candidates": candidates, "installed_counts": installed_counts, "fluffy_error": fluffy_error}


@router.get("/session")
def get_session():
    session = _load_session()
    return _with_status(session) if session else None


@router.post("/prepare")
def prepare_update(req: PrepareRequest):
    """Plan the update, write the two presets and restart Fluffy so it loads them."""
    if not req.items:
        raise HTTPException(status_code=400, detail="No mods selected")
    if not _lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Another Fluffy operation is in progress")
    try:
        if _load_session():
            raise HTTPException(status_code=409, detail="An update session is already open")
        mods_dir = _mods_dir()

        entries = []
        for item in req.items:
            mod = get_mod_by_id(item.mod_db_id)
            if not mod:
                raise HTTPException(status_code=404, detail=f"Mod {item.mod_db_id} not found")
            if not (mod.get("update_available") and mod.get("latest_file_id")):
                raise HTTPException(status_code=400, detail=f"{mod['local_file']} has no pending update")
            try:
                path = mod_file_path(mods_dir, item.new_archive)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
            if not os.path.exists(path):
                downloaded = downloaded_path(item.new_archive)
                if not downloaded:
                    raise HTTPException(status_code=400, detail=f"{item.new_archive} is not in the Mods or Downloads folder")
                shutil.move(downloaded, path)
            if item.new_archive == mod["local_file"]:
                raise HTTPException(status_code=400, detail=f"{item.new_archive} is the current file")
            entries.append((mod, item.new_archive))

        # Read (and remember) the old archives' options before they leave the Mods folder
        installed = _fluffy_call(fluffy.read_installed)
        cache = fluffy.known_options(installed, _fluffy_call(fluffy.read_cache_with_retry))
        held = _hold_old_archives([mod["local_file"] for mod, _ in entries], mods_dir)
        try:
            return _plan_and_write_presets(entries, installed, cache, held)
        except Exception:
            _clear_session()
            _release_held(held, mods_dir, restore=True)
            raise
    finally:
        _lock.release()


def _plan_and_write_presets(entries: list, installed: list, cache: list, held: List[str]) -> dict:
    """cache is from before the old archives were held aside (see build_plan)."""
    # Only mods with installed options need Fluffy to know the new archive's option IDs
    cached_archives = {c.archive for c in cache}
    to_scan = [
        new for mod, new in entries
        if fluffy.count_installed_from(mod["local_file"], installed, cache)
        and new not in cached_archives
    ]
    new_cache = cache
    if to_scan:
        new_cache = _fluffy_call(fluffy.restart_and_scan, to_scan)
        installed = _fluffy_call(fluffy.read_installed)

    session_mods = []
    for mod, new in entries:
        plan = fluffy.build_plan(mod["local_file"], new, installed, cache, new_cache)
        session_mods.append({
            "mod_db_id": mod["id"],
            "mod_name": mod.get("mod_name"),
            "name": mod.get("name"),
            "old_version": mod.get("version"),
            "new_version": mod.get("latest_version") or plan["new_version"],
            "old_archive": mod["local_file"],
            "new_archive": new,
            "matched": plan["matched"],
            "removed": plan["removed"],
            "added": plan["added"],
        })

    # New options take their old option's place in the install order (and its files,
    # close enough for ordering). Reinstalling appends them, so options the user
    # installed on top of the old ones are reinstalled too, keeping the user's order.
    options = _order_options(installed, cache)
    by_id = {o.mod_id: o for o in options}
    moving = [
        replace(by_id[m["old"]["mod_id"]], **m["new"])
        for s in session_mods for m in s["matched"]
    ]
    replaced = {m["old"]["mod_id"] for s in session_mods for m in s["matched"]} | \
               {r["old"]["mod_id"] for s in session_mods for r in s["removed"]}
    ordered = install_order.reinstall_order(moving, [o for o in options if o.mod_id not in replaced])
    moving_ids = {id(o) for o in moving}
    extra = [o for o in ordered if id(o) not in moving_ids]

    uninstall = [m["old"] for s in session_mods for m in s["matched"]] + \
                [r["old"] for s in session_mods for r in s["removed"]] + \
                [o.entry() for o in extra]
    order = {o.mod_id: o.index for o in options}
    uninstall.sort(key=lambda e: order[e["mod_id"]])

    session = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "held_archives": held,
        "mods": session_mods,
        "reorder": [_reorder_item(o) for o in extra],
    }
    return _write_presets_and_restart(session, uninstall, [o.entry() for o in ordered])


def _write_presets_and_restart(session: dict, uninstall: List[dict], install: List[dict]) -> dict:
    session["uninstall_preset"] = UNINSTALL_PRESET if uninstall else None
    session["install_preset"] = INSTALL_PRESET if install else None
    fluffy.delete_tracker_presets()
    if uninstall:
        fluffy.write_preset(UNINSTALL_PRESET, uninstall)
    if install:
        fluffy.write_preset(INSTALL_PRESET, install)
    _save_session(session)

    # Fluffy reads presets only at startup. The presets are written either way,
    # so a failed restart only means the user has to restart Fluffy themselves.
    warning = None
    if uninstall or install:
        try:
            fluffy.close()
            fluffy.start()
        except fluffy.FluffyError as e:
            warning = f"{e}. Restart Fluffy yourself to load the presets."

    result = _with_status(session)
    result["warning"] = warning
    return result


@router.post("/finalize")
def finalize_update():
    """After the presets were applied: promote updates in the DB and delete old archives."""
    if not _lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Another Fluffy operation is in progress")
    try:
        session = _load_session()
        if not session:
            raise HTTPException(status_code=404, detail="No update session")
        session = _with_status(session)
        if not session["done"]:
            raise HTTPException(status_code=400, detail="Presets have not been fully applied in Fluffy yet")

        mods_dir = _mods_dir()
        held = set(session.get("held_archives", []))
        updated, errors, leftover = [], [], []
        for s in session["mods"]:
            old = s["old_archive"]
            mod = get_mod_by_id(s["mod_db_id"])
            try:
                if not mod:
                    raise HTTPException(status_code=404, detail="Mod no longer tracked")
                apply_update(mod, s["new_archive"])
                updated.append(s["mod_db_id"])
            except HTTPException as e:
                errors.append({"mod_db_id": s["mod_db_id"], "error": e.detail})
                if old in held:
                    _release_held([old], mods_dir, restore=True)
                continue
            if old in held:
                _release_held([old], mods_dir, restore=False)
            if os.path.exists(os.path.join(mods_dir, old)):
                leftover.append(old)

        _clear_session()
        return {"updated": updated, "errors": errors, "leftover_old_archives": leftover}
    finally:
        _lock.release()


@router.post("/cancel")
def cancel_update():
    """Drop the session and its presets, and put held old archives back."""
    if not _lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Another Fluffy operation is in progress")
    try:
        session = _load_session()
        if session:
            _release_held(session.get("held_archives", []), _mods_dir(), restore=True)
        _clear_session()
        return {"message": "Update session cancelled"}
    finally:
        _lock.release()
