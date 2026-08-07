import type { ApiError as ApiErrorType } from "@niftygifty/types";

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

export interface ApiClientConfig {
  baseUrl: string;
  debug?: boolean;
}

// =============================================================================
// ApiError
// =============================================================================

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: ApiErrorType
  ) {
    super(data.error || data.errors?.join(", ") || "An error occurred");
    this.name = "ApiError";
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

  get isGiftLimitReached() {
    return this.status === 402 && (this.data as Record<string, unknown>).upgrade_required === true;
  }

  get isTimeout() {
    return this.status === 0 && this.message.includes("timeout");
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
  signal?: AbortSignal;
  keepalive?: boolean;
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
  private tokenGetter: (() => Promise<string | null>) | null = null;
  private workspaceId: number | null = null;
  private baseUrl: string;
  private debug: boolean;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl;
    this.debug = config.debug ?? false;
  }

  setTokenGetter(getter: () => Promise<string | null>) {
    this.tokenGetter = getter;
  }

  setWorkspaceId(workspaceId: number | null) {
    this.workspaceId = workspaceId;
  }

  getWorkspaceId(): number | null {
    return this.workspaceId;
  }

  private log(level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) {
    if (!this.debug && level !== "error") return;
    const timestamp = new Date().toISOString();
    const payload = { timestamp, level, message, ...meta };
    if (this.debug) {
      console[level](`[ApiClient] ${message}`, meta || "");
    } else if (level === "error") {
      console.error(JSON.stringify(payload));
    }
  }

  private async request<T>(
    method: HttpMethod,
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      timeout = DEFAULT_TIMEOUT_MS,
      retries = method === "GET" ? MAX_RETRIES : 0,
      signal: externalSignal,
      keepalive = false,
    } = options;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    };

    if (this.tokenGetter) {
      const token = await this.tokenGetter();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    if (this.workspaceId) {
      headers["X-Workspace-ID"] = String(this.workspaceId);
    }

    const url = `${this.baseUrl}${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Combine external signal with timeout
      let signal: AbortSignal;
      if (externalSignal && typeof AbortSignal.any === "function") {
        signal = AbortSignal.any([externalSignal, controller.signal]);
      } else {
        signal = externalSignal || controller.signal;
      }

      const config: RequestInit = {
        method,
        headers,
        signal,
        keepalive,
      };

      if (options.body && method !== "GET") {
        config.body = JSON.stringify(options.body);
      }

      try {
        const startTime = Date.now();
        const response = await fetch(url, config);
        const duration = Date.now() - startTime;

        clearTimeout(timeoutId);

        this.log("info", `${method} ${endpoint}`, {
          status: response.status,
          duration,
          attempt: attempt + 1,
        });

        if (!response.ok) {
          const errorData: ApiErrorType = await response.json().catch(() => ({
            error: "An error occurred",
          }));
          throw new ApiError(response.status, errorData);
        }

        if (response.status === 204) {
          return {} as T;
        }

        return response.json();
      } catch (err) {
        clearTimeout(timeoutId);

        if (err instanceof ApiError) {
          // Don't retry client errors (4xx) except specific cases
          if (err.status >= 400 && err.status < 500) {
            throw err;
          }
        }

        // Handle abort/timeout
        if (err instanceof Error && err.name === "AbortError") {
          lastError = new ApiError(0, { error: `Request timeout after ${timeout}ms` });
        } else {
          lastError = err instanceof Error ? err : new Error(String(err));
        }

        this.log("warn", `${method} ${endpoint} failed`, {
          attempt: attempt + 1,
          error: lastError.message,
        });

        // Retry with exponential backoff
        if (attempt < retries) {
          await sleep(RETRY_DELAY_MS * Math.pow(2, attempt));
        }
      }
    }

    this.log("error", `${method} ${endpoint} exhausted retries`, {
      error: lastError?.message,
    });
    throw lastError;
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

  async postFormData<T>(endpoint: string, formData: FormData): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (this.tokenGetter) {
      const token = await this.tokenGetter();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    if (this.workspaceId) {
      headers["X-Workspace-ID"] = String(this.workspaceId);
    }

    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    });

    this.log("info", `POST (FormData) ${endpoint}`, {
      status: response.status,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: "An error occurred",
      }));
      throw new ApiError(response.status, errorData);
    }

    return response.json();
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    if (this.tokenGetter) {
      const token = await this.tokenGetter();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    if (this.workspaceId) {
      headers["X-Workspace-ID"] = String(this.workspaceId);
    }

    return headers;
  }
}
