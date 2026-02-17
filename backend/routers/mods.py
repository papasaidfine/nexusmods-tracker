"""
Mods router - CRUD operations for tracked mods
"""
from fastapi import APIRouter, HTTPException
from typing import List
from models import Mod, ModCreate, ModUpdate
from database import get_all_mods, get_mod_by_id, create_mod, update_mod, delete_mod
from nexusmods_client import get_nexusmods_client

router = APIRouter()

@router.get("/", response_model=List[Mod])
def list_mods():
    """List all tracked mods"""
    return get_all_mods()

@router.get("/{mod_db_id}", response_model=Mod)
def get_mod(mod_db_id: int):
    """Get a specific mod by database ID"""
    mod = get_mod_by_id(mod_db_id)
    if not mod:
        raise HTTPException(status_code=404, detail="Mod not found")
    return mod

@router.post("/", response_model=Mod)
def add_mod(mod_create: ModCreate):
    """Add a new mod to track"""
    # Fetch mod details from Nexusmods
    client = get_nexusmods_client()

    try:
        mod_details = client.get_mod_details(mod_create.game, mod_create.mod_id)
        file_details = client.get_file_details(mod_create.game, mod_create.mod_id, mod_create.file_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch mod details: {str(e)}")

    # Prepare mod data using Nexusmods API keys as-is
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
    }

    try:
        return create_mod(mod_data)
    except Exception as e:
        if 'UNIQUE constraint' in str(e):
            raise HTTPException(status_code=400, detail="Mod with this local file already exists")
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/{mod_db_id}", response_model=Mod)
def update_tracked_mod(mod_db_id: int, mod_update: ModUpdate):
    """Update a tracked mod"""
    mod = get_mod_by_id(mod_db_id)
    if not mod:
        raise HTTPException(status_code=404, detail="Mod not found")

    updates = mod_update.dict(exclude_unset=True)
    return update_mod(mod_db_id, updates)

@router.delete("/{mod_db_id}")
def remove_mod(mod_db_id: int):
    """Remove a tracked mod"""
    if not delete_mod(mod_db_id):
        raise HTTPException(status_code=404, detail="Mod not found")
    return {"message": "Mod deleted successfully"}
