"use client";

import { useState, useRef, useId } from "react";
import { cn } from "@/app/lib/utils/cn";

interface Props {
  label: string;
  count: number;
  active: boolean;
  children: React.ReactNode;
}

/**
 * Accessible tooltip for reaction controls.
 *
 * - Uses `aria-describedby` on the trigger so screen readers announce the
 *   tooltip content (label, count, active state) on focus/hover.
 *   The tooltip itself is hidden from the a11y tree to avoid double
 *   announcements.
 * - The tooltip has `role="tooltip"` and a stable `id` generated via
 *   `useId()` so multiple reaction buttons can each have a unique tooltip.
 */
export const ReactionTooltip = ({ label, count, active, children }: Props) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();
  const triggerRef = useRef<HTMLDivElement>(null);

  const tooltipText = `${label} — ${count} reaction${count === 1 ? "" : "s"}${
    active ? " (you reacted)" : ""
  }`;

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
      aria-describedby={isVisible ? tooltipId : undefined}
    >
      {children}
      {isVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={cn(
            "absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2",
            "rounded-md bg-zinc-900 px-3 py-1.5 text-xs text-white shadow-lg",
            "border border-zinc-700 whitespace-nowrap",
            "pointer-events-none"
          )}
        >
          {label} — {count}
          {active && <span className="ml-1 text-pink-400">(You)</span>}
        </div>
      )}
    </div>
  );
};
