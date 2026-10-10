"""
Games the tracker manages, one per Fluffy game folder (<fluffy>/Games/<Game>).

Each game keeps its own Mods folder, Fluffy state and tracker database in that
folder. API routes under /api/games/{game}/ run with that game as the current one
(use_game), so code below them reads paths from current().

Configured in backend/games.json:
    [{"id": "monsterhunterwilds", "name": "Monster Hunter Wilds",
      "fluffy_game_dir": "/mnt/d/.../modmanager/Games/MonsterHunterWilds"}]
id is the game's Nexusmods domain. Without games.json, MODS_DIR (and GAME) define
a single game.
"""
import contextvars
import json
import os
from dataclasses import dataclass
from typing import Dict, List

from fastapi import HTTPException

CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "games.json")

# Games with an equipment view (see armor.py)
ARMOR_GAMES = {"monsterhunterwilds"}


@dataclass(frozen=True)
class Game:
    id: str
    name: str
    fluffy_game_dir: str

    @property
    def mods_dir(self) -> str:
        return os.path.join(self.fluffy_game_dir, "Mods")

    @property
    def db_path(self) -> str:
        return os.path.join(self.fluffy_game_dir, "nexusmods_tracker.db")

    def to_json(self) -> Dict:
        return {
            "id": self.id,
            "name": self.name,
            "mods_dir": self.mods_dir,
            "armor": self.id in ARMOR_GAMES,
        }


def _load() -> List[Game]:
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, encoding="utf-8") as f:
            return [Game(g["id"], g.get("name") or g["id"], os.path.normpath(g["fluffy_game_dir"]))
                    for g in json.load(f)]
    mods_dir = os.getenv("MODS_DIR", "")
    if not mods_dir:
        return []
    game_id = os.getenv("GAME", "monsterhunterwilds")
    return [Game(game_id, game_id, os.path.dirname(os.path.normpath(mods_dir)))]


_games: List[Game] = []


def all_games() -> List[Game]:
    if not _games:
        _games.extend(_load())
    return _games


def get(game_id: str) -> Game:
    for g in all_games():
        if g.id == game_id:
            return g
    raise HTTPException(status_code=404, detail=f"Unknown game: {game_id}")


_current: contextvars.ContextVar[Game] = contextvars.ContextVar("current_game")


def current() -> Game:
    try:
        return _current.get()
    except LookupError:
        raise RuntimeError("No current game; call under /api/games/{game}/ or activate()")


def activate(game: Game) -> contextvars.Token:
    return _current.set(game)


async def use_game(game: str):
    """Router dependency: run the request with the {game} path parameter as current game."""
    token = activate(get(game))
    try:
        yield
    finally:
        _current.reset(token)
