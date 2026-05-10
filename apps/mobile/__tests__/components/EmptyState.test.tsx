import { render, screen, fireEvent } from "@testing-library/react-native";
import { EmptyState } from "@/components/EmptyState";

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeTruthy();
  });

  it("renders message when provided", () => {
    render(<EmptyState title="Empty" message="Add your first item" />);
    expect(screen.getByText("Add your first item")).toBeTruthy();
  });

  it("renders emoji when provided", () => {
    render(<EmptyState emoji="🎁" title="Empty" />);
    expect(screen.getByText("🎁")).toBeTruthy();
  });

  it("renders action button and fires onAction", () => {
    const onAction = jest.fn();
    render(<EmptyState title="Empty" actionLabel="Get started" onAction={onAction} />);
    fireEvent.press(screen.getByText("Get started"));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("does not render button when actionLabel missing", () => {
    render(<EmptyState title="Empty" onAction={() => {}} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
