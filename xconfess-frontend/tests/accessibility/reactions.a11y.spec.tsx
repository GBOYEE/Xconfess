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
    liveCounts: { like: 5, love: 3 },
    connectionState: "connected",
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { ReactionButton } from "@/app/components/confession/ReactionButtons";
import { ReactionTooltip } from "@/app/components/confession/ReactionTooltip";

// ---------------------------------------------------------------------------
// ReactionButton group – a11y coverage
// ---------------------------------------------------------------------------

describe("ReactionButton group accessibility", () => {
  const defaultProps = {
    type: "like" as const,
    count: 5,
    confessionId: "c-1",
    isActive: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAddReaction.mockResolvedValue({ ok: true, data: {} });
  });

  it("has no axe violations on the reaction control group", async () => {
    const { container } = render(
      <>
        <ReactionButton type="like" count={5} confessionId="c-1" />
        <ReactionButton type="love" count={3} confessionId="c-1" />
      </>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("wrapper has role=group with descriptive label", () => {
    render(<ReactionButton {...defaultProps} />);
    const group = screen.getByRole("group", { name: /like reaction control/i });
    expect(group).toBeInTheDocument();
  });

  it("button has aria-describedby pointing to tooltip", () => {
    render(<ReactionButton {...defaultProps} />);
    const button = screen.getByRole("button");
    const describedBy = button.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();

    const tooltip = document.getElementById(describedBy!);
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveAttribute("role", "tooltip");
  });

  it("emoji icon is hidden from assistive technology via aria-hidden", () => {
    render(<ReactionButton {...defaultProps} />);
    const { container } = render(<ReactionButton {...defaultProps} />);
    const emoji = container.querySelector("span[aria-hidden='true']");
    expect(emoji).toBeInTheDocument();
  });

  it("count span announces changes via aria-live=polite", () => {
    const { container } = render(<ReactionButton {...defaultProps} />);
    const liveRegion = container.querySelector("[aria-live='polite']");
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute("aria-atomic", "true");
  });

  it("both reaction buttons are reachable by Tab in sequence", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ReactionButton type="like" count={5} confessionId="c-1" />
        <ReactionButton type="love" count={3} confessionId="c-1" />
      </>,
    );

    await user.tab();
    expect(document.activeElement).toHaveAttribute("aria-pressed");

    await user.tab();
    expect(document.activeElement).toHaveAttribute("aria-pressed");
  });

  it("active state is announced via aria-pressed toggle", () => {
    const { rerender } = render(<ReactionButton {...defaultProps} />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-pressed", "false");

    rerender(<ReactionButton {...defaultProps} isActive={true} />);
    expect(button).toHaveAttribute("aria-pressed", "true");
  });
});

// ---------------------------------------------------------------------------
// ReactionTooltip – a11y coverage
// ---------------------------------------------------------------------------

describe("ReactionTooltip accessibility", () => {
  it("has role=tooltip", () => {
    render(<ReactionTooltip id="tip-1" label="like" count={5} active={false} />);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
  });

  it("has an accessible aria-label when not active", () => {
    render(<ReactionTooltip id="tip-2" label="like" count={5} active={false} />);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveAttribute("aria-label", "like, 5");
  });

  it("includes You in aria-label when active", () => {
    render(<ReactionTooltip id="tip-3" label="love" count={2} active={true} />);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveAttribute("aria-label", "love, 2, You");
  });

  it("exposes id for aria-describedby linkage", () => {
    render(<ReactionTooltip id="tip-4" label="like" count={5} active={false} />);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveAttribute("id", "tip-4");
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <ReactionTooltip id="tip-5" label="like" count={5} active={false} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
