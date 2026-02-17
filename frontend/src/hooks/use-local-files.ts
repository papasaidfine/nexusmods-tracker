/**
 * SWR hook for local files data
 */
import useSWR from "swr";
import { localFilesApi } from "@/lib/api";
import type { LocalFile, ScanResult } from "@/lib/types";

export function useLocalFiles() {
  const { data, error, isLoading, mutate } = useSWR<LocalFile[]>(
    "/api/local-files",
    localFilesApi.list,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  return {
    files: data,
    isLoading,
    isError: error,
    mutate,
  };
}

export async function scanDirectory() {
  try {
    const result = await localFilesApi.scan();
    return result;
  } catch (error) {
    throw error;
  }
}
