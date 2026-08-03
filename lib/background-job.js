/**
 * Runs pipeline work outside the request/response cycle.
 *
 * Video work routinely takes longer than Apache's 300s Timeout, and a request
 * that outlives it gets a gateway error whose body isn't JSON — so the browser
 * reported "Regeneration failed" while the shoot was still running and went on
 * to succeed. Holding a connection open for the length of a Higgsfield shoot
 * was never going to work; these routes start the work, return immediately,
 * and let the client follow progress by polling post/segment state.
 *
 * Failures are recorded on the post (status + errorMessage) by the pipeline
 * itself, which is what the UI reads — so swallowing the rejection here only
 * prevents an unhandled rejection, it doesn't hide anything from the user.
 */
export function startBackgroundJob(label, work) {
  Promise.resolve()
    .then(work)
    .catch((err) => console.error(`[video-background] ${label}:`, err));
}
