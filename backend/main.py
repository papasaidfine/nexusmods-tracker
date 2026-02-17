"""
Nexusmods Tracker - FastAPI Backend
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from database import init_db
from routers import mods, local_files, updates, nexusmods_api

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    yield
    # Shutdown (cleanup if needed)

app = FastAPI(
    title="Nexusmods Tracker API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(mods.router, prefix="/api/mods", tags=["mods"])
app.include_router(local_files.router, prefix="/api/local-files", tags=["local-files"])
app.include_router(updates.router, prefix="/api/updates", tags=["updates"])
app.include_router(nexusmods_api.router, prefix="/api/nexusmods", tags=["nexusmods"])

@app.get("/")
def root():
    return {
        "message": "Nexusmods Tracker API",
        "docs": "/docs"
    }

@app.get("/health")
def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
