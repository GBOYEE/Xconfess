import type { SearchFilters } from "@/app/lib/types/search";

const STORAGE_KEY = "xconfess:feed-state";

export interface FeedState {
  query: string;
  filters: SearchFilters;
  scrollY: number;
  timestamp: number;
}

/**
 * Save feed search state to sessionStorage before navigating to detail.
 * Uses sessionStorage so state is scoped to the tab session and
 * automatically cleared when the tab closes.
 */
export function saveFeedState(state: FeedState): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...state, timestamp: Date.now() })
    );
  } catch {
    // sessionStorage may be full or unavailable — fail silently
  }
}

/**
 * Retrieve cached feed state. Returns null if no state exists or
 * if the state is older than the TTL (default 30 minutes).
 */
export function getFeedState(ttlMs = 30 * 60 * 1000): FeedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FeedState;
    if (Date.now() - parsed.timestamp > ttlMs) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Clear cached feed state (e.g. after user explicitly resets search).
 */
export function clearFeedState(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Record current scroll position into the cached feed state.
 * Call this on scroll events (throttled) to keep scroll fresh.
 */
export function recordScrollPosition(): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getFeedState();
    if (existing) {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...existing, scrollY: window.scrollY })
      );
    }
  } catch {
    // ignore
  }
}
