import type { ChatbotLeadConsentPurpose, ChatbotLeadConsentRequest } from './consent';
import type { describeChatbotError } from './error-messages';
import type { ChatbotMessage, ChatbotPublicConfig, ChatbotSendResult } from './public-types';

export interface ChatbotSessionOptions {
  locale?: 'de' | 'en' | undefined;
  formality?: 'formal' | 'informal' | undefined;
  pageSize?: number | undefined;
  /** Start explicitly with start(); useful for framework effect lifecycles. */
  autoStart?: boolean | undefined;
}
export type ChatbotSessionStatus = 'loading' | 'consent' | 'ready' | 'sending' | 'error';
export type ChatbotSessionError = ReturnType<typeof describeChatbotError>;
export type ChatbotSessionMessage = ChatbotMessage & {
  pending: boolean;
  failed: boolean;
  /** Stable across retries, including a lost first-thread response. */
  clientMessageId?: string | undefined;
};
export interface ChatbotSessionConsent {
  requests: readonly ChatbotLeadConsentRequest[];
  decisions: Readonly<Partial<Record<ChatbotLeadConsentPurpose, boolean | null>>>;
  needed: boolean;
  missing: readonly ChatbotLeadConsentRequest[];
  confirmed: boolean;
}
export interface ChatbotSessionSnapshot {
  status: ChatbotSessionStatus;
  config: ChatbotPublicConfig | null;
  messages: readonly ChatbotSessionMessage[];
  consent: ChatbotSessionConsent;
  error: ChatbotSessionError | null;
  hasMore: boolean;
  loadingMore: boolean;
}
export type ChatbotSessionSendOutcome =
  | { status: 'sent'; result: ChatbotSendResult }
  | { status: 'consent_required'; restoreText: string }
  | { status: 'error'; error: ChatbotSessionError }
  | { status: 'aborted' | 'ignored' };
export interface ChatbotSession {
  getSnapshot(): ChatbotSessionSnapshot;
  subscribe(listener: () => void): () => void;
  /** Settles after initial config/history load, with errors in the snapshot. */
  readonly ready: Promise<void>;
  start(): Promise<void>;
  send(text: string): Promise<ChatbotSessionSendOutcome>;
  retry(messageId: string): Promise<ChatbotSessionSendOutcome>;
  reset(): void;
  loadMore(): Promise<void>;
  consent: {
    setDecision(purpose: ChatbotLeadConsentPurpose, granted: boolean | null): void;
    acceptAll(): void;
    confirm(): boolean;
  };
  /** Cancels requests, preserving identity/history; start() resumes an unfinished load. */
  dispose(): void;
}
