import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import type { Holiday, Person } from "@niftygifty/types";
import DashboardPage from "./page";
import { captureWebEvent } from "@/lib/analytics";

const mocks = vi.hoisted(() => ({
  workspace: { current: null as unknown, bootstrap: null as unknown },
  push: vi.fn(),
  createHoliday: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
// jsdom can't navigate, so stop a clicked link before it tries.
vi.mock("next/link", () => ({
  default: ({ onClick, ...props }: React.ComponentProps<"a">) => (
    <a {...props} onClick={(event) => { event.preventDefault(); onClick?.(event); }} />
  ),
}));
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ user: null, isAuthenticated: true, isLoading: false, signOut: vi.fn() }),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    bootstrapData: mocks.workspace.bootstrap,
    currentWorkspace: mocks.workspace.current,
    refreshWorkspaces: vi.fn(),
  }),
}));
vi.mock("@/services", () => ({
  holidaysService: { create: mocks.createHoliday },
  peopleService: { create: vi.fn() },
  AUTH_ROUTES: { signIn: "/login" },
}));
vi.mock("@/components/layout", () => ({ AppHeader: () => null }));
vi.mock("@/components/gift-todo-list", () => ({ GiftTodoList: () => null }));
vi.mock("@/lib/analytics", () => ({ captureWebEvent: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const holiday = { id: 3, name: "Christmas", date: null, completed: false, archived: false, collaborator_count: 1 } as unknown as Holiday;
const people = [{ id: 1, name: "Alex" }, { id: 2, name: "Sam" }, { id: 3, name: "Jo" }] as Person[];

function bootstrap(overrides: Record<string, unknown> = {}) {
  return { holiday_templates: [], holidays: [], people: [], gift_exchanges: [], gift_total: 0, ...overrides };
}

const checklist = () => screen.getByRole("heading", { name: "Get started" }).closest('[data-slot="card"]') as HTMLElement;

beforeEach(() => {
  mocks.workspace.current = { id: 1, workspace_type: "household" };
  mocks.workspace.bootstrap = bootstrap();
});

describe("dashboard checklist copy", () => {
  it("speaks to customers, not in growth jargon", () => {
    render(<DashboardPage />);
    expect(screen.getByRole("heading", { name: "Get started" })).toBeTruthy();
    expect(screen.queryByText("Activation")).toBeNull();
    expect(screen.getByText("Your first goal: one list, three people and five gifts.")).toBeTruthy();
  });

  it("labels each step as an action", () => {
    render(<DashboardPage />);
    for (const label of ["Create a gift list", "Add people", "Capture gifts", "Share a list or start an exchange"]) {
      expect(within(checklist()).getByRole("link", { name: new RegExp(`^${label}`) })).toBeTruthy();
    }
  });

  it("names the action as the next step", () => {
    render(<DashboardPage />);
    const next = within(checklist()).getByRole("link", { name: "Next: create a gift list" });
    expect(next.getAttribute("href")).toBe("/holidays");
    expect(within(checklist()).queryByText(/Continue setup/)).toBeNull();
  });

  it("moves to the next action as steps complete", () => {
    mocks.workspace.bootstrap = bootstrap({ holidays: [holiday] });
    render(<DashboardPage />);
    expect(within(checklist()).getByRole("link", { name: "Next: add people" }).getAttribute("href")).toBe("/people");
  });

  it("keeps going through the last steps", () => {
    mocks.workspace.bootstrap = bootstrap({ holidays: [holiday], people, gift_total: 5 });
    render(<DashboardPage />);
    expect(within(checklist()).getByRole("link", { name: "Next: share a list or start an exchange" })).toBeTruthy();
  });

  it("hides the next step once everything is done", () => {
    mocks.workspace.bootstrap = bootstrap({ holidays: [holiday], people, gift_total: 5, gift_exchanges: [{ id: 1 }] });
    render(<DashboardPage />);
    expect(within(checklist()).queryByRole("link", { name: /^Next:/ })).toBeNull();
    expect(within(checklist()).getByText("4/4")).toBeTruthy();
  });

  it("keeps the counts", () => {
    mocks.workspace.bootstrap = bootstrap({ holidays: [holiday], people: people.slice(0, 2), gift_total: 2 });
    render(<DashboardPage />);
    expect(within(checklist()).getByText("1/4")).toBeTruthy();
    expect(within(checklist()).getByText("2/3")).toBeTruthy();
    expect(within(checklist()).getByText("2/5")).toBeTruthy();
  });

  it("keeps sending the original step names to analytics", () => {
    render(<DashboardPage />);
    fireEvent.click(within(checklist()).getByRole("link", { name: "Next: create a gift list" }));
    expect(captureWebEvent).toHaveBeenCalledWith("dashboard_activation_step_opened", expect.objectContaining({
      source: "continue_setup",
      step: "Gift list created",
    }));
    fireEvent.click(within(checklist()).getByRole("link", { name: /^Add people/ }));
    expect(captureWebEvent).toHaveBeenCalledWith("dashboard_activation_step_opened", expect.objectContaining({
      source: "checklist",
      step: "People added",
    }));
  });
});

describe("starting a gift list from the dashboard", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.createHoliday.mockReset();
    mocks.workspace.bootstrap = bootstrap({ holiday_templates: [{ id: 9, name: "Christmas", icon: null }] });
  });

  it("opens the new list and keeps the toast", async () => {
    mocks.createHoliday.mockResolvedValue({ ...holiday, id: 42 });
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole("button", { name: /Christmas/ }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/holidays/42"));
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/^Started planning Christmas \d{4}!$/));
  });

  it("dates the list on the holiday itself, not today", async () => {
    mocks.createHoliday.mockResolvedValue({ ...holiday, id: 42 });
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole("button", { name: /Christmas/ }));

    await waitFor(() => expect(mocks.createHoliday).toHaveBeenCalled());
    expect(mocks.createHoliday.mock.calls[0][0].date).toMatch(/^\d{4}-12-25$/);
  });

  it("stays on the dashboard when the list can't be created", async () => {
    mocks.createHoliday.mockRejectedValue(new Error("Nope"));
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole("button", { name: /Christmas/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to create gift list"));
    expect(mocks.push).not.toHaveBeenCalled();
  });
});

