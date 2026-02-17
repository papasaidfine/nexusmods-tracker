"""
Updates router - Check for mod updates
"""
from fastapi import APIRouter, HTTPException
from typing import List
from datetime import datetime
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

@router.get("/check", response_model=List[UpdateInfo])
def check_all_updates():
    """Check all tracked mods for updates"""
    mods = get_all_mods()
    updates = []

    for mod in mods:
        update_info = check_mod_update(mod)
        if update_info:
            updates.append(update_info)

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
