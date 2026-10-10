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
  /** Unset until the file first lands in MODS_DIR (registered while downloading) */
  local_file_mtime: string | null;
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

/** Background check of all tracked mods (GET/POST /api/updates/check-all) */
export interface CheckAllJob {
  running: boolean;
  checked?: number;
  total?: number;
  /** Updates found by this run */
  updates?: number;
  /** All pending updates after the run */
  pending?: number;
  error?: string | null;
  started_at?: string;
  finished_at?: string | null;
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
  /** Options installed in Fluffy per tracked mod DB id (absent = none) */
  installed_counts: Record<string, number>;
  /** Fluffy's state couldn't be read (e.g. an older Fluffy); updates are listed without it */
  fluffy_error: string | null;
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

/** An option reinstalled so it ends up on top of what it overlays */
export interface FluffyReorderItem {
  folder: string;
  archive: string | null;
  option: FluffyOption;
  installed: boolean;
  in_place: boolean;
  uninstall_seen?: boolean;
  done: boolean;
}

export interface FluffySession {
  created_at: string;
  uninstall_preset: string | null;
  install_preset: string | null;
  mods: FluffySessionMod[];
  reorder?: FluffyReorderItem[];
  done: boolean;
  /** Set by prepare when Fluffy could not be restarted automatically */
  warning?: string | null;
}

export interface FluffyFinalizeResult {
  updated: number[];
  errors: Array<{ mod_db_id: number; error: string }>;
  leftover_old_archives: string[];
}

export interface InstallOrderOption {
  section: string;
  archive: string | null;
  /** Position in Fluffy's install order (0 = installed first) */
  position: number;
}

export interface InstallOrderIssue {
  /** misordered: lost files to an option it belongs after (fixable);
   *  overridden: every file replaced by options that legitimately come later */
  kind: "misordered" | "overridden";
  option: InstallOrderOption;
  mod_db_id: number | null;
  files: string[];
  overridden_by: InstallOrderOption[];
  /** False when some file couldn't be compared with the game folder (non-zip archive) */
  verified: boolean;
}

export interface InstallOrder {
  game_dir_found: boolean;
  issues: InstallOrderIssue[];
}

export interface Game {
  /** Nexusmods domain, e.g. monsterhunterwilds */
  id: string;
  name: string;
  mods_dir: string;
  /** Has an equipment view */
  armor: boolean;
}

export type ArmorPart = "helm" | "body" | "arm" | "waist" | "leg" | "slinger";

export interface ArmorSlotOption {
  /** Position in Fluffy's install order (0 = installed first) */
  position: number;
  section: string;
  archive: string | null;
  mod_db_id: number | null;
  mod_name: string | null;
  /** mesh/material change the look; physics and other (prefabs, hair params) don't */
  roles: Array<"mesh" | "material" | "physics" | "other">;
  /** Hunter bodies the option has files for (ch02 male, ch03 female) */
  bodies: Array<"female" | "male">;
  files: number;
  /** Files still the option's own copy; the rest were overwritten by later options */
  owned_files: number;
}

export interface ArmorVariant {
  /** Folder name, e.g. "301" */
  variant: string;
  /** First two digits: which look of the model */
  variety: string;
  /** Last digit: 0 male design, 1 female design */
  design: "male" | "female";
  label: string | null;
  parts: Partial<Record<ArmorPart, ArmorSlotOption[]>>;
}

export interface ArmorModel {
  /** Model ID folder, e.g. "032" */
  model: string;
  /** Armor series using this model */
  series: Array<{ en: string; zh: string }>;
  variants: ArmorVariant[];
}

export interface ArmorOther {
  position: number;
  section: string;
  archive: string | null;
  mod_db_id: number | null;
  mod_name: string | null;
  category: "pak" | "palico" | "weapon" | "reframework" | "other";
  files: number;
}

export interface ArmorOverview {
  models: ArmorModel[];
  /** Installed options that replace no armor */
  others: ArmorOther[];
}
