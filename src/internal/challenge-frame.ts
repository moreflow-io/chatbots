// Generated from packages/sdk-internal/src/challenge-frame.ts by `bun run sync:sdk-internal`; edit that file instead.
import { DEFAULT_BASE_URL } from './http';
import { createRandomId } from './values';

/** Proxies never implicitly move verification onto a customer hostname. */
export function resolveChallengeBaseUrl(options: {
  baseUrl?: string | undefined;
  challengeBaseUrl?: string | undefined;
}): string {
  if (options.challengeBaseUrl !== undefined) return options.challengeBaseUrl.replace(/\/+$/u, '');
  const api = new URL(options.baseUrl || DEFAULT_BASE_URL, DEFAULT_BASE_URL);
  return ['api.moreflow.io', 'dev-api.moreflow.io', 'localhost', '127.0.0.1', '[::1]'].includes(
    api.hostname
  )
    ? api.origin
    : DEFAULT_BASE_URL;
}

/** One ephemeral frame per solve; only its origin, window and nonce can return proof. */
export function solveChallengeFrame(
  frameUrl: string,
  options: {
    title?: string | undefined;
    signal?: AbortSignal | undefined;
    aborted: (signal: AbortSignal) => Error;
    unavailable: () => Error;
  }
): Promise<string | undefined> {
  const { signal } = options;
  if (signal?.aborted) return Promise.reject(options.aborted(signal));
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof document.createElement !== 'function'
  ) {
    return Promise.resolve(undefined);
  }
  const url = new URL(frameUrl, window.location.href);
  url.searchParams.set('parentOrigin', window.location.origin);
  const nonce = createRandomId();
  url.searchParams.set('requestId', nonce);
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.src = url.href;
    frame.title = options.title ?? 'Turnstile'; // i18n-ignore: product name; hosted clients pass a localized title.
    frame.setAttribute('aria-live', 'polite');
    // SDK-owned styles: the challenge floats above customer-page widgets and needs no host CSS.
    frame.style.cssText = [
      'position:fixed',
      'bottom:16px',
      'left:50%',
      'transform:translateX(-50%)',
      'width:min(320px,100vw)',
      'height:80px',
      'border:0',
      'z-index:2147483647',
      'pointer-events:none',
      'color-scheme:light dark'
    ].join(';');
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      window.removeEventListener('message', receive);
      frame.removeEventListener('error', fail);
      frame.remove();
    };
    const fail = () => {
      cleanup();
      reject(options.unavailable());
    };
    const abort = () => {
      cleanup();
      reject(options.aborted(signal!));
    };
    const receive = (event: MessageEvent) => {
      if (event.origin !== url.origin || event.source !== frame.contentWindow) return;
      const data: unknown = event.data;
      if (
        !data ||
        typeof data !== 'object' ||
        !('requestId' in data) ||
        data.requestId !== nonce ||
        !('type' in data)
      )
        return;
      if (data.type === 'moreflow.challenge.visible') {
        frame.style.pointerEvents = 'auto';
        frame.focus();
      }
      if (data.type === 'moreflow.challenge.disabled') {
        cleanup();
        resolve(undefined);
      }
      if (
        data.type === 'moreflow.challenge.token' &&
        'token' in data &&
        typeof data.token === 'string' &&
        data.token.trim()
      ) {
        cleanup();
        resolve(data.token);
      }
      if (data.type === 'moreflow.challenge.error') fail();
    };
    const timer = setTimeout(fail, 120_000);
    frame.addEventListener('error', fail, { once: true });
    window.addEventListener('message', receive);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    else document.body.appendChild(frame);
  });
}
