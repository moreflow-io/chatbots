import { abortedError, MoreflowChatbotError } from './errors';
import { resolveBaseUrl } from './internal/http';
import { resolveChallengeBaseUrl, solveChallengeFrame } from './internal/challenge-frame';

export type ChatbotChallengeTokenProvider = (input: {
  chatbotId: string;
  action: 'chatbot_message';
  signal?: AbortSignal | undefined;
}) => Promise<string | undefined>;

const challengeCodes = new Set([
  'TURNSTILE_TOKEN_REQUIRED',
  'TURNSTILE_TOKEN_INVALID',
  'TURNSTILE_ACTION_MISMATCH',
  'TURNSTILE_HOSTNAME_NOT_ALLOWED'
]);
export function isChatbotChallengeError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && challengeCodes.has(String(error.code));
}

/** A new iframe per attempt means tokens are never cached, shared, or reused. */
export function createChatbotChallengeTokenProvider(
  options: { baseUrl?: string | undefined; title?: string | undefined } = {}
): ChatbotChallengeTokenProvider {
  return ({ chatbotId, signal }) => {
    const baseUrl = resolveBaseUrl(options);
    const path = `${baseUrl}/v1/chatbots/${encodeURIComponent(chatbotId)}?challenge=1`;
    return solveChallengeFrame(path, {
      title: options.title,
      signal,
      aborted: abortedError,
      unavailable: () =>
        new MoreflowChatbotError({
          code: 'TURNSTILE_VERIFICATION_UNAVAILABLE',
          message: 'Bot verification is temporarily unavailable.',
          retryable: true
        })
    });
  };
}

type ChatbotChallengeOptions = {
  baseUrl?: string | undefined;
  challengeTitle?: string | undefined;
  challengeBaseUrl?: string | undefined;
  getChallengeToken?: ChatbotChallengeTokenProvider | undefined;
};

const browserChallengeRequirements = new WeakMap<Window, Set<string>>();

/** Remember enforcement for this page, never the single-use tokens themselves. */
export function createChatbotChallengeSession(options: ChatbotChallengeOptions = {}) {
  let required = new Set<string>();
  if (typeof window !== 'undefined') {
    required = browserChallengeRequirements.get(window) ?? required;
    browserChallengeRequirements.set(window, required);
  }
  const key = (chatbotId: string) => `${resolveBaseUrl(options)}:${chatbotId}`;
  return {
    isRequired: (chatbotId: string) => required.has(key(chatbotId)),
    require: (chatbotId: string) => {
      required.add(key(chatbotId));
    },
    getToken: async (chatbotId: string, signal?: AbortSignal) => {
      const token = await freshChatbotChallengeToken(options, chatbotId, signal);
      if (!token) required.delete(key(chatbotId));
      return token;
    }
  };
}

export function freshChatbotChallengeToken(
  options: ChatbotChallengeOptions,
  chatbotId: string,
  signal?: AbortSignal
): Promise<string | undefined> {
  const challengeBaseUrl = resolveChallengeBaseUrl(options);
  return (
    options.getChallengeToken ??
    createChatbotChallengeTokenProvider({
      baseUrl: challengeBaseUrl,
      title: options.challengeTitle
    })
  )({ chatbotId, action: 'chatbot_message', signal });
}
