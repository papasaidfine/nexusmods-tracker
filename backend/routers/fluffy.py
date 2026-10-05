"""
Fluffy router - carry installed mod options over to a new mod version in Fluffy Mod Manager.

Flow: prepare (scan new archives, write an uninstall and an install preset, restart
Fluffy) -> user clicks the two presets in Fluffy -> session reports progress from
installed.ini -> finalize (promote updates in the DB, delete old archives).
"""
import json
import os
import shutil
import threading
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import fluffy
from database import get_all_mods, get_mod_by_id
from paths import mod_file_path
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
    mods_dir = os.getenv("MODS_DIR", "")
    if not mods_dir:
        raise HTTPException(status_code=500, detail="MODS_DIR not configured")
    return mods_dir


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
    installed_ids = {str(o.mod_id) for o in _fluffy_call(fluffy.read_installed)}
    all_done = True
    for mod in session["mods"]:
        for m in mod["matched"]:
            m["old_installed"] = m["old"]["mod_id"] in installed_ids
            m["new_installed"] = m["new"]["mod_id"] in installed_ids
        for r in mod["removed"]:
            r["old_installed"] = r["old"]["mod_id"] in installed_ids
        mod["done"] = (
            not any(m["old_installed"] or not m["new_installed"] for m in mod["matched"])
            and not any(r["old_installed"] for r in mod["removed"])
        )
        all_done = all_done and mod["done"]
    session["done"] = all_done
    return session


def _downloaded_path(name: str) -> Optional[str]:
    """Path of an archive in DOWNLOADS_DIR (the browser's download folder), if it is there."""
    downloads_dir = os.getenv("DOWNLOADS_DIR", "")
    if not downloads_dir:
        return None
    try:
        path = mod_file_path(downloads_dir, name)
    except ValueError:
        return None
    return path if os.path.exists(path) else None


def _downloaded_archive(mod: dict, mods_dir: str) -> Optional[str]:
    """The downloaded update: Nexusmods' file_name in the Mods or Downloads folder.
    Browsers keep that name, and a mod's files differ only by it, so no fuzzy matching."""
    latest = mod.get("latest_file_name")
    if latest and (os.path.exists(os.path.join(mods_dir, latest)) or _downloaded_path(latest)):
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
    installed = _fluffy_call(fluffy.read_installed)
    cache = fluffy.known_options(installed, _fluffy_call(fluffy.read_cache_with_retry))
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
    return {"candidates": candidates}


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
                downloaded = _downloaded_path(item.new_archive)
                if not downloaded:
                    raise HTTPException(status_code=400, detail=f"{item.new_archive} is not in the Mods or Downloads folder")
                shutil.move(downloaded, path)
            if item.new_archive == mod["local_file"]:
                raise HTTPException(status_code=400, detail=f"{item.new_archive} is the current file")
            entries.append((mod, item.new_archive))

        installed = _fluffy_call(fluffy.read_installed)
        cache = fluffy.known_options(installed, _fluffy_call(fluffy.read_cache_with_retry))

        # Only mods with installed options need Fluffy to know the new archive's option IDs
        cached_archives = {c.archive for c in cache}
        to_scan = [
            new for mod, new in entries
            if fluffy.count_installed_from(mod["local_file"], installed, cache)
            and new not in cached_archives
        ]
        if to_scan:
            scanned = _fluffy_call(fluffy.restart_and_scan, to_scan)
            installed = _fluffy_call(fluffy.read_installed)
            cache = fluffy.known_options(installed, scanned)

        session_mods = []
        for mod, new in entries:
            plan = fluffy.build_plan(mod["local_file"], new, installed, cache)
            if any(m["old"]["mod_id"] == m["new"]["mod_id"] for m in plan["matched"]):
                # Progress tracking relies on old and new options having distinct IDs
                raise HTTPException(
                    status_code=409,
                    detail=f"Fluffy gives {mod['local_file']} and {new} the same option IDs; update it manually",
                )
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

        # Presets keep the global install order from installed.ini
        order = {str(o.mod_id): i for i, o in enumerate(installed)}
        uninstall = [m["old"] for s in session_mods for m in s["matched"]] + \
                    [r["old"] for s in session_mods for r in s["removed"]]
        uninstall.sort(key=lambda e: order[e["mod_id"]])
        install = sorted(
            (m for s in session_mods for m in s["matched"]),
            key=lambda m: order[m["old"]["mod_id"]],
        )

        session = {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "uninstall_preset": UNINSTALL_PRESET if uninstall else None,
            "install_preset": INSTALL_PRESET if install else None,
            "mods": session_mods,
        }
        fluffy.delete_tracker_presets()
        if uninstall:
            fluffy.write_preset(UNINSTALL_PRESET, uninstall)
        if install:
            fluffy.write_preset(INSTALL_PRESET, [m["new"] for m in install])
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
    finally:
        _lock.release()


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
        updated, errors, leftover = [], [], []
        for s in session["mods"]:
            mod = get_mod_by_id(s["mod_db_id"])
            if not mod:
                errors.append({"mod_db_id": s["mod_db_id"], "error": "Mod no longer tracked"})
                continue
            try:
                apply_update(mod, s["new_archive"])
                updated.append(s["mod_db_id"])
            except HTTPException as e:
                errors.append({"mod_db_id": s["mod_db_id"], "error": e.detail})
                continue
            if os.path.exists(os.path.join(mods_dir, s["old_archive"])):
                leftover.append(s["old_archive"])

        _clear_session()
        return {"updated": updated, "errors": errors, "leftover_old_archives": leftover}
    finally:
        _lock.release()


@router.post("/cancel")
def cancel_update():
    """Drop the session and its presets; nothing else is changed."""
    _clear_session()
    return {"message": "Update session cancelled"}
