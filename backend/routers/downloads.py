"""
Downloads router - trigger browser-automated download of a mod update
"""
from fastapi import APIRouter, HTTPException
from database import get_mod_by_id
from downloader import download_mod_file

router = APIRouter()


@router.post("/{mod_db_id}")
async def download_mod_update(mod_db_id: int):
    """
    Trigger an automated download of a mod's latest update via Playwright.
    Uses latest_file_id if an update is available, otherwise the current file_id.
    """
    mod = get_mod_by_id(mod_db_id)
    if not mod:
        raise HTTPException(status_code=404, detail="Mod not found")

    file_id = mod.get("latest_file_id") or mod["file_id"]
    game = mod["game"]
    mod_id = mod["mod_id"]
    mod_name = mod.get("name") or mod.get("mod_name") or f"Mod {mod_id}"

    url = (
        f"https://www.nexusmods.com/{game}/mods/{mod_id}"
        f"?tab=files&file_id={file_id}"
    )

    try:
        result = await download_mod_file(url, mod_name=mod_name)
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {e}")
