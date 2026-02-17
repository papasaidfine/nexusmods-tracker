"""
Local files router - Scan and manage local mod files
"""
from fastapi import APIRouter, HTTPException
from typing import List
import os
from pathlib import Path
from models import LocalFile
from database import get_all_mods

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
