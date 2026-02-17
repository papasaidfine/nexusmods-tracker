"""
Nexusmods API router - Direct access to Nexusmods API
"""
from fastapi import APIRouter, HTTPException
from typing import List
from models import NexusmodsMod, NexusmodsFile
from nexusmods_client import get_nexusmods_client

router = APIRouter()

@router.get("/tracked", response_model=List[dict])
def get_tracked_from_nexusmods():
    """Get mods tracked on Nexusmods (from user account)"""
    client = get_nexusmods_client()
    try:
        return client.get_tracked_mods()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mods/{game}/{mod_id}", response_model=NexusmodsMod)
def get_mod_from_nexusmods(game: str, mod_id: int):
    """Get mod details from Nexusmods"""
    client = get_nexusmods_client()
    try:
        mod_data = client.get_mod_details(game, mod_id)
        return {
            'mod_id': mod_data['mod_id'],
            'name': mod_data['name'],
            'summary': mod_data.get('summary'),
            'author': mod_data['author'],
            'version': mod_data['version'],
            'game': game,
            'updated_time': mod_data['updated_time']
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Mod not found: {str(e)}")

@router.get("/files/{game}/{mod_id}", response_model=List[NexusmodsFile])
def get_files_from_nexusmods(game: str, mod_id: int):
    """Get all files for a mod from Nexusmods"""
    client = get_nexusmods_client()
    try:
        files = client.get_mod_files(game, mod_id)
        return [
            {
                'file_id': f['file_id'],
                'name': f['name'],
                'version': f['version'],
                'category_name': f.get('category_name', 'UNKNOWN'),
                'size_kb': f.get('size_kb', 0),
                'uploaded_time': f['uploaded_time'],
                'file_name': f['file_name']
            }
            for f in files
        ]
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Files not found: {str(e)}")
