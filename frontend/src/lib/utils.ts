import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Open each URL in a new tab. Browsers only allow one popup per click unless
 * popups are allowed for this site, so returns the URLs that were blocked.
 */
export function openUrlsInNewTabs(urls: string[]): string[] {
  const blocked: string[] = []
  for (const url of new Set(urls)) {
    const win = window.open(url, "_blank")
    if (!win) blocked.push(url)
  }
  return blocked
}

/**
 * Open URLs in new tabs one by one, intervalMs apart, so download pages don't hit
 * the site all at once. Only the first open counts as a user gesture; the rest need
 * pop-ups allowed for this site. Returns false if the first tab was blocked.
 */
export function openUrlsStaggered(
  urls: string[],
  intervalMs: number,
  onBlocked: (url: string) => void
): boolean {
  const [first, ...rest] = [...new Set(urls)]
  if (!first) return true
  if (!window.open(first, "_blank")) return false
  rest.forEach((url, i) => {
    setTimeout(() => {
      if (!window.open(url, "_blank")) onBlocked(url)
    }, (i + 1) * intervalMs)
  })
  return true
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
 * Format date string to readable format
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) return "Never"
  try {
    return format(new Date(dateString), "MMM d, yyyy HH:mm")
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
    return formatDistanceToNow(new Date(dateString), { addSuffix: true })
  } catch {
    return "Invalid date"
  }
}
