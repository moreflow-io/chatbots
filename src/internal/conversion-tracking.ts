// Generated from packages/sdk-internal/src/conversion-tracking.ts by `bun run sync:sdk-internal`; edit that file instead.
/**
 * Records the conversion of a successful public submission (docs/website-analytics.md §6.1 and D14).
 * The event is anonymous like a pageview: its only property is the id of the surface (form, meeting
 * type or chatbot), never a contact id, email or free text. So it is sent with or without analytics
 * consent and under Global Privacy Control, and it is what a goal on the event name counts.
 *
 * Without the served tracker (or its `track`, which the pre-load queue stub lacks) nothing is sent and
 * nothing is queued, so a submission never waits for analytics.
 */

export const WEBSITE_CONVERSION_EVENTS = {
  formSubmitted: 'form_submitted',
  bookingCreated: 'booking_created',
  chatbotLeadCreated: 'chatbot_lead_created'
} as const;

export type WebsiteConversionEventName = (typeof WEBSITE_CONVERSION_EVENTS)[keyof typeof WEBSITE_CONVERSION_EVENTS];

/**
 * Calls `window.moreflowAnalytics.track(name, properties)` when the tracker is present. Every property
 * value must be a non-empty string (the surface id). Returns whether the tracker accepted the event.
 * Never throws.
 */
export function trackWebsiteConversion(name: WebsiteConversionEventName, properties: Readonly<Record<string, string>>): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (Object.values(properties).some((value) => typeof value !== 'string' || value === '')) return false;
    const tracker = (window as unknown as { moreflowAnalytics?: { track?: unknown } }).moreflowAnalytics;
    const track = tracker?.track;
    if (typeof track !== 'function') return false;
    track.call(tracker, name, { ...properties });
    return true;
  } catch {
    return false;
  }
}
