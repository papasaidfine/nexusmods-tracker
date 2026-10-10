"""
Nexusmods Tracker - FastAPI Backend
"""
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os
import uvicorn
from dotenv import load_dotenv

load_dotenv()

import games
from routers import mods, local_files, updates, nexusmods_api, fluffy, armor

app = FastAPI(
    title="Nexusmods Tracker API",
    version="1.0.0",
)

# CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Per-game routers run with {game} as the current game (see games.py)
GAME_PREFIX = "/api/games/{game}"
for router, name in [
    (mods.router, "mods"),
    (local_files.router, "local-files"),
    (updates.router, "updates"),
    (fluffy.router, "fluffy"),
    (armor.router, "armor"),
]:
    app.include_router(router, prefix=f"{GAME_PREFIX}/{name}", tags=[name],
                       dependencies=[Depends(games.use_game)])
app.include_router(nexusmods_api.router, prefix="/api/nexusmods", tags=["nexusmods"])

@app.get("/")
def root():
    return {
        "message": "Nexusmods Tracker API",
        "docs": "/docs"
    }

USERSCRIPT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "userscripts")

@app.get("/userscript/nexus-auto-download.user.js")
def userscript():
    """Served so Tampermonkey can install (and auto-update) it from this URL"""
    return FileResponse(
        os.path.join(USERSCRIPT_DIR, "nexus-auto-download.user.js"),
        media_type="text/javascript",
    )

@app.get("/api/games")
def list_games():
    return [g.to_json() for g in games.all_games()]

@app.get("/health")
def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
