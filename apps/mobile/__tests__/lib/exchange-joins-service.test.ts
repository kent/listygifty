import type { ApiClient } from "@niftygifty/api-client";
import { createExchangeJoinsService } from "@niftygifty/services";

describe("exchange joins service", () => {
  const get = jest.fn();
  const post = jest.fn();
  const service = createExchangeJoinsService({ get, post } as unknown as ApiClient);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("encodes the share token when loading the public preview", async () => {
    get.mockResolvedValue({ join_open: true });

    await service.getDetails("token / value");

    expect(get).toHaveBeenCalledWith("/exchange_join/token%20%2F%20value");
  });

  it("posts a trimmed optional name to the authenticated join endpoint", async () => {
    post.mockResolvedValue({ message: "joined" });

    await service.join("token / value", "  Marie Reviewer  ");

    expect(post).toHaveBeenCalledWith(
      "/exchange_join/token%20%2F%20value/join",
      { name: "Marie Reviewer" }
    );
  });

  it("omits a blank name", async () => {
    post.mockResolvedValue({ message: "joined" });

    await service.join("token", "   ");

    expect(post).toHaveBeenCalledWith("/exchange_join/token/join", {});
  });
});
