// Generated from packages/sdk-internal/src/page-experiments.ts by `bun run sync:sdk-internal`; edit that file instead.
/**
 * The experiment variants of the current page view, for a public submission (docs/growth-loop.md G6).
 * The served tracker keeps them in memory (`getAssignments`): nothing is read from or written to
 * storage, with or without consent, so an SDK may send them without the visitor's consent.
 */

/** An experiment variant the visitor saw on the page: `{ experiment, variant }`. */
export type PageExperimentAssignment = { experiment: string; variant: string };

/**
 * The page's assignments, or [] on the server, without the tracker, and on any error. Never throws.
 */
export function pageExperimentAssignments(): PageExperimentAssignment[] {
  try {
    if (typeof window === 'undefined') return [];
    const tracker = (window as unknown as { moreflowAnalytics?: { getAssignments?: unknown } }).moreflowAnalytics;
    const read = tracker?.getAssignments;
    if (typeof read !== 'function') return [];
    const result: unknown = read.call(tracker);
    if (!Array.isArray(result)) return [];
    return result.flatMap((entry: unknown) => {
      const record = typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : null;
      return typeof record?.experiment === 'string' && typeof record.variant === 'string'
        ? [{ experiment: record.experiment, variant: record.variant }]
        : [];
    });
  } catch {
    return [];
  }
}
