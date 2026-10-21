import { type ChatbotLeadConsentRequest, chatbotLeadConsentFromError, normalizeChatbotLeadConsent } from './consent';
import { describeChatbotError } from './error-messages';
import { MoreflowChatbotError } from './errors';
import { createChatbotRandomId } from './identity';
import type { ChatbotClient } from './index';
import type { ChatbotMessage, ChatbotPublicConfig } from './public-types';
import { sessionConsent, sessionConsentAnswers } from './session-consent';
import { sendSessionMessage } from './session-send';
import type {
  ChatbotSession, ChatbotSessionMessage, ChatbotSessionOptions,
  ChatbotSessionSendOutcome, ChatbotSessionSnapshot
} from './session-types';

function historyMessages(items: readonly ChatbotMessage[]): ChatbotSessionMessage[] {
  return items.map((message) => ({
    ...message, pending: message.status === 'pending', failed: message.status === 'failed'
  }));
}

/** A headless chat store. Layout, composer text, focus and teaser timing belong to the client. */
export function createChatbotSession(client: ChatbotClient, options: ChatbotSessionOptions = {}): ChatbotSession {
  const listeners = new Set<() => void>();
  const controllers = new Set<AbortController>();
  let generation = 0;
  let initialized = false;
  let initialLoad: Promise<void> | undefined;
  let cursor: string | undefined;
  let forceConsent = false;
  const retries = new Map<string, Parameters<ChatbotClient['send']>[0]>();
  let snapshot: ChatbotSessionSnapshot = {
    status: 'loading', config: null, messages: [], error: null, hasMore: false, loadingMore: false,
    consent: sessionConsent([], {}, false, client.getThreadId() !== null)
  };
  function update(patch: Partial<ChatbotSessionSnapshot>): void {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  }
  function idleStatus(): 'consent' | 'ready' {
    return snapshot.consent.needed ? 'consent' : 'ready';
  }
  function welcome(config: ChatbotPublicConfig | null): ChatbotSessionMessage[] {
    return [{
      id: 'welcome', role: 'assistant', pending: false, failed: false,
      text: config?.settings.welcomeMessage?.trim() || (options.locale === 'en'
        ? 'Hello! How can I help you today?' : options.formality === 'informal'
          ? 'Hallo! Wie kann ich dir heute helfen?' : 'Hallo! Wie kann ich Ihnen heute helfen?')
    }];
  }
  function abort(): void {
    generation += 1;
    for (const controller of controllers) controller.abort();
    controllers.clear();
    initialLoad = undefined;
  }
  function consentChanged(consent: ChatbotSessionSnapshot['consent']): void {
    update({ consent, error: null, status: consent.needed ? 'consent' : 'ready' });
  }
  async function start(): Promise<void> {
    if (initialized) return;
    if (initialLoad) return initialLoad;
    const startedIn = generation;
    const controller = new AbortController();
    controllers.add(controller);
    update({ status: 'loading', error: null });
    initialLoad = (async () => {
      try {
        const config = await client.loadConfig({ signal: controller.signal });
        if (startedIn !== generation) return;
        const consent = sessionConsent(config.leadConsent, {}, false, client.getThreadId() !== null);
        update({ config, consent, messages: welcome(config) });
        const page = await client.listMessages({ limit: options.pageSize ?? 50 }, { signal: controller.signal });
        if (startedIn !== generation) return;
        cursor = page?.nextCursor;
        initialized = true;
        update({ messages: page?.items.length ? historyMessages(page.items) : welcome(config),
          hasMore: page?.hasMore ?? false, status: idleStatus() });
      } catch (error) {
        if (startedIn !== generation) return;
        update({ status: 'error', error: describeChatbotError(error, options) });
      } finally {
        controllers.delete(controller);
        if (startedIn === generation) initialLoad = undefined;
      }
    })();
    return initialLoad;
  }
  async function recoverConsent(error: MoreflowChatbotError, signal: AbortSignal): Promise<void> {
    const updates = chatbotLeadConsentFromError(error);
    let requests: readonly ChatbotLeadConsentRequest[] = snapshot.consent.requests;
    // Reload removes purposes the account no longer requests and refreshes every wording version.
    try {
      const config = await client.loadConfig({ signal });
      if (signal.aborted) return;
      requests = config.leadConsent;
      update({ config });
    } catch {
      // The error's current wording is still usable while a config refresh is unavailable.
    }
    if (signal.aborted) return;
    // Error details are authoritative even if a config cache still serves old wording.
    requests = [
      ...requests.map((request) => updates.find((entry) => entry.purpose === request.purpose) ?? request),
      ...updates.filter((entry) => !requests.some((request) => request.purpose === entry.purpose))
    ];
    if (error.code === 'CHATBOT_CONSENT_NOT_REQUESTED' && Array.isArray(error.details.requested)) {
      requests = normalizeChatbotLeadConsent(error.details.requested);
    }
    forceConsent = true;
    update({
      config: snapshot.config ? { ...snapshot.config, leadConsent: [...requests] } : null,
      consent: sessionConsent(requests, {}, false, false)
    });
  }
  async function sendInput(input: Parameters<ChatbotClient['send']>[0]): Promise<ChatbotSessionSendOutcome> {
    const text = input.message.trim();
    if (!text || snapshot.status === 'loading' || snapshot.status === 'sending' || !snapshot.config) return { status: 'ignored' };
    if (snapshot.consent.needed) return { status: 'consent_required', restoreText: text };
    const id = input.clientMessageId ?? createChatbotRandomId();
    const replyId = `reply-${id}`;
    const startedIn = generation;
    const controller = new AbortController();
    controllers.add(controller);
    const consent = !client.getThreadId() || forceConsent ? sessionConsentAnswers(snapshot.consent) : undefined;
    const request = { ...input, message: text, clientMessageId: id, ...(consent ? { consent } : {}) };
    retries.set(id, request);
    const withoutAttempt = snapshot.messages.filter((message) => message.id !== id && message.id !== replyId);
    update({ status: 'sending', error: null, messages: [...withoutAttempt,
      { id, clientMessageId: id, role: 'visitor', text, pending: true, failed: false },
      { id: replyId, role: 'assistant', text: '', pending: true, failed: false }
    ] });
    try {
      const result = await sendSessionMessage(client, request, { signal: controller.signal }, (delta) => {
        if (startedIn !== generation) return;
        update({ messages: snapshot.messages.map((message) => message.id === replyId
          ? { ...message, text: message.text + delta } : message) });
      });
      if (startedIn !== generation) return { status: 'aborted' };
      forceConsent = false;
      retries.delete(id);
      update({ status: 'ready', consent: sessionConsent(snapshot.consent.requests, snapshot.consent.decisions, true, true),
        messages: snapshot.messages.map((message) => message.id === id
          ? { ...message, pending: false, status: 'sent' }
          : message.id === replyId ? {
            ...message, id: result.assistantMessageId ?? replyId, text: result.response ?? message.text,
            pending: false, status: 'sent'
          } : message) });
      return { status: 'sent', result };
    } catch (error) {
      if (startedIn !== generation || controller.signal.aborted) return { status: 'aborted' };
      if (error instanceof MoreflowChatbotError && error.code.startsWith('CHATBOT_CONSENT_')) {
        await recoverConsent(error, controller.signal);
        if (startedIn !== generation) return { status: 'aborted' };
        retries.delete(id);
        update({ status: idleStatus(), error: describeChatbotError(error, options),
          messages: snapshot.messages.filter((message) => message.id !== id && message.id !== replyId) });
        return { status: 'consent_required', restoreText: text };
      }
      const described = describeChatbotError(error, options);
      update({ status: 'error', error: described, messages: snapshot.messages.filter((message) => message.id !== replyId)
        .map((message) => message.id === id ? { ...message, pending: false, failed: true, status: 'failed' } : message) });
      return { status: 'error', error: described };
    } finally {
      controllers.delete(controller);
    }
  }
  const session: ChatbotSession = {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    get ready() { return initialLoad ?? Promise.resolve(); },
    start,
    send: (text) => sendInput({ message: text }),
    retry(messageId) {
      const input = retries.get(messageId);
      return input ? sendInput(input) : Promise.resolve({ status: 'ignored' });
    },
    reset() {
      abort();
      client.reset();
      retries.clear();
      cursor = undefined;
      forceConsent = false;
      const consent = sessionConsent(snapshot.config?.leadConsent ?? [], {}, false, false);
      update({ messages: welcome(snapshot.config), consent, error: null, hasMore: false, loadingMore: false,
        status: snapshot.config ? (consent.needed ? 'consent' : 'ready') : 'loading' });
      if (snapshot.config) initialized = true;
      else void start();
    },
    async loadMore() {
      if (!snapshot.hasMore || snapshot.loadingMore || !cursor || snapshot.status === 'loading') return;
      const startedIn = generation;
      const controller = new AbortController();
      controllers.add(controller);
      update({ loadingMore: true });
      try {
        const page = await client.listMessages({ cursor, limit: options.pageSize ?? 50 }, { signal: controller.signal });
        if (startedIn !== generation) return;
        cursor = page?.nextCursor;
        const existing = new Set(snapshot.messages.map((message) => message.id));
        update({ hasMore: page?.hasMore ?? false, messages: [
          ...historyMessages(page?.items ?? []).filter((message) => !existing.has(message.id)), ...snapshot.messages
        ] });
      } catch (error) {
        if (startedIn === generation) update({ error: describeChatbotError(error, options) });
      } finally {
        controllers.delete(controller);
        if (startedIn === generation) update({ loadingMore: false });
      }
    },
    consent: {
      setDecision(purpose, granted) {
        if (snapshot.status === 'loading' || snapshot.status === 'sending' || !snapshot.consent.requests.some((request) => request.purpose === purpose)) return;
        consentChanged(sessionConsent(snapshot.consent.requests, { ...snapshot.consent.decisions, [purpose]: granted },
          false, client.getThreadId() !== null && !forceConsent));
      },
      acceptAll() {
        if (snapshot.status === 'loading' || snapshot.status === 'sending') return;
        const decisions = Object.fromEntries(snapshot.consent.requests.map((request) => [request.purpose, true]));
        consentChanged(sessionConsent(snapshot.consent.requests, decisions, true, client.getThreadId() !== null && !forceConsent));
      },
      confirm() {
        if (snapshot.status === 'loading' || snapshot.status === 'sending' || snapshot.consent.missing.length) return false;
        consentChanged(sessionConsent(snapshot.consent.requests, snapshot.consent.decisions, true, client.getThreadId() !== null && !forceConsent));
        return true;
      }
    },
    dispose() {
      abort();
      if (snapshot.status === 'sending') update({ status: idleStatus(), messages: snapshot.messages
        .filter((message) => message.role !== 'assistant' || !message.pending)
        .map((message) => message.pending ? { ...message, pending: false, failed: true, status: 'failed' } : message) });
      if (snapshot.loadingMore) update({ loadingMore: false });
    }
  };
  if (options.autoStart !== false) void start();
  return session;
}
