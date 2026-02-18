"""
Local files router - Scan and manage local mod files
"""
from fastapi import APIRouter, HTTPException
from typing import List
import os
from datetime import datetime, timezone
from pathlib import Path
from models import LocalFile
from database import get_all_mods, update_mod
from nexusmods_client import get_nexusmods_client

router = APIRouter()

def get_mods_directory() -> str:
    """Get mods directory from environment"""
    mods_dir = os.getenv("MODS_DIR")
    if not mods_dir:
        raise HTTPException(status_code=500, detail="MODS_DIR not configured")
    if not os.path.exists(mods_dir):
        raise HTTPException(status_code=500, detail=f"MODS_DIR does not exist: {mods_dir}")
    return mods_dir

@router.get("/", response_model=List[LocalFile])
def list_local_files():
    """List all local mod files in the mods directory"""
    mods_dir = get_mods_directory()
    tracked_files = {mod['local_file'] for mod in get_all_mods()}

    local_files = []
    for filename in os.listdir(mods_dir):
        if filename.endswith(('.zip', '.rar', '.7z')):
            file_path = os.path.join(mods_dir, filename)
            size_bytes = os.path.getsize(file_path)

            local_files.append({
                'filename': filename,
                'size_bytes': size_bytes,
                'path': file_path,
                'mapped': filename in tracked_files
            })

    return sorted(local_files, key=lambda x: x['filename'])

@router.post("/scan")
def scan_mods_directory():
    """Scan mods directory and return statistics"""
    mods_dir = get_mods_directory()
    tracked_mods = get_all_mods()
    tracked_files = {mod['local_file'] for mod in tracked_mods}

    all_files = [f for f in os.listdir(mods_dir) if f.endswith(('.zip', '.rar', '.7z'))]
    unmapped_files = [f for f in all_files if f not in tracked_files]

    return {
        'total_files': len(all_files),
        'mapped_files': len(tracked_files),
        'unmapped_files': len(unmapped_files),
        'mods_directory': mods_dir,
        'unmapped_list': unmapped_files[:20]  # First 20 unmapped
    }


@router.delete("/{filename:path}")
def delete_local_file(filename: str):
    """Delete a local file from the mods directory"""
    mods_dir = get_mods_directory()
    file_path = os.path.join(mods_dir, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    try:
        os.remove(file_path)
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {e}")
    return {"message": f"Deleted {filename}"}

@router.post("/auto-detect")
def auto_detect_updates():
    """
    Scan mods directory for newly downloaded files that match a tracked mod's
    latest_file_name. For each match:
      1. Update tracking (promote latest_file_id -> file_id, re-fetch metadata)
      2. Update local_file to the new filename
      3. Delete the old file from disk
    Returns a list of mods that were auto-updated.
    """
    mods_dir = get_mods_directory()
    tracked_mods = get_all_mods()

    # Files currently on disk
    disk_files = set(
        f for f in os.listdir(mods_dir)
        if f.endswith(('.zip', '.rar', '.7z'))
    )

    # Build lookup: latest_file_name -> mod (only mods with pending updates)
    pending = {}
    for mod in tracked_mods:
        lfn = mod.get("latest_file_name")
        if lfn and mod.get("update_available"):
            pending[lfn] = mod

    results = []
    client = get_nexusmods_client()

    for filename in disk_files:
        if filename not in pending:
            continue

        mod = pending[filename]
        latest_file_id = mod["latest_file_id"]
        old_local_file = mod["local_file"]

        # When the new file has the same name as the old one (override),
        # only proceed if the file on disk has a different mtime than what we stored.
        # If mtime matches, the file hasn't been re-downloaded yet.
        if filename == old_local_file:
            file_path = os.path.join(mods_dir, filename)
            file_mtime = datetime.fromtimestamp(os.path.getmtime(file_path), tz=timezone.utc)
            stored_mtime = mod.get("local_file_mtime")
            if stored_mtime:
                if isinstance(stored_mtime, str):
                    stored_mtime_dt = datetime.fromisoformat(stored_mtime).replace(tzinfo=timezone.utc)
                else:
                    stored_mtime_dt = stored_mtime.replace(tzinfo=timezone.utc)
                if file_mtime == stored_mtime_dt:
                    continue

        # Fetch new file metadata
        try:
            file_details = client.get_file_details(
                mod["game"], mod["mod_id"], latest_file_id
            )
        except Exception as e:
            print(f"[auto-detect] Failed to fetch metadata for mod {mod['id']}: {e}")
            continue

        # Store new file's mtime
        new_file_path = os.path.join(mods_dir, filename)
        new_mtime = datetime.fromtimestamp(
            os.path.getmtime(new_file_path), tz=timezone.utc
        ).isoformat()

        # Update the mod record
        updates = {
            "file_id": latest_file_id,
            "local_file": filename,
            "local_file_mtime": new_mtime,
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
        updated_mod = update_mod(mod["id"], updates)

        # Delete old file if it's different and still exists
        if old_local_file != filename:
            old_path = os.path.join(mods_dir, old_local_file)
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                    print(f"[auto-detect] Deleted old file: {old_local_file}")
                except OSError as e:
                    print(f"[auto-detect] Failed to delete {old_local_file}: {e}")

        print(f"[auto-detect] Updated mod {mod['id']}: {old_local_file} -> {filename}")
        results.append({
            "mod_id": mod["id"],
            "mod_name": mod.get("mod_name"),
            "old_file": old_local_file,
            "new_file": filename,
            "version": file_details.get("version"),
        })

    return {
        "updated": len(results),
        "details": results,
    }
