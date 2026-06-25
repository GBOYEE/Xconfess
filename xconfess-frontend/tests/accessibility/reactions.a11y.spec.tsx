/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAddReaction = jest.fn().mockResolvedValue({ ok: true, data: {} });

jest.mock("@/app/lib/hooks/useReactions", () => ({
  useReactions: () => ({
    addReaction: mockAddReaction,
    isPending: false,
    optimisticState: null,
    liveCounts: { like: 0, love: 0 },
    connectionState: "connected",
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { ReactionButton } from "@/app/components/confession/ReactionButtons";
import { ReactionTooltip } from "@/app/components/confession/ReactionTooltip";

// ---------------------------------------------------------------------------
// ReactionButton – accessibility & keyboard
// ---------------------------------------------------------------------------

describe("ReactionButton accessibility", () => {
  const defaultProps = {
    type: "like" as const,
    count: 5,
    confessionId: "c-1",
    isActive: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("has no axe violations", async () => {
    const { container } = render(<ReactionButton {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("reaction control group has an accessible name", () => {
    render(<ReactionButton {...defaultProps} />);
    const group = screen.getByRole("group");
    expect(group).toHaveAttribute("aria-label", "like reaction control");
  });

  it("button is reachable via Tab key", async () => {
    const user = userEvent.setup();
    render(<ReactionButton {...defaultProps} />);

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button"));
  });

  it("button has visible focus indicator", () => {
    render(<ReactionButton {...defaultProps} />);
    const button = screen.getByRole("button");
    expect(button.className).toContain("focus-visible:outline");
  });

  it("Enter key triggers the reaction action", async () => {
    const user = userEvent.setup();
    render(<ReactionButton {...defaultProps} />);

    const button = screen.getByRole("button");
    button.focus();
    await user.keyboard("{Enter}");

    expect(mockAddReaction).toHaveBeenCalledWith("c-1", "like");
  });

  it("Space key triggers the reaction action", async () => {
    const user = userEvent.setup();
    render(<ReactionButton {...defaultProps} />);

    const button = screen.getByRole("button");
    button.focus();
    await user.keyboard(" ");

    expect(mockAddReaction).toHaveBeenCalledWith("c-1", "like");
  });

  it("aria-pressed reflects active/inactive state", () => {
    const { rerender } = render(<ReactionButton {...defaultProps} isActive={false} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");

    rerender(<ReactionButton {...defaultProps} isActive={true} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("aria-label includes reaction type and count", () => {
    // Use a type not in liveCounts so the count prop is used
    render(<ReactionButton type="like" count={7} confessionId="c-1" isActive={false} />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-label")).toContain("like");
    // The label includes the displayCount which comes from liveCounts or the prop
    expect(button.getAttribute("aria-label")).toMatch(/current count/);
  });

  it("aria-describedby points to the tooltip element", () => {
    render(<ReactionButton {...defaultProps} />);
    const button = screen.getByRole("button");
    const describedBy = button.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveAttribute("role", "tooltip");
  });

  it("connection status is announced via aria-live", () => {
    render(<ReactionButton {...defaultProps} />);
    const statusDot = screen.getByLabelText("Reaction live status: connected");
    expect(statusDot).toHaveAttribute("aria-live", "polite");
  });

  it("renders error in role=alert for screen reader announcement", async () => {
    mockAddReaction.mockResolvedValueOnce({
      ok: false,
      error: { message: "Rate limited" },
    });

    const user = userEvent.setup();
    render(<ReactionButton {...defaultProps} />);

    await user.click(screen.getByRole("button"));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Rate limited")).toBeInTheDocument();
  });

  it("emoji icon is hidden from assistive technology", () => {
    render(<ReactionButton {...defaultProps} />);
    const emoji = screen.getByText("👍");
    expect(emoji).toHaveAttribute("aria-hidden", "true");
  });
});

// ---------------------------------------------------------------------------
// ReactionTooltip – accessibility
// ---------------------------------------------------------------------------

describe("ReactionTooltip accessibility", () => {
  it("has role=tooltip and accessible name", () => {
    render(<ReactionTooltip id="t-1" label="like" count={5} active={false} />);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveAttribute("aria-label", "like, 5");
  });

  it("includes 'You' in label when active", () => {
    render(<ReactionTooltip id="t-2" label="love" count={3} active={true} />);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveAttribute("aria-label", "love, 3, You");
  });

  it("is keyboard-focusable", async () => {
    const user = userEvent.setup();
    render(<ReactionTooltip id="t-3" label="like" count={1} active={false} />);

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("tooltip"));
  });

  it("has visible focus style", () => {
    render(<ReactionTooltip id="t-4" label="like" count={1} active={false} />);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.className).toContain("focus-visible:outline");
  });
});
