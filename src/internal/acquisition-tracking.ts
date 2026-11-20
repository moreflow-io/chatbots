// Generated from packages/sdk-internal/src/acquisition-tracking.ts by `bun run sync:sdk-internal`; edit that file instead.
import type { AcquisitionTracking } from '@moreflow/tracking';
import { ATTRIBUTION_SDK_URL_KEYS } from './attribution';

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
export function acquisitionTrackingConsented(
  setting: AcquisitionTrackingSetting | undefined
): boolean {
  return (typeof setting === 'function' ? setting() : setting) === true;
}

export interface UrlAcquisitionLocation {
  href?: string | undefined;
  search?: string | undefined;
}

/**
 * Reads `ATTRIBUTION_SDK_URL_KEYS` (the canonical list in `./attribution`) from the page URL and nothing else: no
 * cookies, no browser storage, no referrer or user agent, and nothing is kept
 * for a later call. Returns `undefined` when the URL carries none of them.
 */
export function captureUrlAcquisitionTracking(
  location?: UrlAcquisitionLocation | undefined
): AcquisitionTracking | undefined {
  const pageLocation =
    location ?? (typeof globalThis.location === 'undefined' ? undefined : globalThis.location);
  const tracking: AcquisitionTracking = {};
  try {
    const params = new URL(
      pageLocation?.href ?? pageLocation?.search ?? '',
      'https://moreflow.invalid'
    ).searchParams;
    for (const key of ATTRIBUTION_SDK_URL_KEYS) {
      const value = params.get(key);
      if (value) tracking[key] = value;
    }
  } catch {
    // A malformed location must not stop the submission.
  }
  return Object.keys(tracking).length > 0 ? Object.freeze(tracking) : undefined;
}
