"use client";

import { useCallback, useEffect, useRef } from "react";
import type { SearchFilters } from "@/app/lib/types/search";
import {
  saveFeedState,
  getFeedState,
  clearFeedState,
  recordScrollPosition,
} from "@/app/lib/utils/feedStateCache";

const SCROLL_THROTTLE_MS = 200;

interface UseFeedStatePersistenceOptions {
  query: string;
  filters: SearchFilters;
  isInitialized: boolean;
}

/**
 * Hook that persists feed search state across navigation.
 *
 * - On mount: restores cached state (query, filters, scroll) if available
 * - On query/filter change: saves to sessionStorage
 * - On scroll: throttled scroll position recording
 * - Provides a restoreScroll callback for after data loads
 */
export function useFeedStatePersistence({
  query,
  filters,
  isInitialized,
}: UseFeedStatePersistenceOptions) {
  const lastScrollRecord = useRef(0);

  // Save state whenever query or filters change (after initial hydration)
  useEffect(() => {
    if (!isInitialized) return;
    saveFeedState({
      query,
      filters,
      scrollY: window.scrollY,
      timestamp: Date.now(),
    });
  }, [query, filters, isInitialized]);

  // Throttled scroll listener to keep scroll position fresh
  useEffect(() => {
    if (!isInitialized) return;

    function onScroll() {
      const now = Date.now();
      if (now - lastScrollRecord.current < SCROLL_THROTTLE_MS) return;
      lastScrollRecord.current = now;
      recordScrollPosition();
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isInitialized]);

  const restoreScroll = useCallback(() => {
    const cached = getFeedState();
    if (cached && cached.scrollY > 0) {
      // Use requestAnimationFrame to ensure DOM has settled
      requestAnimationFrame(() => {
        window.scrollTo({ top: cached.scrollY, behavior: "auto" });
      });
    }
  }, []);

  const clearState = useCallback(() => {
    clearFeedState();
  }, []);

  return { restoreScroll, clearState };
}
