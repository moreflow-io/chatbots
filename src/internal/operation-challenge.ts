// Generated from packages/sdk-internal/src/operation-challenge.ts by `bun run sync:sdk-internal`; edit that file instead.
import { resolveChallengeBaseUrl, solveChallengeFrame } from './challenge-frame';
import { type BaseUrlOptions, readResponseBody, resolveBaseUrl } from './http';
import { isRecord } from './values';

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

const challengeCodes = new Set([
  'TURNSTILE_TOKEN_REQUIRED',
  'TURNSTILE_TOKEN_INVALID',
  'TURNSTILE_ACTION_MISMATCH',
  'TURNSTILE_HOSTNAME_NOT_ALLOWED'
]);
export function isOperationChallengeError(error: unknown): boolean {
  return isRecord(error) && typeof error.code === 'string' && challengeCodes.has(error.code);
}

type ChallengeConfig = { enabled: false } | { enabled: true; actions: Record<string, string> };
type Session = { required: boolean; config?: Promise<ChallengeConfig>; initialTail: Promise<void> };
// Shared across independently bundled SDKs loaded in the same page.
const sessionKey: unique symbol = Symbol.for('moreflow.operation-challenge.sessions');

/** No bootstrap until refusal. Share enforcement/config per API base for this page, never proof. */
export function createOperationChallengeSession(
  options: OperationChallengeOptions,
  dependencies: {
    fetchImpl: typeof fetch;
    aborted: (signal: AbortSignal) => Error;
    unavailable: () => Error;
  }
) {
  const baseUrl = resolveBaseUrl(options);
  let state: Session = { required: false, initialTail: Promise.resolve() };
  if (typeof window !== 'undefined') {
    const host = window as Window & { [sessionKey]?: Map<string, Session> };
    const sessions = host[sessionKey] ?? new Map<string, Session>();
    host[sessionKey] = sessions;
    const key = new URL(baseUrl || '/', window.location.href).href.replace(/\/+$/u, '');
    state = sessions.get(key) ?? state;
    sessions.set(key, state);
  }

  async function loadConfig(): Promise<ChallengeConfig> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await dependencies.fetchImpl(`${baseUrl}/v1/security/operation-challenge`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        headers: { accept: 'application/json' },
        signal: controller.signal
      });
      const body = await readResponseBody(response);
      if (response.ok && isRecord(body)) {
        if (body.enabled === false) return { enabled: false };
        if (
          body.enabled === true &&
          isRecord(body.actions) &&
          Object.values(body.actions).every(
            (action) => typeof action === 'string' && /^[a-zA-Z0-9_-]{1,32}$/u.test(action)
          )
        )
          return { enabled: true, actions: body.actions as Record<string, string> };
      }
      throw dependencies.unavailable();
    } catch {
      throw dependencies.unavailable();
    } finally {
      clearTimeout(timer);
    }
  }

  // Abort only this caller's wait, preserving the shared queue/bootstrap for other SDKs.
  function wait<T>(pending: Promise<T>, signal?: AbortSignal): Promise<T> {
    if (!signal) return pending;
    return new Promise((resolve, reject) => {
      const cleanup = () => signal.removeEventListener('abort', abort);
      const abort = () => {
        cleanup();
        reject(dependencies.aborted(signal));
      };
      signal.addEventListener('abort', abort, { once: true });
      pending.then(
        (value) => {
          cleanup();
          resolve(value);
        },
        (error: unknown) => {
          cleanup();
          reject(error);
        }
      );
      if (signal.aborted) abort();
    });
  }

  function waitForConfig(signal?: AbortSignal): Promise<ChallengeConfig> {
    state.config ??= loadConfig().catch((error: unknown) => {
      delete state.config;
      throw error;
    });
    return wait(state.config, signal);
  }

  async function getToken(operationId: string, signal?: AbortSignal): Promise<string | undefined> {
    if (signal?.aborted) throw dependencies.aborted(signal);
    if (!state.required) return undefined;
    const config = await waitForConfig(signal);
    if (signal?.aborted) throw dependencies.aborted(signal);
    if (!config.enabled) {
      state.required = false;
      delete state.config;
      return undefined;
    }
    if (!Object.hasOwn(config.actions, operationId)) return undefined;
    const action = config.actions[operationId]!;
    let token: string | undefined;
    if (options.getChallengeToken) {
      token = await options.getChallengeToken({ operationId, action, signal });
      if (signal?.aborted) throw dependencies.aborted(signal);
      if (!token?.trim()) throw dependencies.unavailable();
    } else {
      if (
        typeof window === 'undefined' ||
        typeof document === 'undefined' ||
        typeof document.createElement !== 'function'
      )
        throw dependencies.unavailable();
      token = await solveChallengeFrame(
        `${resolveChallengeBaseUrl(options)}/v1/security/operation-challenge/frame?operationId=${encodeURIComponent(operationId)}`,
        { title: options.challengeTitle, signal, ...dependencies }
      );
      // Only the authenticated frame protocol can report that enforcement was switched off.
      if (token === undefined) {
        state.required = false;
        delete state.config;
      }
    }
    if (signal?.aborted) throw dependencies.aborted(signal);
    return token;
  }

  async function attempt<T>(
    operationId: string,
    request: {
      signal?: AbortSignal | undefined;
      send: (token: string | undefined) => Promise<T>;
    }
  ): Promise<T> {
    for (let retry = 0; ; retry += 1) {
      const token = await getToken(operationId, request.signal);
      if (request.signal?.aborted) throw dependencies.aborted(request.signal);
      try {
        return await request.send(token);
      } catch (error) {
        if (isOperationChallengeError(error)) {
          state.required = true;
          if (retry === 0) continue;
        }
        throw error;
      }
    }
  }

  return {
    require() {
      state.required = true;
    },
    getToken,
    /** Serialize unknown-gate sends so concurrent SDKs incur at most one initial refusal. */
    async run<T>(
      operationId: string,
      request: {
        signal?: AbortSignal | undefined;
        send: (token: string | undefined) => Promise<T>;
      }
    ): Promise<T> {
      if (request.signal?.aborted) throw dependencies.aborted(request.signal);
      if (state.required) return attempt(operationId, request);
      const previous = state.initialTail;
      let release!: () => void;
      const turn = new Promise<void>((resolve) => {
        release = resolve;
      });
      state.initialTail = previous.then(() => turn);
      try {
        await wait(previous, request.signal);
        return await attempt(operationId, request);
      } finally {
        release();
      }
    }
  };
}
