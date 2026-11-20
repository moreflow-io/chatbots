import { createRandomId } from './internal/values';

/**
 * The chatbot experiment of the current page view (docs/growth-loop.md Phase 2, docs/website-analytics.md §7.3):
 * the server assigns the visitor to a variant of the opener, the client keeps the assignment in memory for
 * the page view, records the exposure through the served tracker once, and sends the variant with the
 * visitor's messages. Nothing is stored, and nothing throws: a server, a missing tracker or a broken tracker
 * just gets no exposure.
 */

export type ChatbotPageExperiment = { experiment: string; variant: string };

/** The page view's visitor key: random, kept in memory only, never stored. Sent with every public config read. */
let pageVisitorKeyValue: string | undefined;
export function chatbotPageVisitorKey(): string {
  pageVisitorKeyValue ??= createRandomId();
  return pageVisitorKeyValue;
}

const experimentByChatbot = new Map<string, ChatbotPageExperiment>();
const exposedKeys = new Set<string>();

/** Keeps the assignment of a chatbot for the page view; null (no experiment) forgets it. */
export function rememberChatbotExperiment(chatbotId: string, experiment: ChatbotPageExperiment | null): void {
  if (experiment) experimentByChatbot.set(chatbotId, experiment);
  else experimentByChatbot.delete(chatbotId);
}

export function chatbotExperimentFor(chatbotId: string): ChatbotPageExperiment | undefined {
  return experimentByChatbot.get(chatbotId);
}

/** Reads the `experiment` of a public config response; anything that is not `{ key, variant }` strings is no assignment. */
export function experimentFromChatbotConfig(value: unknown): ChatbotPageExperiment | null {
  if (typeof value !== 'object' || value === null || !('experiment' in value)) return null;
  const experiment: unknown = value.experiment;
  if (typeof experiment !== 'object' || experiment === null) return null;
  const record: { key?: unknown; variant?: unknown } = experiment;
  return typeof record.key === 'string' && typeof record.variant === 'string' ? { experiment: record.key, variant: record.variant } : null;
}

/**
 * Records the exposure through the served tracker, once per page view and variant. Guarded: never throws.
 * Without a window (a server) or a tracker, nothing is recorded.
 */
export function trackChatbotExposure(chatbotId: string, experiment: ChatbotPageExperiment): void {
  try {
    if (typeof window === 'undefined') return;
    const identity = `${chatbotId}\u0000${experiment.experiment}\u0000${experiment.variant}`;
    if (exposedKeys.has(identity)) return;
    const tracker = (window as unknown as { moreflowAnalytics?: { track?: unknown } }).moreflowAnalytics;
    const track = tracker?.track;
    if (typeof track !== 'function') return;
    track.call(tracker, 'exposure', { experiment: experiment.experiment, variant: experiment.variant });
    exposedKeys.add(identity);
  } catch {
    // An exposure is analytics; a failing tracker must not break the chat.
  }
}

/** The page's assignments for a message: the chatbot's own first, then the tracker's; one entry per experiment key. */
export function mergeChatbotExperimentVariants(
  chatbotAssignment: ChatbotPageExperiment | undefined,
  pageAssignments: readonly ChatbotPageExperiment[]
): ChatbotPageExperiment[] {
  const seen = new Set<string>();
  const merged: ChatbotPageExperiment[] = [];
  for (const entry of chatbotAssignment ? [chatbotAssignment, ...pageAssignments] : pageAssignments) {
    if (seen.has(entry.experiment)) continue;
    seen.add(entry.experiment);
    merged.push(entry);
  }
  return merged;
}
