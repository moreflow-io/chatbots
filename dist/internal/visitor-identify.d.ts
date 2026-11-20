/**
 * Links the website visitor to the CRM contact a public submission created or matched
 * (docs/website-analytics.md D-decision on visitor identity). It only calls the served tracker's
 * `identify`, which itself refuses without analytics consent and under Global Privacy Control, so
 * nothing is linked, stored or sent when the tracker is absent or the visitor has not consented.
 */
/**
 * Calls `window.moreflowAnalytics.identify(contactId)` when the tracker is present.
 * Returns whether the tracker accepted it (false without tracker, consent or a valid id). Never throws.
 */
export declare function identifyWebsiteVisitor(contactId: unknown): boolean;
