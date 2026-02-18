"""
Updates router - Check for mod updates
"""
from fastapi import APIRouter, HTTPException
from typing import List
from datetime import datetime, timezone
from models import UpdateInfo
from database import get_all_mods, update_mod
from nexusmods_client import get_nexusmods_client

router = APIRouter()

def check_mod_update(mod: dict) -> dict:
    """Check if a single mod has updates available"""
    client = get_nexusmods_client()

    try:
        # Get all files for this mod
        files = client.get_mod_files(mod['game'], mod['mod_id'])

        # Filter out ARCHIVED files (old versions)
        active_files = [
            f for f in files
            if f.get('category_name') not in ['ARCHIVED', 'OLD_VERSION']
        ]

        # Filter files by name (used to distinguish multiple files under the same mod)
        pattern = mod.get('name', '')
        if pattern:
            matching_files = [f for f in active_files if pattern in f.get('name', '')]
        else:
            matching_files = active_files

        if not matching_files:
            return None

        # Find the latest file by file_id
        latest_file = max(matching_files, key=lambda f: f.get('file_id', 0))

        # Check if it's newer than current
        current_file_id = mod['file_id']
        latest_file_id = latest_file.get('file_id')

        update_available = latest_file_id > current_file_id

        # Persist check results
        update_mod(mod['id'], {
            'update_available': update_available,
            'last_checked': datetime.utcnow().isoformat(),
            'latest_file_id': latest_file_id if update_available else None,
            'latest_version': latest_file.get('version') if update_available else None,
            'latest_file_name': latest_file.get('file_name') if update_available else None,
        })

        if update_available:
            download_url = client.get_download_link(
                mod['game'],
                mod['mod_id'],
                latest_file_id
            )

            return {
                'mod_id': mod['mod_id'],
                'local_file': mod['local_file'],
                'version': mod.get('version', 'unknown'),
                'current_file_id': current_file_id,
                'latest_version': latest_file.get('version'),
                'latest_file_id': latest_file_id,
                'latest_file_name': latest_file.get('file_name'),
                'download_url': download_url,
                'update_available': True
            }

        return None

    except Exception as e:
        print(f"Error checking updates for mod {mod['mod_id']}: {e}")
        return None

def _pick_period(mods: list) -> str:
    """Pick the smallest batch period that covers the oldest last_checked."""
    now = datetime.now(timezone.utc)
    oldest = None
    for mod in mods:
        lc = mod.get("last_checked")
        if not lc:
            return "1m"  # never checked → use largest period
        if isinstance(lc, str):
            lc = datetime.fromisoformat(lc).replace(tzinfo=timezone.utc)
        if oldest is None or lc < oldest:
            oldest = lc
    if oldest is None:
        return "1m"
    delta = now - oldest
    if delta.days < 1:
        return "1d"
    if delta.days < 7:
        return "1w"
    return "1m"

@router.get("/check", response_model=List[UpdateInfo])
def check_all_updates():
    """Check tracked mods for updates using the batch updated-mods endpoint.
    Only queries individual mod files for mods that Nexusmods reports as recently updated."""
    mods = get_all_mods()
    if not mods:
        return []

    client = get_nexusmods_client()
    period = _pick_period(mods)

    # Group tracked mods by game
    by_game: dict[str, list[dict]] = {}
    for mod in mods:
        by_game.setdefault(mod["game"], []).append(mod)

    # Fetch recently updated mod_ids per game (one API call per game)
    updated_mod_ids: set[int] = set()
    for game, game_mods in by_game.items():
        try:
            updated = client.get_updated_mods(game, period)
            updated_mod_ids.update(entry.get("mod_id") for entry in updated)
        except Exception as e:
            print(f"[check-all] Failed to fetch updated mods for {game}: {e}")
            # Fallback: check all mods for this game
            updated_mod_ids.update(mod["mod_id"] for mod in game_mods)

    # Check mods whose mod_id appeared in the batch response,
    # and always check mods that have never been checked before
    updates = []
    checked = 0
    skipped = 0
    for mod in mods:
        never_checked = not mod.get("last_checked")
        if not never_checked and mod["mod_id"] not in updated_mod_ids:
            skipped += 1
            continue
        checked += 1
        update_info = check_mod_update(mod)
        if update_info:
            updates.append(update_info)

    print(f"[check-all] period={period}, checked={checked}, skipped={skipped}, updates={len(updates)}")
    return updates

@router.get("/check/{mod_db_id}", response_model=UpdateInfo)
def check_single_update(mod_db_id: int):
    """Check a specific mod for updates"""
    from database import get_mod_by_id

    mod = get_mod_by_id(mod_db_id)
    if not mod:
        raise HTTPException(status_code=404, detail="Mod not found")

    update_info = check_mod_update(mod)
    if not update_info:
        raise HTTPException(status_code=200, detail="No updates available")

    return update_info
