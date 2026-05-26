import { getHostnameFromUrl, getMerchantLabel, normalizeExternalUrl } from "@/lib/url";

describe("url helpers", () => {
  it("adds https to hostname-like URLs without a scheme", () => {
    expect(normalizeExternalUrl(" amazon.com/dp/example ")).toBe(
      "https://amazon.com/dp/example"
    );
  });

  it("preserves URLs that already have a scheme", () => {
    expect(normalizeExternalUrl("https://target.com/item")).toBe("https://target.com/item");
    expect(normalizeExternalUrl("mailto:gifts@example.com")).toBe("mailto:gifts@example.com");
  });

  it("returns blank for blank URLs", () => {
    expect(normalizeExternalUrl(" ")).toBe("");
    expect(normalizeExternalUrl(null)).toBe("");
  });

  it("extracts hostnames from normalized URLs", () => {
    expect(getHostnameFromUrl("www.etsy.com/listing/123")).toBe("etsy.com");
  });

  it("returns known merchant labels when possible", () => {
    expect(getMerchantLabel("amzn.to/example")).toBe("Amazon");
    expect(getMerchantLabel("https://www.bestbuy.com/site/example")).toBe("Best Buy");
  });

  it("falls back to the hostname for unknown merchants", () => {
    expect(getMerchantLabel("https://nintendo.com/store")).toBe("nintendo.com");
  });
});
