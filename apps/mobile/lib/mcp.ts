import { runtimeConfig } from "@/lib/runtime-config";

export function buildMcpServerUrl(apiUrl: string): string {
  return `${apiUrl.trim().replace(/\/+$/, "")}/mcp`;
}

export const MCP_SERVER_URL = buildMcpServerUrl(runtimeConfig.apiUrl);
