"use client";

import { useCallback, useRef } from "react";

const SCROLL_STORAGE_KEY = "xconfess:search-scroll";

interface ScrollPosition {
  x: number;
  y: number;
  timestamp: number;
}

/**
 * Persists and restores scroll position across navigation.
 *
 * - Saves scroll position to sessionStorage before navigating away from the
 *   search feed (when a user clicks on a confession).
 * - Restores scroll position on back navigation if the data is still cached
 *   (within a reasonable time window).
 *
 * Uses sessionStorage (not localStorage) so the state is scoped to the
 * browser tab session and doesn't leak across tabs.
 */
export function useScrollRestoration() {
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveScrollPosition = useCallback(() => {
    if (typeof window === "undefined") return;

    const position: ScrollPosition = {
      x: window.scrollX,
      y: window.scrollY,
      timestamp: Date.now(),
    };

    try {
      sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(position));
    } catch {
      // sessionStorage might be full or unavailable
    }
  }, []);

  const restoreScrollPosition = useCallback((maxAgeMs: number = 30000): boolean => {
    if (typeof window === "undefined") return false;

    try {
      const stored = sessionStorage.getItem(SCROLL_STORAGE_KEY);
      if (!stored) return false;

      const position: ScrollPosition = JSON.parse(stored);
      const age = Date.now() - position.timestamp;

      // Only restore if the saved position is recent enough that the
      // data is likely still in the React Query cache
      if (age > maxAgeMs) {
        sessionStorage.removeItem(SCROLL_STORAGE_KEY);
        return false;
      }

      // Use requestAnimationFrame to ensure the DOM has been painted
      // before we attempt to scroll
      requestAnimationFrame(() => {
        window.scrollTo({
          left: position.x,
          top: position.y,
          behavior: "auto",
        });
      });

      return true;
    } catch {
      return false;
    }
  }, []);

  const clearScrollPosition = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.removeItem(SCROLL_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  /**
   * Debounced scroll saver — saves position at most once per 500ms while
   * the user is actively scrolling.
   */
  const debouncedSaveScrollPosition = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      saveScrollPosition();
    }, 500);
  }, [saveScrollPosition]);

  return {
    saveScrollPosition,
    restoreScrollPosition,
    clearScrollPosition,
    debouncedSaveScrollPosition,
  };
}
