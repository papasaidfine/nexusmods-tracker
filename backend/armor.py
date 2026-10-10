"""
Which installed Fluffy options replace which MH Wilds armor.

Armor files live under natives/stm/art/model/character/<body>/<model>/<variant>/<part>/:
- body: ch02 male hunter, ch03 female hunter
- model: the armor model ID; several series share one (Arkveld α/β/γ, Guardian
  Arkveld are all 032) and data/mhwilds_armor.json names them
- variant: 3 digits, the first two pick the look within the model (00, 30, 50...,
  no public mapping to series, so users can label them), the last the design
  (0 = male design, 1 = female design; Ver.R's "F-M" is ch03 + 0)
- part: 1 arm, 2 body, 3 helm, 4 leg, 5 waist, 6 slinger
Equipment prefabs (natives/stm/gamedesign/equip/_prefab/armor/<female|male>/
<model>/<variant>/<Part>/) belong to the same slot.

A slot is (model, variant, part). Within a slot, the option installed last owns a
shared file, as everywhere in Fluffy (see install_order).
"""
import json
import os
import re
from dataclasses import dataclass
from typing import Dict, List, Optional

from install_order import Option, last_writers

DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "mhwilds_armor.json")

PARTS = {"1": "arm", "2": "body", "3": "helm", "4": "leg", "5": "waist", "6": "slinger"}
PART_ORDER = ["helm", "body", "arm", "waist", "leg", "slinger"]

MODEL_RE = re.compile(r"natives/stm/art/model/character/(ch0[23])/(\d{3})/(\d{3})/([1-6])/(.+)$")
PREFAB_RE = re.compile(
    r"natives/stm/gamedesign/equip/_prefab/armor/(female|male)/(\d{3})/(\d{3})/(?:(\w+)/)?[^/]+$")


@dataclass(frozen=True)
class ArmorFile:
    model: str
    variant: str
    part: Optional[str]  # None for files of a whole variant (e.g. its _avp.user)
    body: str  # "female" or "male"
    role: str  # "mesh", "material", "physics" or "other"


def _role(name: str) -> str:
    if ".mesh." in name:
        return "mesh"
    if ".mdf2." in name:
        return "material"
    if ".chain2" in name or ".clsp." in name:
        return "physics"
    return "other"


def classify(path: str) -> Optional[ArmorFile]:
    """The armor slot a (normalized) file belongs to, if any."""
    path = path.rstrip("/")
    m = MODEL_RE.match(path)
    if m:
        body, model, variant, part, rest = m.groups()
        return ArmorFile(model, variant, PARTS[part],
                         "female" if body == "ch03" else "male", _role(rest.rsplit("/", 1)[-1]))
    m = PREFAB_RE.match(path)
    if m:
        body, model, variant, part = m.groups()
        part = part if part in PART_ORDER else None
        return ArmorFile(model, variant, part, body, "other")
    return None


def other_category(files) -> str:
    """Rough kind of a non-armor option, from its files."""
    if any(f.endswith(".pak") for f in files):
        # Fluffy installs .pak mods as re_chunk_000.pak.sub_000.pak.patch_<n>.pak
        return "pak"
    if any("/character/minou/" in f for f in files):
        return "palico"
    if any("/art/model/wp" in f or "/weapon/" in f for f in files):
        return "weapon"
    if any(f.startswith("reframework/") for f in files):
        return "reframework"
    return "other"


# Models no armor series uses, named from the mods that replace them
EXTRA_MODELS = {
    "002": [{"en": "Innerwear", "zh": "内衣"}],  # Ver.R "Inner1" options
}

_series: Optional[Dict[str, List[Dict]]] = None


def series_by_model() -> Dict[str, List[Dict]]:
    """Model ID ("032") -> armor series using it, from data/mhwilds_armor.json."""
    global _series
    if _series is None:
        with open(DATA_PATH, encoding="utf-8") as f:
            data = json.load(f)
        _series = {k: list(v) for k, v in EXTRA_MODELS.items()}
        for s in data:
            _series.setdefault(f"{s['model']:03d}", []).append(s)
    return _series


def build(options: List[Option], labels: Dict[str, str]) -> Dict:
    """Armor slots touched by installed options, grouped by model and variant.

    labels: "<model>/<variety>" -> user's name for that look (variety = first two
    variant digits). Each option in a slot reports its roles there, the bodies it
    covers and how many of its slot files are still its own copy (not overwritten
    by a later option).
    """
    last = last_writers(options)
    # (model, variant, part) -> option -> files
    slots: Dict[tuple, Dict[int, List[tuple]]] = {}
    armor_options = set()
    for o in options:
        for f in o.files:
            a = classify(f)
            if not a:
                continue
            armor_options.add(id(o))
            if a.part:
                slots.setdefault((a.model, a.variant, a.part), {}).setdefault(o.index, []).append((f, a))

    by_index = {o.index: o for o in options}
    models: Dict[str, Dict] = {}
    for (model, variant, part), per_option in slots.items():
        m = models.setdefault(model, {"model": model, "variants": {}})
        v = m["variants"].setdefault(variant, {
            "variant": variant,
            "variety": variant[:2],
            "design": "female" if variant[2] == "1" else "male",
            "label": labels.get(f"{model}/{variant[:2]}"),
            "parts": {},
        })
        entries = []
        for index in sorted(per_option):
            o = by_index[index]
            files = per_option[index]
            owned = sum(1 for f, _ in files if last[f] is o)
            entries.append({
                "position": o.index,
                "section": o.section,
                "archive": o.archive,
                "roles": sorted({a.role for _, a in files}),
                "bodies": sorted({a.body for _, a in files}),
                "files": len(files),
                "owned_files": owned,
            })
        v["parts"][part] = entries

    series = series_by_model()
    result = []
    for model in sorted(models):
        m = models[model]
        m["series"] = [{"en": s["en"], "zh": s["zh"]} for s in series.get(model, [])]
        m["variants"] = [m["variants"][k] for k in sorted(m["variants"])]
        result.append(m)

    others = [{
        "position": o.index,
        "section": o.section,
        "archive": o.archive,
        "category": other_category(o.files),
        "files": len(o.files),
    } for o in options if id(o) not in armor_options]

    return {"models": result, "others": others}
