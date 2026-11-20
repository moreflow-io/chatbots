// Generated from packages/sdk-internal/src/visitor-identify.ts by `bun run sync:sdk-internal`; edit that file instead.
/**
 * Links the website visitor to the CRM contact a public submission created or matched
 * (docs/website-analytics.md D-decision on visitor identity). It only calls the served tracker's
 * `identify`, which itself refuses without analytics consent and under Global Privacy Control, so
 * nothing is linked, stored or sent when the tracker is absent or the visitor has not consented.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Calls `window.moreflowAnalytics.identify(contactId)` when the tracker is present.
 * Returns whether the tracker accepted it (false without tracker, consent or a valid id). Never throws.
 */
export function identifyWebsiteVisitor(contactId: unknown): boolean {
  try {
    if (typeof window === 'undefined' || typeof contactId !== 'string' || !UUID.test(contactId)) return false;
    const tracker = (window as unknown as { moreflowAnalytics?: { identify?: unknown } }).moreflowAnalytics;
    const identify = tracker?.identify;
    if (typeof identify !== 'function') return false;
    return identify.call(tracker, contactId) === true;
  } catch {
    return false;
  }
}
