import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Safe timeout function to prevent overflow errors
export function getSafeTimeout(callback: () => void, delay: number): NodeJS.Timeout {
  // Prevent JavaScript timeout overflow (max 2^31 - 1 = ~24.8 days)
  const MAX_TIMEOUT = 2147483647; // (2^31 - 1)
  
  if (delay > MAX_TIMEOUT) {
    // For extremely long timeouts, cap to the maximum safe value
    console.warn(`Timeout value ${delay}ms exceeds maximum safe timeout. Capped to ${MAX_TIMEOUT}ms.`);
    delay = MAX_TIMEOUT;
  }
  
  // Use a safe delay that won't cause timeout overflow warnings
  return setTimeout(callback, delay);
}

// Safe interval function to prevent overflow errors
export function getSafeInterval(callback: () => void, delay: number): NodeJS.Timeout {
  // Prevent JavaScript interval overflow (max 2^31 - 1 = ~24.8 days)
  const MAX_INTERVAL = 2147483647; // (2^31 - 1)
  
  if (delay > MAX_INTERVAL) {
    // For extremely long intervals, cap to the maximum safe value
    console.warn(`Interval value ${delay}ms exceeds maximum safe interval. Capped to ${MAX_INTERVAL}ms.`);
    delay = MAX_INTERVAL;
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
