/**
 * SWR hook for updates data
 */
import useSWR from "swr";
import { updatesApi } from "@/lib/api";
import type { UpdateInfo } from "@/lib/types";

export function useUpdates(autoCheck = false) {
  const { data, error, isLoading, mutate } = useSWR<UpdateInfo[]>(
    autoCheck ? "/api/updates/check" : null,
    updatesApi.checkAll,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      // Don't auto-fetch - user must manually trigger
      revalidateIfStale: false,
    }
  );

  return {
    updates: data,
    isLoading,
    isError: error,
    checkUpdates: mutate,
  };
}

export async function checkUpdatesManually() {
  try {
    const updates = await updatesApi.checkAll();
    return updates;
  } catch (error) {
    throw error;
  }
}

export async function checkSingleUpdate(id: number) {
  try {
    const update = await updatesApi.checkSingle(id);
    return update;
  } catch (error) {
    throw error;
  }
}
