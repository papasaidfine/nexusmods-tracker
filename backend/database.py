"""
SQLite database setup and operations
"""
import sqlite3
import os
from datetime import datetime
from typing import List, Optional
from contextlib import contextmanager
from dotenv import load_dotenv

load_dotenv()

# Store database at same level as Mods folder
MODS_DIR = os.getenv("MODS_DIR", "")
if MODS_DIR:
    # Get parent directory of Mods folder
    DB_PATH = os.path.join(os.path.dirname(MODS_DIR), "nexusmods_tracker.db")
else:
    # Fallback to current directory if MODS_DIR not set
    DB_PATH = "tracker.db"

@contextmanager
def get_db():
    """Get database connection context manager"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def _migrate_schema(conn):
    """Migrate old schema to new schema if needed"""
    cols = {row[1] for row in conn.execute("PRAGMA table_info(mods)").fetchall()}

    # Check if we're on the old schema
    if 'file_name_pattern' in cols:
        conn.execute("DROP TABLE IF EXISTS mods_new")
        conn.execute("""
            CREATE TABLE mods_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                local_file TEXT NOT NULL UNIQUE,
                mod_id INTEGER NOT NULL,
                file_id INTEGER NOT NULL,
                game TEXT NOT NULL,
                name TEXT,
                file_name TEXT,
                description TEXT,
                size_in_bytes INTEGER,
                version TEXT,
                mod_name TEXT,
                author TEXT,
                category_name TEXT,
                uploaded_time TEXT,
                last_checked TIMESTAMP,
                update_available BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            INSERT INTO mods_new (
                id, local_file, mod_id, file_id, game,
                name, version, mod_name, author, category_name,
                uploaded_time, last_checked, update_available, created_at, updated_at
            )
            SELECT
                id, local_file, mod_id, file_id, game,
                file_name_pattern, current_version, mod_name, author, category,
                uploaded_time, last_checked, update_available, created_at, updated_at
            FROM mods
        """)
        conn.execute("DROP TABLE mods")
        conn.execute("ALTER TABLE mods_new RENAME TO mods")
        # Refresh cols after migration — new table has all columns
        return

    # Add any missing new columns to an already-migrated schema
    if 'file_name' not in cols:
        conn.execute("ALTER TABLE mods ADD COLUMN file_name TEXT")
    if 'description' not in cols:
        conn.execute("ALTER TABLE mods ADD COLUMN description TEXT")
    if 'size_in_bytes' not in cols:
        conn.execute("ALTER TABLE mods ADD COLUMN size_in_bytes INTEGER")
    if 'latest_file_id' not in cols:
        conn.execute("ALTER TABLE mods ADD COLUMN latest_file_id INTEGER")
    if 'latest_version' not in cols:
        conn.execute("ALTER TABLE mods ADD COLUMN latest_version TEXT")
    if 'latest_file_name' not in cols:
        conn.execute("ALTER TABLE mods ADD COLUMN latest_file_name TEXT")
    if 'local_file_mtime' not in cols:
        conn.execute("ALTER TABLE mods ADD COLUMN local_file_mtime TIMESTAMP")

    # Add unique index on (mod_id, file_id) if not already present
    existing_indexes = {
        row[1] for row in conn.execute("PRAGMA index_list(mods)").fetchall()
    }
    if 'uq_mod_file' not in existing_indexes:
        conn.execute("CREATE UNIQUE INDEX uq_mod_file ON mods (mod_id, file_id)")

def init_db():
    """Initialize database tables"""
    with get_db() as conn:
        # Check if table already exists
        existing = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='mods'"
        ).fetchone()

        if existing:
            _migrate_schema(conn)
        else:
            conn.execute("""
                CREATE TABLE mods (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    local_file TEXT NOT NULL UNIQUE,
                    mod_id INTEGER NOT NULL,
                    file_id INTEGER NOT NULL,
                    game TEXT NOT NULL,
                    name TEXT,
                    file_name TEXT,
                    description TEXT,
                    size_in_bytes INTEGER,
                    latest_file_id INTEGER,
                    latest_version TEXT,
                    latest_file_name TEXT,
                    local_file_mtime TIMESTAMP,
                    version TEXT,
                    mod_name TEXT,
                    author TEXT,
                    category_name TEXT,
                    uploaded_time TEXT,
                    last_checked TIMESTAMP,
                    update_available BOOLEAN DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(mod_id, file_id)
                )
            """)
        conn.commit()

def get_all_mods() -> List[dict]:
    """Get all tracked mods"""
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM mods ORDER BY updated_at DESC").fetchall()
        return [dict(row) for row in rows]

def get_mod_by_id(mod_db_id: int) -> Optional[dict]:
    """Get mod by database ID"""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM mods WHERE id = ?", (mod_db_id,)).fetchone()
        return dict(row) if row else None

def get_mod_by_local_file(local_file: str) -> Optional[dict]:
    """Get mod by local filename"""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM mods WHERE local_file = ?", (local_file,)).fetchone()
        return dict(row) if row else None

def create_mod(mod_data: dict) -> dict:
    """Create a new tracked mod"""
    with get_db() as conn:
        cursor = conn.execute("""
            INSERT INTO mods (
                local_file, mod_id, file_id, game,
                name, file_name, description, size_in_bytes,
                version, mod_name, author, category_name, uploaded_time,
                local_file_mtime
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            mod_data['local_file'],
            mod_data['mod_id'],
            mod_data['file_id'],
            mod_data['game'],
            mod_data.get('name'),
            mod_data.get('file_name'),
            mod_data.get('description'),
            mod_data.get('size_in_bytes'),
            mod_data.get('version'),
            mod_data.get('mod_name'),
            mod_data.get('author'),
            mod_data.get('category_name'),
            mod_data.get('uploaded_time'),
            mod_data.get('local_file_mtime'),
        ))
        conn.commit()
        return get_mod_by_id(cursor.lastrowid)

def update_mod(mod_db_id: int, updates: dict) -> Optional[dict]:
    """Update a tracked mod"""
    updates['updated_at'] = datetime.utcnow().isoformat()

    set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
    values = list(updates.values()) + [mod_db_id]

    with get_db() as conn:
        conn.execute(f"UPDATE mods SET {set_clause} WHERE id = ?", values)
        conn.commit()
        return get_mod_by_id(mod_db_id)

def delete_mod(mod_db_id: int) -> bool:
    """Delete a tracked mod"""
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM mods WHERE id = ?", (mod_db_id,))
        conn.commit()
        return cursor.rowcount > 0
