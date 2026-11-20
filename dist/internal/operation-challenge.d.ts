import { type BaseUrlOptions } from './http';
export type OperationChallengeTokenProvider = (input: {
    /** Any canonical registry key, including route-policy keys. */
    operationId: string;
    /** Resolved from the server registry, never a caller-maintained action list. */
    action: string;
    signal?: AbortSignal | undefined;
}) => Promise<string | undefined>;
export interface OperationChallengeOptions extends BaseUrlOptions {
    challengeBaseUrl?: string | undefined;
    challengeTitle?: string | undefined;
    getChallengeToken?: OperationChallengeTokenProvider | undefined;
}
export declare function isOperationChallengeError(error: unknown): boolean;
/** No bootstrap until refusal. Share enforcement/config per API base for this page, never proof. */
export declare function createOperationChallengeSession(options: OperationChallengeOptions, dependencies: {
    fetchImpl: typeof fetch;
    aborted: (signal: AbortSignal) => Error;
    unavailable: () => Error;
}): {
    require(): void;
    getToken: (operationId: string, signal?: AbortSignal) => Promise<string | undefined>;
    /** Serialize unknown-gate sends so concurrent SDKs incur at most one initial refusal. */
    run<T>(operationId: string, request: {
        signal?: AbortSignal | undefined;
        send: (token: string | undefined) => Promise<T>;
    }): Promise<T>;
};
