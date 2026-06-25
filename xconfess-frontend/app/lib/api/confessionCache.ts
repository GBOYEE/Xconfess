import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";
import type {
  GetConfessionByIdResult,
  GetConfessionsResult,
} from "@/app/lib/api/confessions";
import { queryKeys } from "@/app/lib/api/queryKeys";
import type { NormalizedConfession } from "@/app/lib/utils/normalizeConfession";

export type QuerySnapshot = [QueryKey, unknown];

type ConfessionCacheRecord = GetConfessionByIdResult | NormalizedConfession;

// ---------------------------------------------------------------------------
// Scroll position preservation
// ---------------------------------------------------------------------------

const SCROLL_STORAGE_KEY = "xconfess-scroll-positions";
const SCROLL_RESTORE_KEY = "xconfess-scroll-restore";

function readScrollMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SCROLL_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function writeScrollMap(map: Record<string, number>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // silent fail — scroll enhancement is non-critical
  }
}

/**
 * Save the current scroll position for a given route key (e.g. "/search?q=hello").
 * Call this before navigating away from a list view.
 */
export function saveScrollPosition(routeKey: string) {
  if (typeof window === "undefined") return;
  const map = readScrollMap();
  map[routeKey] = window.scrollY;
  writeScrollMap(map);
}

/**
 * Mark a route for scroll restoration on next navigation.
 * The list view component should call this on mount to trigger restore.
 */
export function requestScrollRestore(routeKey: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SCROLL_RESTORE_KEY, routeKey);
  } catch {
    // silent
  }
}

/**
 * If a scroll restore was requested for this route, returns the stored
 * position and clears the request. Otherwise returns null.
 */
export function consumeScrollRestore(routeKey: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const requested = sessionStorage.getItem(SCROLL_RESTORE_KEY);
    if (requested !== routeKey) return null;
    sessionStorage.removeItem(SCROLL_RESTORE_KEY);

    const map = readScrollMap();
    const pos = map[routeKey];
    return typeof pos === "number" ? pos : null;
  } catch {
    return null;
  }
}

function isInfiniteConfessionsResult(
  value: unknown,
): value is InfiniteData<GetConfessionsResult> {
  return (
    typeof value === "object" &&
    value !== null &&
    "pages" in value &&
    Array.isArray((value as InfiniteData<GetConfessionsResult>).pages)
  );
}

function isConfessionCacheRecord(value: unknown): value is ConfessionCacheRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof (value as ConfessionCacheRecord).id === "string"
  );
}

export function snapshotConfessionQueries(
  queryClient: QueryClient,
): QuerySnapshot[] {
  return queryClient.getQueriesData({ queryKey: queryKeys.confessions.all });
}

export function restoreQuerySnapshots(
  queryClient: QueryClient,
  snapshots: QuerySnapshot[] | undefined,
) {
  snapshots?.forEach(([queryKey, data]) => {
    queryClient.setQueryData(queryKey, data);
  });
}

export function updateConfessionQueries(
  queryClient: QueryClient,
  confessionId: string,
  updater: (confession: ConfessionCacheRecord) => ConfessionCacheRecord,
) {
  queryClient.setQueriesData(
    { queryKey: queryKeys.confessions.all },
    (current: unknown) => {
      if (isInfiniteConfessionsResult(current)) {
        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            confessions: page.confessions.map((confession) =>
              confession.id === confessionId ? updater(confession) : confession,
            ),
          })),
        };
      }

      if (isConfessionCacheRecord(current) && current.id === confessionId) {
        return updater(current);
      }

      return current;
    },
  );
}
