import { clearAccessToken, getAccessToken } from "../session";
import { ApiError, messageFromBody } from "./errors";

const DEFAULT_API_BASE_URL = "https://runescodex-api.onrender.com";
const REQUEST_TIMEOUT_MS = 20_000;

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

const environmentBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const baseUrl = normalizeBaseUrl(environmentBaseUrl || DEFAULT_API_BASE_URL);

export const apiConfiguration = {
  baseUrl,
  configured: baseUrl.length > 0,
  source: environmentBaseUrl ? "environment" : "default",
} as const;

type ApiRequestOptions = {
  method?: string;
  json?: unknown;
  token?: string | null;
  auth?: boolean;
  signal?: AbortSignal;
};

async function readResponseBody(response: Response) {
  if (response.status === 204) return null;

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  if (!apiConfiguration.configured) {
    throw new ApiError(
      "HTTP_ERROR",
      0,
      "VITE_API_BASE_URL não está configurada.",
      null,
    );
  }

  const headers = new Headers({ Accept: "application/json" });
  const token = options.token === undefined ? getAccessToken() : options.token || "";
  const shouldSendToken = options.auth !== false && Boolean(token);

  if (shouldSendToken) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let body: string | undefined;
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.json);
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  let response: Response;
  try {
    response = await fetch(`${apiConfiguration.baseUrl}${normalizedPath}`, {
      method: options.method || "GET",
      headers,
      body,
      credentials: "omit",
      signal: controller.signal,
    });
  } catch {
    throw new ApiError("NETWORK", 0, "NETWORK", null);
  } finally {
    window.clearTimeout(timeout);
  }

  const responseBody = await readResponseBody(response);

  if (!response.ok) {
    if (response.status === 401 && shouldSendToken) {
      clearAccessToken();
    }

    throw new ApiError(
      response.status === 401 ? "UNAUTHORIZED" : "HTTP_ERROR",
      response.status,
      messageFromBody(responseBody) || `Falha na API (${response.status}).`,
      responseBody,
    );
  }

  return responseBody as T;
}

export function withQuery(
  path: string,
  params: Record<string, string | number | undefined | null> = {},
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}
