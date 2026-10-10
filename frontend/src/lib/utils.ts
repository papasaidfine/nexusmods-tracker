import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface BatchSchedule {
  batchSize: number
  /** Gap between tabs within a batch */
  intervalMs: number
  /** Extra pause after each full batch */
  batchPauseMs: number
}

/**
 * Open URLs in new tabs in batches (e.g. 5 tabs 2s apart, then a 10s pause) so a
 * long list of download pages doesn't hit the site all at once. Only the first
 * open counts as a user gesture; the rest need pop-ups allowed for this site.
 * Returns null if the first tab was blocked, else a function that stops the rest.
 */
export function openUrlsInBatches(
  urls: string[],
  schedule: BatchSchedule,
  callbacks: { onOpened: (count: number) => void; onBlocked: (url: string) => void }
): (() => void) | null {
  const unique = [...new Set(urls)]
  if (unique.length === 0) return () => {}
  if (!window.open(unique[0], "_blank")) return null
  callbacks.onOpened(1)

  const { batchSize, intervalMs, batchPauseMs } = schedule
  const batchMs = (batchSize - 1) * intervalMs + batchPauseMs
  const timers = unique.slice(1).map((url, j) => {
    const i = j + 1
    const delay = Math.floor(i / batchSize) * batchMs + (i % batchSize) * intervalMs
    return setTimeout(() => {
      if (window.open(url, "_blank")) callbacks.onOpened(i + 1)
      else callbacks.onBlocked(url)
    }, delay)
  })
  return () => timers.forEach(clearTimeout)
}

/**
 * Format bytes to human-readable file size
 */
export function formatFileSize(bytes: number): string {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  if (bytes === 0) return "0 Bytes"
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const size = bytes / Math.pow(1024, i)
  return `${size.toFixed(2)} ${sizes[i]}`
}

/**
 * Parse a timestamp from the backend. It stores UTC without an offset
 * (datetime.utcnow().isoformat()), which Date would read as local time.
 */
export function parseServerDate(dateString: string): Date {
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(dateString)
  return new Date(hasZone ? dateString : `${dateString}Z`)
}

/**
 * Format date string to readable format
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) return "Never"
  try {
    return format(parseServerDate(dateString), "MMM d, yyyy HH:mm")
  } catch {
    return "Invalid date"
  }
}

/**
 * Format date string to relative time
 */
export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return "Never"
  try {
    return formatDistanceToNow(parseServerDate(dateString), { addSuffix: true })
  } catch {
    return "Invalid date"
  }
}
