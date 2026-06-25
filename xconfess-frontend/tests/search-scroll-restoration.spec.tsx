import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const storage: Record<string, string> = {};
Object.defineProperty(window, "sessionStorage", {
  value: {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, value: string) => { storage[key] = value; },
    removeItem: (key: string) => { delete storage[key]; },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
  },
  writable: true,
});

const mockScrollTo = jest.fn();
Object.defineProperty(window, "scrollTo", {
  value: mockScrollTo,
  writable: true,
});

// ---------------------------------------------------------------------------
// Next.js mocks
// ---------------------------------------------------------------------------

let currentSearchParams = new URLSearchParams("");
const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  usePathname: () => "/search",
  useSearchParams: () => currentSearchParams,
}));

jest.mock("@/app/lib/hooks/useSearch", () => ({
  useSearch: () => ({
    results: [],
    total: 0,
    hasMore: false,
    page: 1,
    isLoading: false,
    isRetrying: false,
    error: null,
    statusMeta: null,
    loadMore: jest.fn(),
    reset: jest.fn(),
    retry: jest.fn(),
  }),
}));

jest.mock("@/app/lib/hooks/useFocusTrap", () => ({
  useFocusTrap: jest.fn(),
}));

jest.mock("@/app/components/search/SearchResults", () => ({
  SearchResults: () => <div data-testid="search-results">Search Results</div>,
}));

jest.mock("lucide-react", () => ({
  Filter: () => <div data-testid="filter-icon" />,
  X: () => <div data-testid="x-icon" />,
  Search: () => <div data-testid="search-icon" />,
  HelpCircle: () => <div data-testid="help-icon" />,
  Save: () => <div data-testid="save-icon" />,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import SearchPage from "@/app/(dashboard)/search/page";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Search Page - Feed state preservation on back navigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(storage).forEach(k => delete storage[k]);
    currentSearchParams = new URLSearchParams("");
  });

  it("encodes search query and filters in URL params on initial load", () => {
    currentSearchParams = new URLSearchParams("q=hello&sort=oldest&minReactions=5");
    render(<SearchPage />);

    const searchInput = screen.getByRole("combobox", { name: /search confessions/i });
    expect(searchInput).toHaveValue("hello");
    expect(screen.getByText("Oldest")).toBeInTheDocument();
    expect(screen.getByText("Min 5 reactions")).toBeInTheDocument();
  });

  it("updates URL when search query is submitted", async () => {
    currentSearchParams = new URLSearchParams("");
    render(<SearchPage />);

    const user = userEvent.setup();
    const searchInput = screen.getByRole("combobox", { name: /search confessions/i });

    await act(async () => {
      await user.type(searchInput, "new query{enter}");
    });

    expect(mockPush).toHaveBeenCalledWith("/search?q=new+query", { scroll: false });
  });

  it("updates URL when filters are cleared", async () => {
    currentSearchParams = new URLSearchParams("q=hello&sort=oldest&minReactions=10");
    render(<SearchPage />);

    const user = userEvent.setup();
    const clearAllBtn = screen.getByRole("button", { name: /clear all/i });

    await act(async () => {
      await user.click(clearAllBtn);
    });

    expect(mockPush).toHaveBeenCalledWith("/search", { scroll: false });
  });

  it("updates URL when a single filter is removed", async () => {
    currentSearchParams = new URLSearchParams("q=hello&sort=oldest&minReactions=10");
    render(<SearchPage />);

    const user = userEvent.setup();
    // Find the remove button for the sort filter (Oldest chip)
    const removeSortBtn = screen.getByRole("button", { name: /remove oldest filter/i });

    await act(async () => {
      await user.click(removeSortBtn);
    });

    // Should push URL without sort but with q and minReactions
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("q=hello"),
      { scroll: false }
    );
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("minReactions=10"),
      { scroll: false }
    );
  });
});
