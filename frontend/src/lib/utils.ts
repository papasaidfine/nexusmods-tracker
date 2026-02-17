import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
