"""
Mods router - CRUD operations for tracked mods
"""
from fastapi import APIRouter, HTTPException
from typing import List
import os
from datetime import datetime, timezone
from models import Mod, ModCreate, ModUpdate
from database import get_all_mods, get_mod_by_id, create_mod, update_mod, delete_mod
from nexusmods_client import get_nexusmods_client

router = APIRouter()

@router.get("/", response_model=List[Mod])
def list_mods():
    """List all tracked mods"""
    return get_all_mods()

@router.post("/", response_model=Mod)
def add_mod(mod_create: ModCreate):
    """Add a new mod to track"""
    client = get_nexusmods_client()

    try:
        mod_details = client.get_mod_details(mod_create.game, mod_create.mod_id)
        file_details = client.get_file_details(mod_create.game, mod_create.mod_id, mod_create.file_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch mod details: {str(e)}")

    # Get file mtime from disk
    mods_dir = os.getenv("MODS_DIR", "")
    local_file_mtime = None
    if mods_dir:
        file_path = os.path.join(mods_dir, mod_create.local_file)
        if os.path.exists(file_path):
            local_file_mtime = datetime.fromtimestamp(
                os.path.getmtime(file_path), tz=timezone.utc
            ).isoformat()

    mod_data = {
        'local_file': mod_create.local_file,
        'mod_id': mod_create.mod_id,
        'file_id': mod_create.file_id,
        'game': mod_create.game,
        'name': file_details.get('name'),
        'file_name': file_details.get('file_name'),
        'description': file_details.get('description'),
        'size_in_bytes': file_details.get('size_in_bytes'),
        'version': file_details.get('version'),
        'mod_name': mod_details.get('name'),
        'author': mod_details.get('author'),
        'category_name': file_details.get('category_name'),
        'uploaded_time': file_details.get('uploaded_time'),
        'local_file_mtime': local_file_mtime,
    }

    try:
        return create_mod(mod_data)
    except Exception as e:
        if 'UNIQUE constraint' in str(e):
            raise HTTPException(status_code=400, detail="Mod with this local file already exists")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/refresh-all", response_model=List[Mod])
def refresh_all_metadata():
    """Re-fetch metadata for all tracked mods."""
    client = get_nexusmods_client()
    results = []
    for mod in get_all_mods():
        try:
            mod_details = client.get_mod_details(mod["game"], mod["mod_id"])
            file_details = client.get_file_details(mod["game"], mod["mod_id"], mod["file_id"])
            updates = {
                "name": file_details.get("name"),
                "file_name": file_details.get("file_name"),
                "description": file_details.get("description"),
                "size_in_bytes": file_details.get("size_in_bytes"),
                "version": file_details.get("version"),
                "mod_name": mod_details.get("name"),
                "author": mod_details.get("author"),
                "category_name": file_details.get("category_name"),
                "uploaded_time": file_details.get("uploaded_time"),
            }
            results.append(update_mod(mod["id"], updates))
        except Exception as e:
            print(f"Failed to refresh mod {mod['id']}: {e}")
            results.append(mod)
    return results

@router.get("/{mod_db_id}", response_model=Mod)
def get_mod(mod_db_id: int):
    """Get a specific mod by database ID"""
    mod = get_mod_by_id(mod_db_id)
    if not mod:
        raise HTTPException(status_code=404, detail="Mod not found")
    return mod

@router.patch("/{mod_db_id}", response_model=Mod)
def update_tracked_mod(mod_db_id: int, mod_update: ModUpdate):
    """Update a tracked mod"""
    mod = get_mod_by_id(mod_db_id)
    if not mod:
        raise HTTPException(status_code=404, detail="Mod not found")

    updates = mod_update.dict(exclude_unset=True)
    return update_mod(mod_db_id, updates)

@router.post("/{mod_db_id}/refresh", response_model=Mod)
def refresh_mod_metadata(mod_db_id: int):
    """
    Re-fetch file and mod metadata from Nexusmods for a tracked mod.
    Useful for backfilling missing fields like file_name, description, size_in_bytes.
    """
    mod = get_mod_by_id(mod_db_id)
    if not mod:
        raise HTTPException(status_code=404, detail="Mod not found")

    client = get_nexusmods_client()
    try:
        mod_details = client.get_mod_details(mod["game"], mod["mod_id"])
        file_details = client.get_file_details(mod["game"], mod["mod_id"], mod["file_id"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch metadata: {e}")

    updates = {
        "name": file_details.get("name"),
        "file_name": file_details.get("file_name"),
        "description": file_details.get("description"),
        "size_in_bytes": file_details.get("size_in_bytes"),
        "version": file_details.get("version"),
        "mod_name": mod_details.get("name"),
        "author": mod_details.get("author"),
        "category_name": file_details.get("category_name"),
        "uploaded_time": file_details.get("uploaded_time"),
    }

    return update_mod(mod_db_id, updates)


@router.post("/{mod_db_id}/mark-updated", response_model=Mod)
def mark_mod_updated(mod_db_id: int):
    """
    Mark a mod as updated after manual download.
    Promotes latest_file_id to file_id, re-fetches file metadata, and clears update flag.
    """
    mod = get_mod_by_id(mod_db_id)
    if not mod:
        raise HTTPException(status_code=404, detail="Mod not found")

    latest_file_id = mod.get("latest_file_id")
    if not latest_file_id or not mod.get("update_available"):
        raise HTTPException(status_code=400, detail="No pending update to mark")

    # Fetch updated file metadata from Nexusmods
    client = get_nexusmods_client()
    try:
        file_details = client.get_file_details(mod["game"], mod["mod_id"], latest_file_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch file details: {e}")

    # Update local_file to the new filename and record its mtime
    new_local_file = mod.get("latest_file_name") or mod["local_file"]
    old_local_file = mod["local_file"]
    mods_dir = os.getenv("MODS_DIR", "")

    local_file_mtime = None
    if mods_dir:
        new_file_path = os.path.join(mods_dir, new_local_file)
        if os.path.exists(new_file_path):
            local_file_mtime = datetime.fromtimestamp(
                os.path.getmtime(new_file_path), tz=timezone.utc
            ).isoformat()

    updates = {
        "file_id": latest_file_id,
        "local_file": new_local_file,
        "local_file_mtime": local_file_mtime,
        "version": file_details.get("version"),
        "name": file_details.get("name"),
        "file_name": file_details.get("file_name"),
        "description": file_details.get("description"),
        "size_in_bytes": file_details.get("size_in_bytes"),
        "category_name": file_details.get("category_name"),
        "uploaded_time": file_details.get("uploaded_time"),
        "update_available": False,
        "latest_file_id": None,
        "latest_version": None,
        "latest_file_name": None,
    }

    result = update_mod(mod_db_id, updates)

    # Delete old file if it's different and still exists
    if old_local_file != new_local_file and mods_dir:
        old_path = os.path.join(mods_dir, old_local_file)
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except OSError as e:
                print(f"[mark-updated] Failed to delete {old_local_file}: {e}")

    return result


@router.delete("/{mod_db_id}")
def remove_mod(mod_db_id: int):
    """Remove a tracked mod"""
    if not delete_mod(mod_db_id):
        raise HTTPException(status_code=404, detail="Mod not found")
    return {"message": "Mod deleted successfully"}
