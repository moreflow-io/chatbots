/** Proxies never implicitly move verification onto a customer hostname. */
export declare function resolveChallengeBaseUrl(options: {
    baseUrl?: string | undefined;
    challengeBaseUrl?: string | undefined;
}): string;
/** One ephemeral frame per solve; only its origin, window and nonce can return proof. */
export declare function solveChallengeFrame(frameUrl: string, options: {
    title?: string | undefined;
    signal?: AbortSignal | undefined;
    aborted: (signal: AbortSignal) => Error;
    unavailable: () => Error;
}): Promise<string | undefined>;
