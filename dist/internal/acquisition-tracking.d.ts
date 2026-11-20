import type { AcquisitionTracking } from '@moreflow/tracking';
/**
 * The visitor's tracking consent, as your consent banner reports it. `true`, or
 * a function that returns `true` once the visitor agreed, lets an SDK read ad
 * cookies (`_fbp`, `_fbc`, `_ttp`) and keep the captured values in browser
 * storage. Without consent (the default, `false`, or a function returning
 * `false`) an SDK still sends the UTM parameters and ad click ids of the current
 * page URL, but reads no cookies and writes no browser storage. A function is
 * asked on every call.
 */
export type AcquisitionTrackingSetting = boolean | (() => boolean);
/** Only an explicit `true`, or a function returning `true`, counts as consent. */
export declare function acquisitionTrackingConsented(setting: AcquisitionTrackingSetting | undefined): boolean;
export interface UrlAcquisitionLocation {
    href?: string | undefined;
    search?: string | undefined;
}
/**
 * Reads `ATTRIBUTION_SDK_URL_KEYS` (the canonical list in `./attribution`) from the page URL and nothing else: no
 * cookies, no browser storage, no referrer or user agent, and nothing is kept
 * for a later call. Returns `undefined` when the URL carries none of them.
 */
export declare function captureUrlAcquisitionTracking(location?: UrlAcquisitionLocation | undefined): AcquisitionTracking | undefined;
