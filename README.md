# Nexusmods Tracker

Track and manage Nexusmods mod files for Monster Hunter Wilds (and other games). Get notified when updates are available and automate downloads.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Next.js       │  HTTP   │   FastAPI        │  API    │   Nexusmods     │
│   Frontend      │ ◄─────► │   Backend        │ ◄─────► │   API           │
│   (Port 3000)   │         │   (Port 8000)    │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │ Local Storage   │
                            │ - tracker.db    │
                            │ - Mods Dir      │
                            └─────────────────┘
```

| Component | Stack | Location |
|-----------|-------|----------|
| Backend API | FastAPI + SQLite | `backend/` |
| Frontend | Next.js 15 + shadcn/ui | `frontend/` |
| Download automation | Playwright (Windows) | `tools/` *(planned)* |

## Quick Start

### Prerequisites

- Python 3.12+ with [uv](https://github.com/astral-sh/uv)
- Node.js with [pnpm](https://pnpm.io)
- A [Nexusmods API key](https://www.nexusmods.com/users/myaccount?tab=api)

### Setup

```bash
cp .env.example .env
# Edit .env with your API key and mods directory
```

### Run

```bash
# Terminal 1 — backend (auto-reloads on changes)
cd backend && ./run.sh

# Terminal 2 — frontend (auto-reloads on changes)
cd frontend && pnpm dev
```

Open **http://localhost:3000**

## Configuration (`.env`)

```env
NEXUSMODS_API_KEY=your_api_key_here
MODS_DIR=/path/to/your/mods/folder
CHROME_PROFILE_PATH=/path/to/chrome/user/data   # for download automation
```

| Variable | Description |
|----------|-------------|
| `NEXUSMODS_API_KEY` | From nexusmods.com → Account → API Keys |
| `MODS_DIR` | Absolute path to your local mods folder |
| `CHROME_PROFILE_PATH` | Chrome User Data directory for automated downloads |

## Features

- **Track mods** — link local `.zip`/`.rar`/`.7z` files to Nexusmods mod+file IDs
- **Update checking** — compare your file ID against latest non-archived files
- **Local file scanning** — discover unmapped files in your mods directory
- **Download automation** — automated Slow Download flow via Playwright *(Windows, planned)*
- **Dashboard** — overview of all mods, update status, and quick actions

## Frontend

Next.js 15 (App Router) with TypeScript, Tailwind CSS, shadcn/ui, and SWR for data fetching.

**Pages:**

| Route | Description |
|-------|-------------|
| `/` | Dashboard — stats, mods with updates, quick actions |
| `/mods` | All tracked mods with sortable table |
| `/mods/[id]` | Mod detail — full metadata, update status, actions |
| `/local-files` | Scan mods directory, map unmapped files |
| `/settings` | Configuration display |

## Backend

### Project Structure

```
backend/
├── main.py                 # FastAPI app entry point
├── models.py               # Pydantic data models
├── database.py             # SQLite operations + schema migration
├── nexusmods_client.py     # pynxm API wrapper
├── downloader.py           # Playwright download automation
├── routers/
│   ├── mods.py            # CRUD for tracked mods
│   ├── local_files.py     # Local file scanning
│   ├── updates.py         # Update checking + persistence
│   ├── downloads.py       # Trigger Playwright downloads
│   └── nexusmods_api.py   # Direct Nexusmods API access
└── run.sh                  # Startup script
```

### API Endpoints

Interactive docs at **http://localhost:8000/docs**

#### Mods

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/mods` | List all tracked mods |
| `GET` | `/api/mods/{id}` | Get a specific mod |
| `POST` | `/api/mods` | Add mod (auto-fetches metadata) |
| `PATCH` | `/api/mods/{id}` | Update mod record |
| `DELETE` | `/api/mods/{id}` | Remove from tracking |

**POST `/api/mods` request body:**
```json
{
  "local_file": "Gore Magala Ver.R F-F AIO.zip",
  "mod_id": 1540,
  "file_id": 15544,
  "game": "monsterhunterwilds"
}
```

#### Local Files

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/local-files` | List `.zip`/`.rar`/`.7z` files in MODS_DIR |
| `POST` | `/api/local-files/scan` | Scan directory, return mapped/unmapped stats |

#### Updates

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/updates/check` | Check all mods for updates |
| `GET` | `/api/updates/check/{id}` | Check a specific mod |

After checking, `latest_file_id` and `latest_version` are persisted to the database so download links remain correct across page loads.

#### Downloads

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/downloads/{id}` | Trigger Playwright download for a mod |

Requires `CHROME_PROFILE_PATH` configured. Opens a Chrome window, clicks "Slow download", waits for the countdown, and saves the file to `MODS_DIR`.

#### Nexusmods API (passthrough)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/nexusmods/tracked` | Mods tracked on your Nexusmods account |
| `GET` | `/api/nexusmods/mods/{game}/{mod_id}` | Mod details |
| `GET` | `/api/nexusmods/files/{game}/{mod_id}` | All files for a mod |

### Database Schema

SQLite database at `{parent of MODS_DIR}/nexusmods_tracker.db`.

```sql
CREATE TABLE mods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    local_file TEXT NOT NULL UNIQUE,    -- filename in mods directory
    mod_id INTEGER NOT NULL,            -- Nexusmods mod ID
    file_id INTEGER NOT NULL,           -- currently tracked file ID
    game TEXT NOT NULL,                 -- e.g. "monsterhunterwilds"
    name TEXT,                          -- file display name from Nexusmods
    file_name TEXT,                     -- actual zip filename from Nexusmods
    description TEXT,
    size_in_bytes INTEGER,
    version TEXT,                       -- current version installed
    mod_name TEXT,                      -- mod title from Nexusmods
    author TEXT,
    category_name TEXT,                 -- MAIN, OPTIONAL, ARCHIVED, etc.
    uploaded_time TEXT,
    latest_file_id INTEGER,             -- persisted after update check
    latest_version TEXT,                -- persisted after update check
    last_checked TIMESTAMP,
    update_available BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Database location:**
```
/path/to/MonsterHunterWilds/
├── Mods/                       ← MODS_DIR
│   ├── Gore Magala ....zip
│   └── ...
└── nexusmods_tracker.db        ← database lives here
```

### Update Detection Logic

1. Fetch all files for the mod from Nexusmods
2. **Filter out `ARCHIVED` and `OLD_VERSION` files** (Nexusmods can have 60+ historical versions)
3. Match files by the `name` field (e.g., "Gore Magala Ver.R F-F AIO")
4. Find latest by `file_id` (higher = newer)
5. Compare with current `file_id`; if newer found, mark update available
6. Persist `latest_file_id` and `latest_version` to DB

## Troubleshooting

**"NEXUSMODS_API_KEY not found"** — Ensure `.env` exists in the project root with a valid key.

**"MODS_DIR does not exist"** — Check the path in `.env` points to a valid directory.

**Database locked** — Only one backend instance should be running. Stop with `pkill -f uvicorn`.

**Port 8000 in use:**
```bash
lsof -i :8000
kill -9 <PID>
```

**Download automation not working** — Requires Windows with Chrome installed and `CHROME_PROFILE_PATH` set to your Chrome User Data directory (e.g., `C:\Users\you\AppData\Local\Google\Chrome\User Data`). The Playwright automation does not work in WSL2 without additional setup.
