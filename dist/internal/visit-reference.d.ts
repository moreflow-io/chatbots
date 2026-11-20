/**
 * The visit a public submission links to (docs/website-analytics.md §8.1): the id of the page view's pageview
 * event and its client time, as the served tracker returns them (`visitRef`). The tracker returns null under
 * Global Privacy Control, after an explicit refusal and when no pageview was sent, so nothing is sent then.
 * Memory only: nothing is read from or written to storage, and nothing throws.
 */
/** The reference of a page view: `{ eventId, at }`, the shape the submission operations accept as `visit`. */
export type PageVisitReference = {
    eventId: string;
    at: string;
};
/**
 * The current page view's reference from the served tracker, or undefined without a tracker, a null reference
 * or a malformed one. Never throws.
 */
export declare function pageVisitReference(): PageVisitReference | undefined;
