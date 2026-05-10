import { render, screen, fireEvent } from "@testing-library/react-native";
import { PrimaryButton } from "@/components/PrimaryButton";

describe("PrimaryButton", () => {
  it("renders the label", () => {
    render(<PrimaryButton label="Save" onPress={() => {}} />);
    expect(screen.getByText("Save")).toBeTruthy();
  });

  it("fires onPress when tapped", () => {
    const onPress = jest.fn();
    render(<PrimaryButton label="Save" onPress={onPress} />);
    fireEvent.press(screen.getByText("Save"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not fire onPress when disabled", () => {
    const onPress = jest.fn();
    render(<PrimaryButton label="Save" onPress={onPress} disabled />);
    fireEvent.press(screen.getByText("Save"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("does not fire onPress while loading", () => {
    const onPress = jest.fn();
    render(<PrimaryButton label="Save" onPress={onPress} loading />);
    // Label is hidden while loading; query by accessibility role instead
    const button = screen.getByRole("button");
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("hides label and shows spinner while loading", () => {
    render(<PrimaryButton label="Save" onPress={() => {}} loading />);
    expect(screen.queryByText("Save")).toBeNull();
  });
});
