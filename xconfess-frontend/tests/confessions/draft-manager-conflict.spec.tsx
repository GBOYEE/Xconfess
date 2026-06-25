import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DraftManager } from "@/app/components/confession/DraftManager";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDrafts = [
  {
    id: "draft-1",
    title: "Test Draft",
    body: "This is a test draft body",
    gender: "male",
    savedAt: Date.now() - 60000,
    characterCount: 24,
  },
  {
    id: "draft-2",
    title: "Older Draft",
    body: "This is an older draft",
    gender: "female",
    savedAt: Date.now() - 120000,
    characterCount: 21,
  },
];

jest.mock("@/app/lib/hooks/useDrafts", () => ({
  useDrafts: () => ({
    drafts: mockDrafts,
    isLoading: false,
    error: null,
    isRemote: true,
    saveDraft: jest.fn().mockResolvedValue("new-id"),
    updateDraft: jest.fn().mockResolvedValue(true),
    deleteDraft: jest.fn().mockResolvedValue(undefined),
    clearDrafts: jest.fn().mockResolvedValue(undefined),
    loadDraft: jest.fn((id: string) => mockDrafts.find((d) => d.id === id)),
  }),
}));

jest.mock("@/app/components/common/Toast", () => ({
  useGlobalToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DraftManager Conflict Recovery", () => {
  const defaultProps = {
    currentDraft: { title: "", body: "", gender: undefined },
    onLoadDraft: jest.fn(),
    autoSaveInterval: 3000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the drafts button with count badge", () => {
    render(<DraftManager {...defaultProps} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /manage drafts/i })).toBeInTheDocument();
  });

  it("opens the drafts modal when clicked", async () => {
    render(<DraftManager {...defaultProps} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /manage drafts/i }));
    expect(screen.getByText("Saved Drafts")).toBeInTheDocument();
  });

  it("shows conflict resolution UI when loading a draft with newer server version", async () => {
    // Simulate local content that differs from server
    const props = {
      ...defaultProps,
      currentDraft: {
        title: "Local Edit",
        body: "Locally edited content that differs from server",
        gender: "male",
      },
    };

    // Make the mock return a newer server version
    const newerDrafts = [
      {
        ...mockDrafts[0],
        savedAt: Date.now(), // newer than local
        body: "Server version of the draft",
      },
    ];

    jest.mocked(require("@/app/lib/hooks/useDrafts").useDrafts).mockReturnValueOnce({
      drafts: newerDrafts,
      isLoading: false,
      error: null,
      isRemote: true,
      saveDraft: jest.fn().mockResolvedValue("new-id"),
      updateDraft: jest.fn().mockResolvedValue(true),
      deleteDraft: jest.fn().mockResolvedValue(undefined),
      clearDrafts: jest.fn().mockResolvedValue(undefined),
      loadDraft: jest.fn((id: string) => newerDrafts.find((d) => d.id === id)),
    });

    render(<DraftManager {...props} />);
    const user = userEvent.setup();

    // Open modal
    await user.click(screen.getByRole("button", { name: /manage drafts/i }));

    // Click on a draft to load it
    await user.click(screen.getByText("Test Draft"));

    // Conflict modal should appear
    expect(screen.getByText("Draft Conflict Detected")).toBeInTheDocument();
    expect(screen.getByText("Keep my current edits")).toBeInTheDocument();
    expect(screen.getByText("Use server version")).toBeInTheDocument();
    expect(screen.getByText("Load selected draft")).toBeInTheDocument();
  });

  it("resolves conflict by keeping local edits", async () => {
    const onLoadDraft = jest.fn();
    const props = {
      ...defaultProps,
      onLoadDraft,
      currentDraft: {
        title: "Local Edit",
        body: "Local content",
        gender: "male",
      },
    };

    const newerDrafts = [
      {
        ...mockDrafts[0],
        savedAt: Date.now(),
        body: "Server version",
      },
    ];

    jest.mocked(require("@/app/lib/hooks/useDrafts").useDrafts).mockReturnValueOnce({
      drafts: newerDrafts,
      isLoading: false,
      error: null,
      isRemote: true,
      saveDraft: jest.fn().mockResolvedValue("new-id"),
      updateDraft: jest.fn().mockResolvedValue(true),
      deleteDraft: jest.fn().mockResolvedValue(undefined),
      clearDrafts: jest.fn().mockResolvedValue(undefined),
      loadDraft: jest.fn((id: string) => newerDrafts.find((d) => d.id === id)),
    });

    render(<DraftManager {...props} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /manage drafts/i }));
    await user.click(screen.getByText("Test Draft"));

    // Click "Keep my current edits"
    await user.click(screen.getByText("Keep my current edits"));

    // onLoadDraft should NOT be called (we keep current content)
    expect(onLoadDraft).not.toHaveBeenCalled();
  });

  it("shows clear drafts confirmation dialog", async () => {
    render(<DraftManager {...defaultProps} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /manage drafts/i }));
    await user.click(screen.getByText("Clear All Drafts"));

    expect(screen.getByText("Clear all drafts?")).toBeInTheDocument();
  });
});
