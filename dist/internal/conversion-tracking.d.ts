/**
 * Records the conversion of a successful public submission (docs/website-analytics.md §6.1 and D14).
 * The event is anonymous like a pageview: its only property is the id of the surface (form, meeting
 * type or chatbot), never a contact id, email or free text. So it is sent with or without analytics
 * consent and under Global Privacy Control, and it is what a goal on the event name counts.
 *
 * Without the served tracker (or its `track`, which the pre-load queue stub lacks) nothing is sent and
 * nothing is queued, so a submission never waits for analytics.
 */
export declare const WEBSITE_CONVERSION_EVENTS: {
    readonly formSubmitted: 'form_submitted';
    readonly bookingCreated: 'booking_created';
    readonly chatbotLeadCreated: 'chatbot_lead_created';
};
export type WebsiteConversionEventName = (typeof WEBSITE_CONVERSION_EVENTS)[keyof typeof WEBSITE_CONVERSION_EVENTS];
/**
 * Calls `window.moreflowAnalytics.track(name, properties)` when the tracker is present. Every property
 * value must be a non-empty string (the surface id). Returns whether the tracker accepted the event.
 * Never throws.
 */
export declare function trackWebsiteConversion(name: WebsiteConversionEventName, properties: Readonly<Record<string, string>>): boolean;
