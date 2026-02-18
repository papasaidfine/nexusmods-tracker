/**
 * API client for Nexusmods Tracker backend
 */

import type {
  Mod,
  ModCreate,
  ModUpdate,
  LocalFile,
  UpdateInfo,
  ScanResult,
  NexusmodsMod,
  NexusmodsFile,
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

/**
 * Mods API
 */
export const modsApi = {
  list: () => fetchApi<Mod[]>("/api/mods/"),

  get: (id: number) => fetchApi<Mod>(`/api/mods/${id}`),

  create: (data: ModCreate) =>
    fetchApi<Mod>("/api/mods/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: ModUpdate) =>
    fetchApi<Mod>(`/api/mods/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    fetchApi<{ message: string }>(`/api/mods/${id}`, {
      method: "DELETE",
    }),

  cleanup: () =>
    fetchApi<{ removed: number; details: Array<{ id: number; local_file: string; mod_name: string | null }> }>(
      "/api/mods/cleanup",
      { method: "POST" }
    ),

  markUpdated: (id: number) =>
    fetchApi<Mod>(`/api/mods/${id}/mark-updated`, {
      method: "POST",
    }),
};

/**
 * Local Files API
 */
export const localFilesApi = {
  list: () => fetchApi<LocalFile[]>("/api/local-files/"),

  scan: () =>
    fetchApi<ScanResult>("/api/local-files/scan", {
      method: "POST",
    }),

  delete: (filename: string) =>
    fetchApi<{ message: string }>(`/api/local-files/${encodeURIComponent(filename)}`, {
      method: "DELETE",
    }),

  autoDetect: () =>
    fetchApi<{ updated: number; details: Array<{ mod_id: number; mod_name: string; old_file: string; new_file: string; version: string }> }>(
      "/api/local-files/auto-detect",
      { method: "POST" }
    ),
};

/**
 * Updates API
 */
export const updatesApi = {
  checkAll: () => fetchApi<UpdateInfo[]>("/api/updates/check"),

  checkSingle: (id: number) =>
    fetchApi<UpdateInfo>(`/api/updates/check/${id}`),
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
 * Config API
 */
export const configApi = {
  get: () => fetchApi<{ game: string }>("/api/config"),
};

/**
 * Health Check
 */
export const healthApi = {
  check: () => fetchApi<{ status: string }>("/health"),
};

export { ApiError };
