"""
Database models and Pydantic schemas
"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# Pydantic models for API
class ModCreate(BaseModel):
    local_file: str
    mod_id: int
    file_id: int
    game: str

class ModUpdate(BaseModel):
    local_file: Optional[str] = None
    file_id: Optional[int] = None
    version: Optional[str] = None

class Mod(BaseModel):
    id: int
    local_file: str
    mod_id: int
    file_id: int
    game: str
    name: Optional[str] = None
    file_name: Optional[str] = None
    description: Optional[str] = None
    size_in_bytes: Optional[int] = None
    latest_file_id: Optional[int] = None
    latest_version: Optional[str] = None
    latest_file_name: Optional[str] = None
    local_file_mtime: Optional[datetime] = None
    version: Optional[str] = None
    mod_name: Optional[str] = None
    author: Optional[str] = None
    category_name: Optional[str] = None
    uploaded_time: Optional[str] = None
    last_checked: Optional[datetime] = None
    update_available: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class LocalFile(BaseModel):
    filename: str
    size_bytes: int
    path: str
    mapped: bool = False
    mod_id: Optional[int] = None

class UpdateInfo(BaseModel):
    mod_id: int
    local_file: str
    version: str
    current_file_id: int
    latest_version: str
    latest_file_id: int
    latest_file_name: str
    download_url: str
    update_available: bool

class NexusmodsMod(BaseModel):
    mod_id: int
    name: str
    summary: Optional[str] = None
    author: str
    version: str
    game: str
    updated_time: str

class NexusmodsFile(BaseModel):
    file_id: int
    name: str
    version: str
    category_name: str
    size_kb: int
    uploaded_time: str
    file_name: str
