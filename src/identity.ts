import { createMemoryStorage, guardStorage, type StorageLike } from '@moreflow/tracking';

import { MoreflowChatbotError } from './errors';
import { validationErrorInit } from './internal/errors';
import { createRandomId, stringValue } from './internal/values';

/** Visitor ids persist in localStorage; blocked storage falls back to memory for the session. */
function visitorStorage(storage: StorageLike | undefined): StorageLike {
  if (storage) return guardStorage(storage);
  try {
    if (globalThis.localStorage) return guardStorage(globalThis.localStorage);
  } catch {
    // Browser storage can be blocked in private or embedded contexts.
  }
  return createMemoryStorage();
}

/**
 * Generates the visitor ids used by the public chatbot SDK. Browsers with
 * `crypto.randomUUID` get a UUID; older or restricted contexts retain the
 * SDK's non-cryptographic fallback rather than failing chat initialization.
 */
export function createChatbotRandomId(): string {
  return createRandomId();
}

export function chatbotVisitorStorageKey(chatbotId: string): string {
  return `moreflow_chat_visitor_${chatbotId}`;
}

export function chatbotThreadStorageKey(chatbotId: string, visitorId: string): string {
  return `moreflow_chat_thread_${chatbotId}_${visitorId}`;
}

export interface ChatbotIdentity {
  readonly chatbotId: string;
  /** A stored visitor id, or a new one that stays in memory until `persistVisitor()`. */
  readonly visitorId: string;
  /** Stores the visitor id; the client calls it when the visitor sends a first message. */
  persistVisitor(): void;
  /** Removes the stored visitor and thread ids and starts a new, unstored visitor. */
  forgetVisitor(): void;
  getThreadId(): string | null;
  setThreadId(threadId: string | null | undefined): void;
  clearThread(): void;
}

/**
 * Reads a returning visitor's id but writes nothing to storage until
 * `persistVisitor()`, so merely loading a page with the chatbot stores nothing.
 */
export function createChatbotIdentity(options: {
  chatbotId: string;
  storage?: StorageLike | undefined;
  randomId?: (() => string) | undefined;
}): ChatbotIdentity {
  const chatbotId = options.chatbotId.trim();
  if (!chatbotId) {
    throw new MoreflowChatbotError(validationErrorInit('chatbotId', 'chatbotId is required.'));
  }

  const storage = visitorStorage(options.storage);
  const randomId = options.randomId ?? createChatbotRandomId;
  const visitorKey = chatbotVisitorStorageKey(chatbotId);
  const storedVisitorId = stringValue(storage.getItem(visitorKey));
  let visitorId = storedVisitorId ?? randomId();
  let persisted = storedVisitorId !== undefined;
  const threadKey = () => chatbotThreadStorageKey(chatbotId, visitorId);

  return {
    chatbotId,
    get visitorId() {
      return visitorId;
    },
    persistVisitor() {
      if (persisted) return;
      storage.setItem(visitorKey, visitorId);
      persisted = true;
    },
    forgetVisitor() {
      storage.removeItem(threadKey());
      storage.removeItem(visitorKey);
      visitorId = randomId();
      persisted = false;
    },
    getThreadId() {
      return stringValue(storage.getItem(threadKey())) ?? null;
    },
    setThreadId(threadId) {
      const nextThreadId = stringValue(threadId);
      if (nextThreadId) {
        storage.setItem(threadKey(), nextThreadId);
        return;
      }
      storage.removeItem(threadKey());
    },
    clearThread() {
      storage.removeItem(threadKey());
    }
  };
}
