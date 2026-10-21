// Generated from packages/sdk-internal/src/http.ts by `bun run sync:sdk-internal`; edit that file instead.
/** Production. Development is https://dev-api.moreflow.io. */
export const DEFAULT_BASE_URL = 'https://api.moreflow.io';

export interface BaseUrlOptions {
  /**
   * The Moreflow API origin. Defaults to `https://api.moreflow.io`; pass `''`
   * to call your own origin behind a same-origin proxy.
   */
  baseUrl?: string | undefined;
}

/** The API origin without trailing slashes; an empty string keeps requests relative. */
export function resolveBaseUrl(options: BaseUrlOptions): string {
  return (options.baseUrl ?? DEFAULT_BASE_URL).trim().replace(/\/+$/u, '');
}

/** The caller's fetch, or the global one bound to `globalThis`; `undefined` when neither exists. */
export function resolveFetch(fetchImpl: typeof fetch | undefined): typeof fetch | undefined {
  if (fetchImpl) return fetchImpl;
  return typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined;
}

/** The parsed JSON body, the raw text when it is not JSON, or `undefined` when empty. */
export async function readResponseBody(response: Response): Promise<unknown> {
  // A clone leaves the body readable for callers that receive the response.
  const text = await response.clone().text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
