import * as queryString from "query-string";
import { spawnSync } from "node:child_process";

describe("navigation query decoding", () => {
  it("preserves deep-link destinations and Unicode names", () => {
    const params = { returnTo: "/join/exchange/abc", name: "Zoë & Bob" };
    expect(queryString.parse(queryString.stringify(params))).toEqual(params);
  });

  it("decodes spaces, repeated values, and malformed escapes without throwing", () => {
    expect(queryString.parse("name=Zo%C3%AB+Smith&tag=a&tag=b&bad=%ZZ"))
      .toEqual({ name: "Zoë Smith", tag: ["a", "b"], bad: "%ZZ" });
  });

  it("handles hostile malformed queries without blocking navigation", () => {
    // Run the CPU regression in a bounded process so a vulnerable decoder
    // cannot hang Jest itself. The first tests also exercise Metro/Babel imports.
    const result = spawnSync(process.execPath, ["-e", `
      const query = require(${JSON.stringify(require.resolve("query-string"))});
      const malformed = '%C0%AF'.repeat(64);
      const decoded = query.parse('value=' + malformed);
      if (decoded.value !== malformed) process.exit(1);
    `], { timeout: 3000, encoding: "utf8" });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
  });
});
