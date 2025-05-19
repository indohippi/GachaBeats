import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Safe timeout function to prevent overflow errors
export function getSafeTimeout(callback: () => void, delay: number): NodeJS.Timeout {
  // Use a much more conservative cap for timeouts to avoid any overflow issues
  // 1000ms (1 second) is plenty for most web applications
  const SAFE_TIMEOUT = 1000;
  
  // Validate and cap the delay
  if (delay <= 0 || delay > SAFE_TIMEOUT || !Number.isFinite(delay)) {
    delay = SAFE_TIMEOUT;
  }
  
  // Use a safe delay that won't cause timeout overflow warnings
  return setTimeout(callback, delay);
}

// Safe interval function to prevent overflow errors
export function getSafeInterval(callback: () => void, delay: number): NodeJS.Timeout {
  // Use a much more conservative cap for intervals to avoid any overflow issues
  // 1000ms (1 second) is plenty for most web applications
  const SAFE_INTERVAL = 1000;
  
  // Validate and cap the delay
  if (delay <= 0 || delay > SAFE_INTERVAL || !Number.isFinite(delay)) {
    delay = SAFE_INTERVAL;
  }
  
  // Use a safe delay that won't cause interval overflow warnings
  return setInterval(callback, delay);
}

// Helper to clear any timer safely
export function clearSafeTimer(timer: NodeJS.Timeout | null): void {
  if (timer) {
    clearTimeout(timer);
  }
}
