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
  public data: ApiErrorType;

  constructor(
    public status: number,
    data: unknown
  ) {
    const normalized = normalizeErrorData(data);
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
type TokenGetter = () => Promise<string | null>;

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

function normalizeErrorData(data: unknown): ApiErrorType {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { error: "An error occurred" };
  }
  const value = data as Record<string, unknown>;
  return {
    ...value,
    error: typeof value.error === "string" ? value.error : undefined,
    errors: Array.isArray(value.errors) ? value.errors.filter((error): error is string => typeof error === "string") : undefined,
  };
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? Object.assign(new Error("Request cancelled"), { name: "AbortError" });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortReason(signal);
}

// Also bounds operations (such as token lookup) that cannot consume a signal.
function abortable<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortReason(signal));
      return;
    }
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(abortReason(signal));
    };
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve().then(operation).then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      }
    );
  });
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(abortReason(signal!));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

// =============================================================================
// ApiClient
// =============================================================================

export class ApiClient {
  private tokenGetter: TokenGetter | null = null;
  private workspaceId: number | null = null;
  private baseUrl: string;
  private debug: boolean;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.debug = config.debug ?? false;
  }

  setTokenGetter(getter: TokenGetter) {
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
    options: RequestOptions = {},
    formData?: FormData,
    readResponse?: (response: Response) => Promise<T>
  ): Promise<T> {
    const {
      timeout = DEFAULT_TIMEOUT_MS,
      retries = method === "GET" ? MAX_RETRIES : 0,
      signal: externalSignal,
      keepalive = false,
    } = options;

    if (!Number.isInteger(retries) || retries < 0) {
      throw new RangeError("retries must be a non-negative integer");
    }
    if (!Number.isFinite(timeout) || timeout <= 0) {
      throw new RangeError("timeout must be a positive finite number");
    }
    throwIfAborted(externalSignal);

    const body = formData ?? (options.body !== undefined && method !== "GET" ? JSON.stringify(options.body) : undefined);
    // Capture the workspace before token lookup yields; retries retain this scope.
    const workspaceId = this.workspaceId;
    const tokenGetter = this.tokenGetter;
    let authHeaders: Promise<Record<string, string>> | undefined;

    const url = `${this.baseUrl}${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const cancel = () => controller.abort(externalSignal && abortReason(externalSignal));
      if (externalSignal?.aborted) cancel();
      else externalSignal?.addEventListener("abort", cancel, { once: true });
      let timedOut = false;
      const timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeout);

      try {
        return await abortable(async () => {
          throwIfAborted(controller.signal);
          const headers: Record<string, string> = {
            ...(formData ? {} : { "Content-Type": "application/json" }),
            Accept: "application/json",
            ...options.headers,
            ...await (authHeaders ??= this.authHeadersFor(workspaceId, tokenGetter)),
          };
          throwIfAborted(controller.signal);
          const startTime = Date.now();
          const response = await fetch(url, { method, headers, signal: controller.signal, keepalive, body });

          this.log("info", `${method} ${endpoint}`, {
            status: response.status,
            duration: Date.now() - startTime,
            attempt: attempt + 1,
          });

          if (!response.ok) {
            const errorData: unknown = await response.json().catch(() => undefined);
            throw new ApiError(response.status, errorData);
          }
          if (readResponse) return await readResponse(response);
          if (response.status === 204 || response.status === 205) return {} as T;
          return await response.json();
        }, controller.signal);
      } catch (err) {
        throwIfAborted(externalSignal);
        if (timedOut) {
          lastError = new ApiError(0, { error: `Request timeout after ${timeout}ms` });
        } else {
          if (err instanceof ApiError && err.status >= 400 && err.status < 500) throw err;
          if (err instanceof Error && err.name === "AbortError") throw err;
          lastError = err instanceof Error ? err : new Error(String(err));
        }

        this.log("warn", `${method} ${endpoint} failed`, {
          attempt: attempt + 1,
          error: lastError.message,
        });

      } finally {
        clearTimeout(timeoutId);
        externalSignal?.removeEventListener("abort", cancel);
      }

      if (attempt < retries) await sleep(RETRY_DELAY_MS * Math.pow(2, attempt), externalSignal);
    }

    this.log("error", `${method} ${endpoint} exhausted retries`, {
      error: lastError?.message,
    });
    throw lastError;
  }

  get<T>(endpoint: string, options?: Omit<RequestOptions, "body">): Promise<T> {
    return this.request<T>("GET", endpoint, options);
  }

  getBlob(endpoint: string, options?: Omit<RequestOptions, "body">): Promise<{ blob: Blob; headers: Headers }> {
    return this.request("GET", endpoint, options, undefined, async (response) => ({
      blob: await response.blob(),
      headers: response.headers,
    }));
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

  patchFormData<T>(endpoint: string, formData: FormData, options?: Omit<RequestOptions, "body">): Promise<T> {
    return this.request<T>("PATCH", endpoint, options, formData);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    return this.authHeadersFor(this.workspaceId, this.tokenGetter);
  }

  private async authHeadersFor(workspaceId: number | null, tokenGetter: TokenGetter | null): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    if (tokenGetter) {
      const token = await tokenGetter();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    if (workspaceId) {
      headers["X-Workspace-ID"] = String(workspaceId);
    }

    return headers;
  }
}
