import { createBootstrapService } from "@niftygifty/services";
import { apiClient } from "@/lib/api-client";

export const bootstrapService = createBootstrapService(apiClient);
