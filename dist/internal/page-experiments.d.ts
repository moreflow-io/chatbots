/**
 * The experiment variants of the current page view, for a public submission (docs/growth-loop.md G6).
 * The served tracker keeps them in memory (`getAssignments`): nothing is read from or written to
 * storage, with or without consent, so an SDK may send them without the visitor's consent.
 */
/** An experiment variant the visitor saw on the page: `{ experiment, variant }`. */
export type PageExperimentAssignment = {
    experiment: string;
    variant: string;
};
/**
 * The page's assignments, or [] on the server, without the tracker, and on any error. Never throws.
 */
export declare function pageExperimentAssignments(): PageExperimentAssignment[];
