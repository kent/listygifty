import {
  buildCreateWishlistItemPayload,
  buildRepeatWishlistItemFormValues,
} from "@/lib/models";

describe("wishlist model helpers", () => {
  it("builds a trimmed create payload", () => {
    expect(
      buildCreateWishlistItemPayload({
        name: "  Sweater  ",
        description: "  Wool, medium  ",
        link: "  https://example.com/sweater  ",
        price: " 49.99 ",
      })
    ).toEqual({
      name: "Sweater",
      description: "Wool, medium",
      link: "https://example.com/sweater",
      price: 49.99,
    });
  });

  it("clears the form for repeat wishlist entry", () => {
    expect(buildRepeatWishlistItemFormValues()).toEqual({
      name: "",
      description: "",
      link: "",
      price: "",
    });
  });
});
