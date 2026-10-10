"""
Refresh data/mhwilds_armor.json: MH Wilds armor series with their model ID (the
<id> in natives/stm/art/model/character/ch03/<id>/...), from the MHDB project's
dump of the game data. Rerun after a title update adds armor.

    uv run python scripts/fetch_mhwilds_armor.py
"""
import json
import os
import urllib.request

SOURCE = "https://raw.githubusercontent.com/LartTyler/mhdb-wilds-data/main/output/merged/Armor.json"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "mhwilds_armor.json")


def main() -> None:
    with urllib.request.urlopen(SOURCE) as r:
        series = json.load(r)
    out = [{
        "model": s["model_id"],
        "en": s["names"]["en"],
        "zh": s["names"].get("zh-Hans") or s["names"]["en"],
        "rarity": s["rarity"],
    } for s in series]
    out.sort(key=lambda s: (s["model"], s["rarity"], s["en"]))
    with open(OUT, "w", encoding="utf-8") as f:
        # One series per line, so refreshes diff well
        f.write("[\n" + ",\n".join(json.dumps(s, ensure_ascii=False) for s in out) + "\n]\n")
    print(f"{len(out)} series, {len({s['model'] for s in out})} models -> {OUT}")


if __name__ == "__main__":
    main()
