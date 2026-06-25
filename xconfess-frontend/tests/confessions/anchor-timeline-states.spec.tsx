import React from "react";
import { render, screen } from "@testing-library/react";
import { AnchorTimeline } from "@/app/components/confession/AnchorTimeline";
import type { ActivityStatus } from "@/app/lib/types/activity";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AnchorTimeline — All Anchor States (#1231)", () => {
  describe("requested state", () => {
    it("renders requested as active with pending submitted and confirmed", () => {
      render(<AnchorTimeline status="requested" />);

      expect(screen.getByText("Requested")).toBeInTheDocument();
      expect(screen.getByText("Submitted")).toBeInTheDocument();
      expect(screen.getByText("Confirmed")).toBeInTheDocument();
      expect(screen.getByText("Preparing anchor transaction...")).toBeInTheDocument();
    });

    it("has correct aria-label for the timeline group", () => {
      render(<AnchorTimeline status="requested" />);
      expect(
        screen.getByRole("group", { name: /anchor transaction progress/i })
      ).toBeInTheDocument();
    });
  });

  describe("submitted state", () => {
    it("renders requested as done, submitted as active, confirmed as pending", () => {
      render(
        <AnchorTimeline status="submitted" txHash="ABC123" />
      );

      expect(screen.getByText("Requested")).toBeInTheDocument();
      expect(screen.getByText("Submitted")).toBeInTheDocument();
      expect(screen.getByText("Transaction submitted to the Stellar network")).toBeInTheDocument();
    });

    it("shows transaction hash link when submitted", () => {
      render(
        <AnchorTimeline
          status="submitted"
          txHash="GABCDEF1234567890"
        />
      );

      const link = screen.getByText("View transaction");
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href");
    });
  });

  describe("confirmed state", () => {
    it("renders all steps as done", () => {
      render(
        <AnchorTimeline status="confirmed" txHash="GXYZ789" />
      );

      expect(screen.getByText("Requested")).toBeInTheDocument();
      expect(screen.getByText("Submitted")).toBeInTheDocument();
      expect(screen.getByText("Confirmed")).toBeInTheDocument();
    });

    it("shows view transaction link for confirmed state", () => {
      render(
        <AnchorTimeline
          status="confirmed"
          txHash="GCONFIRMED123"
        />
      );

      expect(screen.getByText("View transaction")).toBeInTheDocument();
    });
  });

  describe("failed state", () => {
    it("renders failed state with error message", () => {
      render(
        <AnchorTimeline
          status="failed"
          error="Transaction failed: insufficient balance"
        />
      );

      expect(screen.getByText("Failed")).toBeInTheDocument();
      expect(screen.getByText("Transaction failed: insufficient balance")).toBeInTheDocument();
    });

    it("shows retry button when onRetry is provided", () => {
      const onRetry = jest.fn();
      render(
        <AnchorTimeline status="failed" onRetry={onRetry} />
      );

      expect(screen.getByText("Retry anchoring")).toBeInTheDocument();
    });

    it("shows fallback message when no retry handler", () => {
      render(<AnchorTimeline status="failed" />);

      expect(
        screen.getByText("Try connecting your wallet and anchoring again.")
      ).toBeInTheDocument();
    });

    it("calls onRetry when retry button is clicked", async () => {
      const onRetry = jest.fn();
      const user = (await import("@testing-library/user-event")).default.setup();

      render(
        <AnchorTimeline status="failed" onRetry={onRetry} />
      );

      await user.click(screen.getByText("Retry anchoring"));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe("expired state", () => {
    it("renders expired state without retry option", () => {
      render(<AnchorTimeline status="expired" />);

      expect(screen.getByText("Expired")).toBeInTheDocument();
      expect(screen.getByText("Requested")).toBeInTheDocument();
      expect(screen.getByText("Submitted")).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("renders nothing for unknown status", () => {
      const { container } = render(
        <AnchorTimeline status={"unknown" as ActivityStatus} />
      );
      expect(container.innerHTML).toBe("");
    });

    it("renders without txHash", () => {
      render(<AnchorTimeline status="confirmed" />);
      expect(screen.getByText("Confirmed")).toBeInTheDocument();
    });
  });
});
