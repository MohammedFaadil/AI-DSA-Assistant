'use client';

import type { ApiError, AuthResponse, ErrorCode } from '@repo/contracts';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * The access token lives in memory only — never localStorage, so an XSS payload
 * cannot read it. Durability comes from the httpOnly refresh cookie, which JS
 * cannot touch at all.
 */
let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
const tokenListeners = new Set<(token: string | null) => void>();

export function setAccessToken(token: string | null): void {
  accessToken = token;
  tokenListeners.forEach((listener) => listener(token));
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function onTokenChange(listener: (token: string | null) => void): () => void {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
}

export class ApiClientError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
    readonly details?: { path: string; message: string }[],
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }

  /** True for states the UI should render as "loading", not "failed". */
  get isWarming(): boolean {
    return this.code === 'AI_SERVICE_WARMING';
  }
}

async function refreshSession(): Promise<boolean> {
  // Collapse concurrent 401s into one refresh — otherwise five parallel
  // queries each rotate the token and four of them get revoked.
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${API_URL}/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        setAccessToken(null);
        return false;
      }
      const body = (await response.json()) as AuthResponse;
      setAccessToken(body.accessToken);
      return true;
    } catch {
      setAccessToken(null);
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Record<string, string | number | boolean | string[] | undefined>;
  skipAuthRetry?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, query, skipAuthRetry, headers, ...rest } = options;

  const url = new URL(`${API_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === '') continue;
      if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, v));
      else url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    ...rest,
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 401 && !skipAuthRetry) {
    const refreshed = await refreshSession();
    if (refreshed) return apiFetch<T>(path, { ...options, skipAuthRetry: true });
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const error = (payload as ApiError | null)?.error;
    throw new ApiClientError(
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? 'Something went wrong.',
      response.status,
      error?.details,
      error?.retryAfter,
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};

export { refreshSession, API_URL };
