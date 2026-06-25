import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchPage from "@/app/(dashboard)/search/page";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSearchParamsValue = "q=test&sort=oldest&minReactions=5";
let currentSearchParams = new URLSearchParams(mockSearchParamsValue);
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
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
// Tests
// ---------------------------------------------------------------------------

describe("Search Page - Feed State Preservation (#1227)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentSearchParams = new URLSearchParams("");
    // Clear sessionStorage
    sessionStorage.clear();
  });

  it("hydrates search state from URL on initial load", () => {
    currentSearchParams = new URLSearchParams("q=hello&sort=oldest&minReactions=10");
    render(<SearchPage />);

    const searchInput = screen.getByRole("combobox", { name: /search confessions/i });
    expect(searchInput).toHaveValue("hello");

    expect(screen.getByText("Oldest")).toBeInTheDocument();
    expect(screen.getByText("Min 10 reactions")).toBeInTheDocument();
  });

  it("updates URL using router.push when removing a filter", async () => {
    currentSearchParams = new URLSearchParams("q=hello&sort=oldest&minReactions=10");
    render(<SearchPage />);

    const user = userEvent.setup();
    const clearAllBtn = screen.getByRole("button", { name: /clear all/i });

    await act(async () => {
      await user.click(clearAllBtn);
    });

    expect(mockPush).toHaveBeenCalledWith("/search", { scroll: false });
  });

  it("updates URL using router.push when submitting search query", async () => {
    currentSearchParams = new URLSearchParams("");
    render(<SearchPage />);

    const user = userEvent.setup();
    const searchInput = screen.getByRole("combobox", { name: /search confessions/i });

    await act(async () => {
      await user.type(searchInput, "new query{enter}");
    });

    expect(mockPush).toHaveBeenCalledWith("/search?q=new+query", { scroll: false });
  });

  it("preserves search state in URL params for back navigation", async () => {
    currentSearchParams = new URLSearchParams("q=crypto&sort=reactions&gender=male");
    render(<SearchPage />);

    const user = userEvent.setup();
    const searchInput = screen.getByRole("combobox", { name: /search confessions/i });

    // Modify the search
    await act(async () => {
      await user.clear(searchInput);
      await user.type(searchInput, "stellar{enter}");
    });

    // URL should be updated with new query
    const lastCall = mockPush.mock.calls[mockPush.mock.calls.length - 1];
    expect(lastCall[0]).toContain("q=stellar");
  });

  it("saves scroll position to sessionStorage on scroll", async () => {
    currentSearchParams = new URLSearchParams("q=test");
    render(<SearchPage />);

    // Simulate scrolling
    act(() => {
      window.scrollTo(0, 500);
      window.dispatchEvent(new Event("scroll"));
    });

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 600));

    const stored = sessionStorage.getItem("xconfess:search-scroll");
    expect(stored).toBeTruthy();

    const position = JSON.parse(stored!);
    expect(position.y).toBe(500);
  });

  it("clears scroll position when clearing all filters", async () => {
    currentSearchParams = new URLSearchParams("q=test&sort=oldest");
    render(<SearchPage />);

    // Save a scroll position
    sessionStorage.setItem(
      "xconfess:search-scroll",
      JSON.stringify({ x: 0, y: 300, timestamp: Date.now() })
    );

    const user = userEvent.setup();
    const clearAllBtn = screen.getByRole("button", { name: /clear all/i });

    await act(async () => {
      await user.click(clearAllBtn);
    });

    // Scroll position should be cleared
    expect(sessionStorage.getItem("xconfess:search-scroll")).toBeNull();
  });
});
