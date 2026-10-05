/**
 * TypeScript types matching backend models
 */

export interface Mod {
  id: number;
  local_file: string;
  mod_id: number;
  file_id: number;
  game: string;
  name: string | null;
  file_name: string | null;
  description: string | null;
  size_in_bytes: number | null;
  latest_file_id: number | null;
  latest_version: string | null;
  latest_file_name: string | null;
  version: string | null;
  mod_name: string | null;
  author: string | null;
  category_name: string | null;
  uploaded_time: string | null;
  last_checked: string | null;
  update_available: boolean;
  file_exists: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface ModCreate {
  local_file: string;
  mod_id: number;
  file_id: number;
  game: string;
}

export interface ModUpdate {
  local_file?: string;
  file_id?: number;
  version?: string;
}

export interface LocalFile {
  filename: string;
  size_bytes: number;
  path: string;
  mapped: boolean;
  mod_id?: number | null;
}

export interface UpdateInfo {
  mod_id: number;
  local_file: string;
  version: string;
  current_file_id: number;
  latest_version: string;
  latest_file_id: number;
  latest_file_name: string;
  download_url: string;
  update_available: boolean;
}

export interface ScanResult {
  total_files: number;
  mapped_files: number;
  unmapped_files: number;
  mods_directory: string;
  unmapped_list: string[];
}

export interface NexusmodsMod {
  mod_id: number;
  name: string;
  summary: string | null;
  author: string;
  version: string;
  game: string;
  updated_time: string;
}

export interface NexusmodsFile {
  file_id: number;
  name: string;
  version: string;
  category_name: string;
  size_kb: number;
  uploaded_time: string;
  file_name: string;
}

export interface FluffyStatus {
  running: boolean | null;
  error: string | null;
  installed_ini: boolean;
  session_active: boolean;
}

export interface FluffyCandidate {
  mod_db_id: number;
  mod_name: string | null;
  name: string | null;
  author: string | null;
  version: string | null;
  latest_version: string | null;
  old_archive: string;
  old_exists: boolean;
  new_archive: string | null;
  installed_count: number;
}

export interface FluffyCandidates {
  candidates: FluffyCandidate[];
}

/** Fluffy option IDs are 64-bit, so they are passed as strings */
export interface FluffyOption {
  section: string;
  mod_id: string;
  short_id: string;
  mod_name: string;
}

export interface FluffySessionMod {
  mod_db_id: number;
  mod_name: string | null;
  name: string | null;
  old_version: string | null;
  new_version: string | null;
  old_archive: string;
  new_archive: string;
  matched: Array<{
    folder: string;
    old: FluffyOption;
    new: FluffyOption;
    old_installed: boolean;
    new_installed: boolean;
  }>;
  removed: Array<{ folder: string; old: FluffyOption; old_installed: boolean }>;
  added: string[];
  done: boolean;
}

export interface FluffySession {
  created_at: string;
  uninstall_preset: string | null;
  install_preset: string | null;
  mods: FluffySessionMod[];
  done: boolean;
  /** Set by prepare when Fluffy could not be restarted automatically */
  warning?: string | null;
}

export interface FluffyFinalizeResult {
  updated: number[];
  errors: Array<{ mod_db_id: number; error: string }>;
  leftover_old_archives: string[];
}
