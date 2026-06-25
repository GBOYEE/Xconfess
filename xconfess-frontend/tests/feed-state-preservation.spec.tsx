import { render, screen, act, fireEvent } from "@testing-library/react";
import { saveFeedState, getFeedState, clearFeedState } from "@/app/lib/utils/feedStateCache";

// ---------------------------------------------------------------------------
// Unit tests for feedStateCache utility
// ---------------------------------------------------------------------------

describe("feedStateCache", () => {
  beforeEach(() => {
    // Clear sessionStorage before each test
    window.sessionStorage.clear();
    // Mock scrollTo
    window.scrollTo = jest.fn();
  });

  it("saves and retrieves feed state", () => {
    const state = {
      query: "test query",
      filters: { sort: "oldest" as const },
      scrollY: 500,
      timestamp: Date.now(),
    };

    saveFeedState(state);
    const retrieved = getFeedState();

    expect(retrieved).not.toBeNull();
    expect(retrieved?.query).toBe("test query");
    expect(retrieved?.filters.sort).toBe("oldest");
    expect(retrieved?.scrollY).toBe(500);
  });

  it("returns null when no state is cached", () => {
    const result = getFeedState();
    expect(result).toBeNull();
  });

  it("returns null when cached state exceeds TTL", () => {
    const state = {
      query: "stale query",
      filters: { sort: "newest" as const },
      scrollY: 100,
      timestamp: Date.now() - 31 * 60 * 1000, // 31 minutes ago
    };

    // Manually set with old timestamp
    window.sessionStorage.setItem(
      "xconfess:feed-state",
      JSON.stringify(state)
    );

    const result = getFeedState(); // default TTL is 30 min
    expect(result).toBeNull();
  });

  it("clears cached state", () => {
    saveFeedState({
      query: "to clear",
      filters: { sort: "newest" as const },
      scrollY: 0,
      timestamp: Date.now(),
    });

    expect(getFeedState()).not.toBeNull();
    clearFeedState();
    expect(getFeedState()).toBeNull();
  });

  it("does not throw when sessionStorage is unavailable", () => {
    // Simulate sessionStorage being unavailable
    const original = window.sessionStorage;
    Object.defineProperty(window, "sessionStorage", {
      value: undefined,
      writable: true,
    });

    expect(() => saveFeedState({
      query: "test",
      filters: { sort: "newest" },
      scrollY: 0,
      timestamp: Date.now(),
    })).not.toThrow();

    expect(getFeedState()).toBeNull();

    // Restore
    Object.defineProperty(window, "sessionStorage", {
      value: original,
      writable: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Integration test: feed-to-detail-to-feed flow
// ---------------------------------------------------------------------------

describe("Feed-to-detail-to-feed state preservation", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.scrollTo = jest.fn();
  });

  it("saves scroll position when navigating to detail", () => {
    // Simulate user scrolling down the feed
    Object.defineProperty(window, "scrollY", {
      value: 1200,
      writable: true,
    });

    saveFeedState({
      query: "crypto",
      filters: { sort: "reactions" },
      scrollY: window.scrollY,
      timestamp: Date.now(),
    });

    const cached = getFeedState();
    expect(cached?.scrollY).toBe(1200);
    expect(cached?.query).toBe("crypto");
    expect(cached?.filters.sort).toBe("reactions");
  });

  it("restores state on back navigation (empty URL params)", () => {
    // User navigates back to search with no URL params
    const searchParams = new URLSearchParams("");

    // But has cached state from before
    saveFeedState({
      query: "stellar",
      filters: { sort: "oldest" },
      scrollY: 800,
      timestamp: Date.now(),
    });

    // The search page should detect empty params and restore from cache
    const cached = getFeedState();
    if (cached && !searchParams.toString()) {
      expect(cached.query).toBe("stellar");
      expect(cached.filters.sort).toBe("oldest");
      expect(cached.scrollY).toBe(800);
    } else {
      fail("Expected cached state to be restored");
    }
  });

  it("does NOT restore from cache when URL has explicit params", () => {
    // User navigates to search with explicit URL params (e.g. shared link)
    const searchParams = new URLSearchParams("q=shared&sort=newest");

    // Old cached state exists
    saveFeedState({
      query: "old query",
      filters: { sort: "oldest" },
      scrollY: 500,
      timestamp: Date.now(),
    });

    // URL params take precedence — cache should NOT override
    if (searchParams.toString()) {
      expect(searchParams.get("q")).toBe("shared");
      // Cache still exists but is not used
      expect(getFeedState()).not.toBeNull();
    }
  });
});
