"use client";

import { useState, useId, useRef } from "react";
import { cn } from "@/app/lib/utils/cn";
import { useReactions } from "@/app/lib/hooks/useReactions";
import type { ReactionType } from "@/app/lib/types/reaction";

interface Props {
  type: ReactionType;
  count: number;
  confessionId: string;
  isActive?: boolean;
}

export const ReactionButton = ({
  type,
  count,
  confessionId,
  isActive = false,
}: Props) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const { addReaction, isPending, optimisticState } = useReactions({
    initialCounts: { like: 0, love: 0, [type]: count },
    initialUserReaction: isActive ? type : null,
  });
  const labelId = useId();
  const announcementTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use optimistic values when a mutation is in flight so that both the
  // count and the selected (active) state update immediately on click and
  // roll back cleanly if the server rejects the request.
  const displayCount = optimisticState?.counts[type] ?? count;
  const computedIsActive = optimisticState?.userReaction === type || isActive;

  const react = async () => {
    setError(null);
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);

    const result = await addReaction(confessionId, type);
    if (!result.ok) {
      const message = result.error.retryAfter
        ? `Too many reactions. Please wait ${result.error.retryAfter}s.`
        : result.error.message || "Failed to add reaction";
      setError(message);
      setAnnouncement(message);
    } else {
      const action = computedIsActive ? "Removed" : "Added";
      setAnnouncement(`${action} ${type} reaction. Count: ${displayCount}`);
    }

    // Clear announcement after screen reader has had time to read it
    if (announcementTimeout.current) clearTimeout(announcementTimeout.current);
    announcementTimeout.current = setTimeout(() => setAnnouncement(null), 1000);
  };

  const label = computedIsActive
    ? `Reacted with ${type}, current count ${displayCount}`
    : `React with ${type}, current count ${displayCount}`;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    // Enter and Space activate the button natively; we just ensure
    // we prevent accidental double-submit when isPending is true.
    if ((e.key === "Enter" || e.key === " ") && isPending) {
      e.preventDefault();
    }
  };

  return (
    <div className="relative">
      <button
        onClick={react}
        onKeyDown={handleKeyDown}
        disabled={isPending}
        aria-label={label}
        aria-pressed={computedIsActive}
        aria-describedby={error ? labelId : undefined}
        title={error || undefined}
        className={cn(
          "relative flex items-center gap-2 px-4 py-2 rounded-full",
          "min-w-11 min-h-11 touch-manipulation",
          "transition-all duration-200 ease-out",
          "bg-zinc-800 hover:bg-zinc-700",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500",
          "focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
          "active:scale-95",
          computedIsActive && "bg-pink-600 text-white",
          isAnimating && "animate-reaction-bounce",
          error && "ring-2 ring-red-500"
        )}
      >
        <span className="text-lg select-none" aria-hidden="true">
          {type === "like" ? "👍" : "❤️"}
        </span>

        <span className="text-sm font-medium" aria-hidden="true">{displayCount}</span>
      </button>

      {/* Screen reader announcement - aria-live region for state changes */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      {error && (
        <div
          id={labelId}
          role="alert"
          className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap"
        >
          <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
            {error}
          </div>
        </div>
      )}
    </div>
  );
};
