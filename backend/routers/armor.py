"""
Armor router - which installed mod options replace which armor (MH Wilds)
"""
import json
import os
from typing import Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import armor
import fluffy
import games
import install_order
from database import get_all_mods

router = APIRouter()


class LabelUpdate(BaseModel):
    model: str
    variety: str
    label: Optional[str] = None


def _check_game() -> None:
    if games.current().id not in games.ARMOR_GAMES:
        raise HTTPException(status_code=404, detail="No armor view for this game")


def _labels_path() -> str:
    return os.path.join(fluffy.game_dir(), "tracker_armor_labels.json")


def _load_labels() -> Dict[str, str]:
    path = _labels_path()
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@router.get("/")
def get_armor():
    """Armor slots replaced by installed options, and the options that replace no armor."""
    _check_game()
    try:
        installed = fluffy.read_installed()
        cache = fluffy.known_options(installed, fluffy.read_cache_with_retry())
    except (fluffy.FluffyError, OSError) as e:
        raise HTTPException(status_code=502, detail=f"Cannot read Fluffy state: {e}")
    mods = get_all_mods()
    options = install_order.load_options(
        installed, cache, {m["local_file"]: str(m["mod_id"]) for m in mods})
    result = armor.build(options, _load_labels())

    # Link options to tracked mods by archive
    tracked = {m["local_file"]: m for m in mods}
    for entry in [e for m in result["models"] for v in m["variants"]
                  for es in v["parts"].values() for e in es] + result["others"]:
        mod = tracked.get(entry["archive"] or "")
        entry["mod_db_id"] = mod["id"] if mod else None
        entry["mod_name"] = mod.get("mod_name") if mod else None
    return result


@router.put("/labels")
def set_label(update: LabelUpdate):
    """Name a look of a model (the first two variant digits), e.g. 032/30 -> Arkveld γ."""
    _check_game()
    labels = _load_labels()
    key = f"{update.model}/{update.variety}"
    label = (update.label or "").strip()
    if label:
        labels[key] = label
    else:
        labels.pop(key, None)
    with open(_labels_path(), "w", encoding="utf-8") as f:
        json.dump(labels, f, ensure_ascii=False, indent=2)
    return labels
