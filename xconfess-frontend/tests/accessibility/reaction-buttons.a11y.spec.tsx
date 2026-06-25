/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactionButton } from "@/app/components/confession/ReactionButtons";

jest.mock("@/app/lib/api/reactions", () => ({
  addReaction: jest.fn(),
}));

import { addReaction } from "@/app/lib/api/reactions";

const mockAddReaction = addReaction as jest.MockedFunction<typeof addReaction>;

Object.defineProperty(window, "localStorage", {
  value: { getItem: jest.fn(() => "anon-user-1"), setItem: jest.fn(), removeItem: jest.fn() },
  writable: true,
});

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const client = React.useMemo(() => createClient(), []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("ReactionButton — accessibility", () => {
  beforeEach(() => jest.clearAllMocks());

  it("has an accessible label describing the reaction action and count", () => {
    mockAddReaction.mockResolvedValue({ ok: true, data: {} });
    render(
      <Wrapper>
        <ReactionButton type="like" count={5} confessionId="c-1" />
      </Wrapper>,
    );

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-label", /React with like/);
  });

  it("announces state changes via aria-live region on successful reaction", async () => {
    mockAddReaction.mockResolvedValue({
      ok: true,
      data: { success: true, reactions: { like: 6, love: 0 } },
    });

    render(
      <Wrapper>
        <ReactionButton type="like" count={5} confessionId="c-1" />
      </Wrapper>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    // The aria-live region should announce the reaction was added
    const liveRegion = screen.getByRole("status");
    await waitFor(() => {
      expect(liveRegion).toHaveTextContent(/Added|Removed/);
    });
  });

  it("marks aria-pressed correctly for active state", () => {
    mockAddReaction.mockResolvedValue({ ok: true, data: {} });
    render(
      <Wrapper>
        <ReactionButton type="love" count={3} confessionId="c-1" isActive={true} />
      </Wrapper>,
    );

    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("is keyboard focusable and activates on Enter key", async () => {
    mockAddReaction.mockResolvedValue({
      ok: true,
      data: { success: true, reactions: { like: 6, love: 0 } },
    });

    render(
      <Wrapper>
        <ReactionButton type="like" count={5} confessionId="c-1" />
      </Wrapper>,
    );

    const button = screen.getByRole("button");
    button.focus();
    expect(button).toHaveFocus();

    // Enter activates the button
    await act(async () => {
      fireEvent.keyDown(button, { key: "Enter" });
    });

    await waitFor(() => {
      expect(mockAddReaction).toHaveBeenCalled();
    });
  });

  it("is keyboard focusable and activates on Space key", async () => {
    mockAddReaction.mockResolvedValue({
      ok: true,
      data: { success: true, reactions: { like: 6, love: 0 } },
    });

    render(
      <Wrapper>
        <ReactionButton type="like" count={5} confessionId="c-1" />
      </Wrapper>,
    );

    const button = screen.getByRole("button");
    button.focus();

    // Space activates the button
    await act(async () => {
      fireEvent.keyDown(button, { key: " " });
    });

    await waitFor(() => {
      expect(mockAddReaction).toHaveBeenCalled();
    });
  });

  it("associates error message with button via aria-describedby", async () => {
    mockAddReaction.mockResolvedValue({
      ok: false,
      error: { message: "Too many reactions", code: "RATE_LIMIT" },
    });

    render(
      <Wrapper>
        <ReactionButton type="like" count={2} confessionId="c-3" />
      </Wrapper>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    await waitFor(() => {
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-describedby");
      expect(screen.getByRole("alert")).toHaveTextContent("Too many reactions");
    });
  });

  it("prevents double-submit when pressing Enter rapidly during pending state", async () => {
    // Never resolves — keeps mutation in pending state
    mockAddReaction.mockReturnValue(new Promise(() => {}));

    render(
      <Wrapper>
        <ReactionButton type="like" count={5} confessionId="c-1" />
      </Wrapper>,
    );

    const button = screen.getByRole("button");

    await act(async () => {
      fireEvent.click(button);
    });

    // Second click should be ignored because isPending is true
    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockAddReaction).toHaveBeenCalledTimes(1);
  });
});
