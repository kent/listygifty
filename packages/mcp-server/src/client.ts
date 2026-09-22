import type { ApiErrorData } from "./types.js";

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

// =============================================================================
// ApiError
// =============================================================================

export class ApiError extends Error {
  public data: ApiErrorData;

  constructor(public status: number, data: unknown) {
    const raw = data && typeof data === "object" ? data as Record<string, unknown> : {};
    const normalized = {
      ...raw,
      error: typeof raw.error === "string" ? raw.error : undefined,
      errors: Array.isArray(raw.errors) ? raw.errors.filter((value): value is string => typeof value === "string") : undefined,
    };
    super(normalized.error || normalized.errors?.join(", ") || "An error occurred");
    this.name = "ApiError";
    this.data = normalized;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isValidationError() {
    return this.status === 422;
  }
}

// =============================================================================
// Types
// =============================================================================

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  responseType?: "json" | "text";
}

// =============================================================================
// Utilities
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// ApiClient
// =============================================================================

export class ApiClient {
  private apiKey: string;
  private workspaceId: number | null = null;
  private baseUrl: string;

  constructor(config: { baseUrl: string; apiKey: string }) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
  }

  setWorkspaceId(workspaceId: number | null) {
    this.workspaceId = workspaceId;
  }

  getWorkspaceId(): number | null {
    return this.workspaceId;
  }

  private async request<T>(
    method: HttpMethod,
    endpoint: string,
    options: RequestOptions = {},
    formData?: FormData
  ): Promise<T> {
    const {
      timeout = DEFAULT_TIMEOUT_MS,
      retries = method === "GET" ? MAX_RETRIES : 0,
      responseType = "json",
    } = options;
    if (!Number.isInteger(retries) || retries < 0) throw new RangeError("retries must be a non-negative integer");
    if (!Number.isFinite(timeout) || timeout <= 0) throw new RangeError("timeout must be a positive finite number");

    const headers: Record<string, string> = {
      ...(formData ? {} : { "Content-Type": "application/json" }),
      Accept: responseType === "text" ? "text/csv" : "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      ...options.headers,
    };
    if (this.workspaceId) headers["X-Workspace-ID"] = String(this.workspaceId);
    const url = `${this.baseUrl}${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new ApiError(0, { error: `Request timeout after ${timeout}ms` }));
          controller.abort();
        }, timeout);
      });

      try {
        return await Promise.race([
          deadline,
          (async () => {
            const config: RequestInit = { method, headers, signal: controller.signal };
            if (formData) config.body = formData;
            else if (options.body !== undefined && method !== "GET") config.body = JSON.stringify(options.body);

            const response = await fetch(url, config);
            if (!response.ok) {
              const data: unknown = await response.json().catch(() => ({ error: "An error occurred" }));
              throw new ApiError(response.status, data);
            }
            if (response.status === 204 || response.status === 205) return {} as T;
            // Keep parsing under the deadline; receiving headers is not completion.
            return await (responseType === "text" ? response.text() : response.json()) as T;
          })(),
        ]);
      } catch (error) {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) throw error;
        lastError = error instanceof Error ? error : new Error(String(error));
      } finally {
        clearTimeout(timeoutId);
      }
      if (attempt < retries) await sleep(RETRY_DELAY_MS * Math.pow(2, attempt));
    }
    throw lastError;
  }

  getText(endpoint: string, options?: Omit<RequestOptions, "body" | "responseType">): Promise<string> {
    return this.request<string>("GET", endpoint, { ...options, responseType: "text" });
  }

  get<T>(endpoint: string, options?: Omit<RequestOptions, "body">): Promise<T> {
    return this.request<T>("GET", endpoint, options);
  }

  post<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, "body">): Promise<T> {
    return this.request<T>("POST", endpoint, { ...options, body });
  }

  put<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, "body">): Promise<T> {
    return this.request<T>("PUT", endpoint, { ...options, body });
  }

  patch<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, "body">): Promise<T> {
    return this.request<T>("PATCH", endpoint, { ...options, body });
  }

  delete<T = void>(endpoint: string, options?: Omit<RequestOptions, "body">): Promise<T> {
    return this.request<T>("DELETE", endpoint, options);
  }

  postFormData<T>(endpoint: string, formData: FormData, options?: Omit<RequestOptions, "body">): Promise<T> {
    return this.request<T>("POST", endpoint, options, formData);
  }

}

// =============================================================================
// Client Factory
// =============================================================================

export interface NiftyGiftyClientConfig {
  apiUrl: string;
  apiKey: string;
}

export function createClient(config: NiftyGiftyClientConfig): ApiClient {
  return new ApiClient({ baseUrl: config.apiUrl, apiKey: config.apiKey });
}