describe("dashboard add person form", () => {
  it("names the icon-only submit button", () => {
    render(<DashboardPage />);
    expect(screen.getByRole("button", { name: "Add person" }).getAttribute("type")).toBe("submit");
  });

  it("names the input with more than its placeholder", () => {
    render(<DashboardPage />);
    expect(screen.getByRole("textbox", { name: "Person's name" }).getAttribute("aria-label")).toBe("Person's name");
  });
});

describe("dashboard control names", () => {
  it("leaves no button or link without a name", () => {
    mocks.workspace.bootstrap = bootstrap({
      holidays: [holiday],
      people,
      holiday_templates: [{ id: 9, name: "Christmas", icon: null }],
    });
    render(<DashboardPage />);
    expect(screen.queryAllByRole("button", { name: "" })).toEqual([]);
    expect(screen.queryAllByRole("link", { name: "" })).toEqual([]);
  });
});

describe("dashboard checklist copy for a business workspace", () => {
  beforeEach(() => {
    mocks.workspace.current = { id: 1, workspace_type: "business", business_initial_use_case: "holiday-box" };
  });

  it("uses the same heading and names the action as the next step", () => {
    render(<DashboardPage />);
    expect(screen.getByRole("heading", { name: "Get started" })).toBeTruthy();
    expect(screen.queryByText("Business Activation")).toBeNull();
    expect(within(checklist()).getByRole("link", { name: "Next: import recipients" })).toBeTruthy();
  });

  it.each([
    ["holiday-box", "Import recipients", "Recipients imported"],
    ["new-hire-kit", "Add new hires", "New hires added"],
    ["milestones", "Add employees", "Employees added"],
  ])("labels %s steps as actions and keeps its analytics names", (useCase, label, analyticsStep) => {
    mocks.workspace.current = { id: 1, workspace_type: "business", business_initial_use_case: useCase };
    render(<DashboardPage />);
    fireEvent.click(within(checklist()).getByRole("link", { name: new RegExp(`^${label}`) }));
    expect(captureWebEvent).toHaveBeenCalledWith("dashboard_activation_step_opened", expect.objectContaining({
      step: analyticsStep,
    }));
  });
});
