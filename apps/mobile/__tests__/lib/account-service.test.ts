import type { ApiClient } from "@niftygifty/api-client";
import { createAccountService } from "@niftygifty/services";

describe("account service", () => {
  it("sends the explicit confirmation the API requires", async () => {
    const del = jest.fn().mockResolvedValue({});
    const service = createAccountService({ delete: del } as unknown as ApiClient);

    await service.delete();

    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith("/profile?confirmation=DELETE");
  });
});
