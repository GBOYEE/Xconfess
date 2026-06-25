"use client";

import { useEffect, useRef, useCallback } from "react";

const SCROLL_STORAGE_KEY = "xconfess_scroll_positions";

function getScrollPositions(): Record<string, number> {
  try {
    const stored = sessionStorage.getItem(SCROLL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveScrollPositions(positions: Record<string, number>) {
  try {
    sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // sessionStorage unavailable
  }
}

/**
 * Hook that saves scroll position before navigation and restores it on
 * back/forward navigation (popstate events).
 *
 * @param key - Unique key for this page's scroll position (e.g. pathname + search)
 */
export function useScrollRestoration(key: string) {
  const isRestoringRef = useRef(false);
  const currentKeyRef = useRef(key);

  // Keep key in sync
  useEffect(() => {
    currentKeyRef.current = key;
  }, [key]);

  // Save scroll position on scroll (debounced) and before unload
  useEffect(() => {
    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        const positions = getScrollPositions();
        positions[currentKeyRef.current] = window.scrollY;
        saveScrollPositions(positions);
        rafId = null;
      });
    };

    // Save scroll position before navigating away (link clicks)
    const handleBeforeUnload = () => {
      const positions = getScrollPositions();
      positions[currentKeyRef.current] = window.scrollY;
      saveScrollPositions(positions);
    };

    // Restore scroll on popstate (back/forward navigation)
    const handlePopState = () => {
      const positions = getScrollPositions();
      const saved = positions[currentKeyRef.current];
      if (saved !== undefined && saved > 0) {
        isRestoringRef.current = true;
        // Wait for React to render the page, then restore scroll
        requestAnimationFrame(() => {
          window.scrollTo({ top: saved, behavior: "instant" });
          // Allow normal scroll behavior after restoration completes
          requestAnimationFrame(() => {
            isRestoringRef.current = false;
          });
        });
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("pagehide", handleBeforeUnload);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pagehide", handleBeforeUnload);
    };
  }, []);

  // Restore scroll on mount (handles case where page is restored from bfcache)
  const restoreScroll = useCallback(() => {
    const positions = getScrollPositions();
    const saved = positions[currentKeyRef.current];
    if (saved !== undefined && saved > 0) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: saved, behavior: "instant" });
      });
    }
  }, []);

  return { restoreScroll };
}
