/**
 * Whether an SDK may capture acquisition tracking itself. `false` (the default)
 * captures nothing; pass `true` or a function that returns `true` once the
 * visitor agreed in your consent banner. A function is asked on every call.
 */
export type AcquisitionTrackingSetting = boolean | (() => boolean);
/** Only an explicit `true`, or a function returning `true`, enables the capture. */
export declare function acquisitionTrackingEnabled(setting: AcquisitionTrackingSetting | undefined): boolean;
