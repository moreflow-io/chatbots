// Generated from packages/sdk-internal/src/acquisition-tracking.ts by `bun run sync:sdk-internal`; edit that file instead.
/**
 * Whether an SDK may capture acquisition tracking itself. `false` (the default)
 * captures nothing; pass `true` or a function that returns `true` once the
 * visitor agreed in your consent banner. A function is asked on every call.
 */
export type AcquisitionTrackingSetting = boolean | (() => boolean);

/** Only an explicit `true`, or a function returning `true`, enables the capture. */
export function acquisitionTrackingEnabled(
  setting: AcquisitionTrackingSetting | undefined
): boolean {
  return (typeof setting === 'function' ? setting() : setting) === true;
}
