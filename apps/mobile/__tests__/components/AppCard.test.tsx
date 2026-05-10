import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { AppCard } from "@/components/AppCard";

describe("AppCard", () => {
  it("renders children", () => {
    render(
      <AppCard>
        <Text>Inside the card</Text>
      </AppCard>
    );
    expect(screen.getByText("Inside the card")).toBeTruthy();
  });

  it("renders with highlight variant without crashing", () => {
    const { toJSON } = render(
      <AppCard variant="highlight">
        <Text>Highlighted</Text>
      </AppCard>
    );
    expect(screen.getByText("Highlighted")).toBeTruthy();
    expect(toJSON()).toBeTruthy();
  });

  it("accepts custom style without crashing", () => {
    render(
      <AppCard style={{ marginTop: 20 }}>
        <Text>Styled</Text>
      </AppCard>
    );
    expect(screen.getByText("Styled")).toBeTruthy();
  });
});
