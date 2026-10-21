/** Production. Development is https://dev-api.moreflow.io. */
export declare const DEFAULT_BASE_URL = "https://api.moreflow.io";
export interface BaseUrlOptions {
    /**
     * The Moreflow API origin. Defaults to `https://api.moreflow.io`; pass `''`
     * to call your own origin behind a same-origin proxy.
     */
    baseUrl?: string | undefined;
}
/** The API origin without trailing slashes; an empty string keeps requests relative. */
export declare function resolveBaseUrl(options: BaseUrlOptions): string;
/** The caller's fetch, or the global one bound to `globalThis`; `undefined` when neither exists. */
export declare function resolveFetch(fetchImpl: typeof fetch | undefined): typeof fetch | undefined;
/** The parsed JSON body, the raw text when it is not JSON, or `undefined` when empty. */
export declare function readResponseBody(response: Response): Promise<unknown>;
