import { fireEvent, render, screen } from "@testing-library/react-native";
import { DeleteAccountSheet } from "@/components/DeleteAccountSheet";

function renderSheet(overrides: Partial<Parameters<typeof DeleteAccountSheet>[0]> = {}) {
  const props = { visible: true, deleting: false, error: "", onClose: jest.fn(), onConfirm: jest.fn(), ...overrides };
  render(<DeleteAccountSheet {...props} />);
  return props;
}

describe("DeleteAccountSheet", () => {
  it("says what is deleted and that it cannot be undone", () => {
    renderSheet();

    expect(screen.getByRole("header", { name: "Delete Account" })).toBeTruthy();
    expect(screen.getByText(/can't be undone/)).toBeTruthy();
    expect(screen.getByText(/profile, email address, and sign-in/)).toBeTruthy();
    expect(screen.getByText(/wishlist share links/i)).toBeTruthy();
  });

  it("is honest about what other people are left with", () => {
    renderSheet();

    expect(screen.getByText(/Exchanges you organize are cancelled/)).toBeTruthy();
    expect(screen.getByText(/first name stays so the draw still works/)).toBeTruthy();
    expect(screen.getByText(/deleted for them too/)).toBeTruthy();
    expect(screen.getByText(/pass to another member/)).toBeTruthy();
  });

  it("hands the decision to the confirmation step", () => {
    const { onConfirm, onClose } = renderSheet();

    fireEvent.press(screen.getByRole("button", { name: "Delete Account" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("lets the person back out", () => {
    const { onClose, onConfirm } = renderSheet();

    fireEvent.press(screen.getByRole("button", { name: "Keep My Account" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("shows a failure as an alert", () => {
    renderSheet({ error: "We couldn't delete your account. Try again." });

    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't delete your account. Try again.");
  });

  it("locks both buttons while deleting", () => {
    const { onClose, onConfirm } = renderSheet({ deleting: true });

    fireEvent.press(screen.getByRole("button", { name: "Delete Account" }));
    fireEvent.press(screen.getByRole("button", { name: "Keep My Account" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("uses no em dashes in anything it shows", () => {
    renderSheet({ error: "We couldn't delete your account. Try again." });

    expect(JSON.stringify(screen.toJSON())).not.toMatch(/[–—]/);
  });
});
