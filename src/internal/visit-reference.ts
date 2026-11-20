// Generated from packages/sdk-internal/src/visit-reference.ts by `bun run sync:sdk-internal`; edit that file instead.
/**
 * The visit a public submission links to (docs/website-analytics.md §8.1): the id of the page view's pageview
 * event and its client time, as the served tracker returns them (`visitRef`). The tracker returns null under
 * Global Privacy Control, after an explicit refusal and when no pageview was sent, so nothing is sent then.
 * Memory only: nothing is read from or written to storage, and nothing throws.
 */

/** The reference of a page view: `{ eventId, at }`, the shape the submission operations accept as `visit`. */
export type PageVisitReference = { eventId: string; at: string };

/** The tracker's event id rule (`d`): `b_` and 8 to 64 token characters. */
const EVENT_ID = /^b_[A-Za-z0-9_-]{8,64}$/u;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;

/**
 * The current page view's reference from the served tracker, or undefined without a tracker, a null reference
 * or a malformed one. Never throws.
 */
export function pageVisitReference(): PageVisitReference | undefined {
  try {
    if (typeof window === 'undefined') return undefined;
    const tracker = (window as unknown as { moreflowAnalytics?: { visitRef?: unknown } }).moreflowAnalytics;
    const read = tracker?.visitRef;
    if (typeof read !== 'function') return undefined;
    const result: unknown = read.call(tracker);
    if (typeof result !== 'object' || result === null) return undefined;
    const { eventId, at } = result as { eventId?: unknown; at?: unknown };
    return typeof eventId === 'string' && EVENT_ID.test(eventId) && typeof at === 'string' && ISO_TIME.test(at)
      ? { eventId, at }
      : undefined;
  } catch {
    return undefined;
  }
}
