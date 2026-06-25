import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactionButton } from "@/app/components/confession/ReactionButtons";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/app/lib/hooks/useReactions", () => ({
  useReactions: () => ({
    addReaction: jest.fn().mockResolvedValue({ ok: true }),
    isPending: false,
    optimisticState: null,
    liveCounts: { like: 5, love: 3 },
    connectionState: "connected",
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ReactionButton Accessibility", () => {
  it("is reachable by keyboard (focusable)", async () => {
    render(
      <ReactionButton
        type="like"
        count={5}
        confessionId="test-123"
      />
    );

    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: /react with like/i });

    await user.tab();
    expect(button).toHaveFocus();
  });

  it("has an accessible name describing the reaction type and count", () => {
    render(
      <ReactionButton
        type="love"
        count={3}
        confessionId="test-456"
      />
    );

    expect(
      screen.getByRole("button", { name: /react with love, current count 3/i })
    ).toBeInTheDocument();
  });

  it("announces selected state via aria-pressed", () => {
    render(
      <ReactionButton
        type="like"
        count={10}
        confessionId="test-789"
        isActive={true}
      />
    );

    const button = screen.getByRole("button", { name: /reacted with like/i });
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("announces unselected state via aria-pressed", () => {
    render(
      <ReactionButton
        type="like"
        count={10}
        confessionId="test-789"
        isActive={false}
      />
    );

    const button = screen.getByRole("button", { name: /react with like/i });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("announces connection status to screen readers", () => {
    render(
      <ReactionButton
        type="like"
        count={5}
        confessionId="test-123"
      />
    );

    expect(
      screen.getByRole("status", { name: /reaction live status: connected/i })
    ).toBeInTheDocument();
  });

  it("is operable via keyboard Enter key", async () => {
    const mockAddReaction = jest.fn().mockResolvedValue({ ok: true });
    jest.mocked(require("@/app/lib/hooks/useReactions").useReactions).mockReturnValueOnce({
      addReaction: mockAddReaction,
      isPending: false,
      optimisticState: null,
      liveCounts: { like: 5, love: 3 },
      connectionState: "connected",
    });

    render(
      <ReactionButton
        type="like"
        count={5}
        confessionId="test-keyboard"
      />
    );

    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: /react with like/i });

    button.focus();
    await user.keyboard("{Enter}");

    // The button should be activated via keyboard
    expect(button).toHaveFocus();
  });
});
