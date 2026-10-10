/**
 * API client for Nexusmods Tracker backend
 */

import type {
  Mod,
  ModCreate,
  ModUpdate,
  LocalFile,
  UpdateInfo,
  CheckAllJob,
  ScanResult,
  NexusmodsMod,
  NexusmodsFile,
  FluffyStatus,
  FluffyCandidates,
  FluffySession,
  FluffyFinalizeResult,
  InstallOrder,
  Game,
  ArmorOverview,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.detail || `HTTP ${response.status}`,
        response.status,
        errorData
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error instanceof Error ? error.message : "Network error",
      0
    );
  }
}

/** Per-game endpoints live under /api/games/{game} */
const g = (game: string, path: string) => `/api/games/${encodeURIComponent(game)}${path}`;

/**
 * Games API
 */
export const gamesApi = {
  list: () => fetchApi<Game[]>("/api/games"),
};

/**
 * Mods API
 */
export const modsApi = {
  list: (game: string) => fetchApi<Mod[]>(g(game, "/mods/")),

  get: (game: string, id: number) => fetchApi<Mod>(g(game, `/mods/${id}`)),

  create: (game: string, data: ModCreate) =>
    fetchApi<Mod>(g(game, "/mods/"), {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (game: string, id: number, data: ModUpdate) =>
    fetchApi<Mod>(g(game, `/mods/${id}`), {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (game: string, id: number) =>
    fetchApi<{ message: string }>(g(game, `/mods/${id}`), {
      method: "DELETE",
    }),

  cleanup: (game: string) =>
    fetchApi<{ removed: number; details: Array<{ id: number; local_file: string; mod_name: string | null }> }>(g(game, "/mods/cleanup"),
      { method: "POST" }
    ),

  markUpdated: (game: string, id: number) =>
    fetchApi<Mod>(g(game, `/mods/${id}/mark-updated`), {
      method: "POST",
    }),
};

/**
 * Local Files API
 */
export const localFilesApi = {
  list: (game: string) => fetchApi<LocalFile[]>(g(game, "/local-files/")),

  scan: (game: string) =>
    fetchApi<ScanResult>(g(game, "/local-files/scan"), {
      method: "POST",
    }),

  delete: (game: string, filename: string) =>
    fetchApi<{ message: string }>(g(game, `/local-files/${encodeURIComponent(filename)}`), {
      method: "DELETE",
    }),

  autoDetect: (game: string) =>
    fetchApi<{ updated: number; details: Array<{ mod_id: number; mod_name: string; old_file: string; new_file: string; version: string }> }>(g(game, "/local-files/auto-detect"),
      { method: "POST" }
    ),
};

/**
 * Updates API
 */
export const updatesApi = {
  checkAll: (game: string) => fetchApi<UpdateInfo[]>(g(game, "/updates/check")),

  checkSingle: (game: string, id: number) =>
    fetchApi<UpdateInfo>(g(game, `/updates/check/${id}`)),

  startCheckAll: (game: string) =>
    fetchApi<CheckAllJob>(g(game, "/updates/check-all"), { method: "POST" }),

  checkAllStatus: (game: string) => fetchApi<CheckAllJob>(g(game, "/updates/check-all")),
};


/**
 * Nexusmods API (direct)
 */
export const nexusmodsApi = {
  getMod: (game: string, modId: number) =>
    fetchApi<NexusmodsMod>(`/api/nexusmods/mods/${game}/${modId}`),

  getFiles: (game: string, modId: number) =>
    fetchApi<NexusmodsFile[]>(`/api/nexusmods/files/${game}/${modId}`),
};

/**
 * Fluffy Mod Manager API
 */
export const fluffyApi = {
  status: (game: string) => fetchApi<FluffyStatus>(g(game, "/fluffy/status")),

  candidates: (game: string) => fetchApi<FluffyCandidates>(g(game, "/fluffy/candidates")),

  session: (game: string) => fetchApi<FluffySession | null>(g(game, "/fluffy/session")),

  prepare: (game: string, items: Array<{ mod_db_id: number; new_archive: string }>) =>
    fetchApi<FluffySession>(g(game, "/fluffy/prepare"), {
      method: "POST",
      body: JSON.stringify({ items }),
    }),

  finalize: (game: string) =>
    fetchApi<FluffyFinalizeResult>(g(game, "/fluffy/finalize"), { method: "POST" }),

  cancel: (game: string) =>
    fetchApi<{ message: string }>(g(game, "/fluffy/cancel"), { method: "POST" }),

  installOrder: (game: string) => fetchApi<InstallOrder>(g(game, "/fluffy/install-order")),

  fixOrder: (game: string) => fetchApi<FluffySession>(g(game, "/fluffy/fix-order"), { method: "POST" }),
};

/**
 * Armor API (games with an equipment view)
 */
export const armorApi = {
  get: (game: string) => fetchApi<ArmorOverview>(g(game, "/armor/")),

  setLabel: (game: string, model: string, variety: string, label: string | null) =>
    fetchApi<Record<string, string>>(g(game, "/armor/labels"), {
      method: "PUT",
      body: JSON.stringify({ model, variety, label }),
    }),
};

/**
 * Health Check
 */
export const healthApi = {
  check: () => fetchApi<{ status: string }>("/health"),
};

export { ApiError };
