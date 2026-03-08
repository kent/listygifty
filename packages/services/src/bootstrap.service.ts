import type { ApiClient } from "@niftygifty/api-client";
import type { AppBootstrapResponse } from "@niftygifty/types";

export interface BootstrapService {
  get(workspaceId?: number | null): Promise<AppBootstrapResponse>;
}

export function createBootstrapService(client: ApiClient): BootstrapService {
  return {
    get(workspaceId) {
      const query = workspaceId != null ? `?workspace_id=${workspaceId}` : "";
      return client.get<AppBootstrapResponse>(`/bootstrap${query}`);
    },
  };
}
