import type { ApiClient } from "@niftygifty/api-client";

export interface AccountService {
  /** Permanently delete the signed-in account and its sign-in. */
  delete(): Promise<void>;
}

export function createAccountService(client: ApiClient): AccountService {
  return {
    delete() {
      return client.delete("/profile?confirmation=DELETE");
    },
  };
}
