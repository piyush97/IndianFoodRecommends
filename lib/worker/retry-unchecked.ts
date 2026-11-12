import { sql } from "drizzle-orm";
import { autoReviewPending, type AutoReviewDeps, type AutoReviewSummary } from "../auto-review";

/**
 * Re-opens LLM picks rejected without a Jev check because their video text was
 * not found, then runs the normal review so the same check and thresholds
 * decide them. Text still missing sends a pick back to `no-video-text` for a
 * later run. Picks rejected before that reason existed are stored as
 * `not-grounded` with no check; those are re-opened too, unless they lack a
 * place name or dish (`no-place-name` now): a re-check cannot add one.
 */
export async function retryUnchecked(
  deps: AutoReviewDeps,
): Promise<AutoReviewSummary & { reopened: number }> {
  const reopened = await deps.db.execute(sql`
    update recommendations r
    set status = 'pending', reviewed_at = null, extracted = r.extracted - 'autoReview'
    from sources s, creators c
    where s.id = r.source_id and c.id = s.creator_id and not c.opted_out
      and r.status = 'rejected' and r.origin = 'llm'
      and (
        r.extracted->'autoReview'->>'reason' = 'no-video-text'
        or (
          r.extracted->'autoReview'->>'reason' = 'not-grounded'
          and coalesce(jsonb_typeof(r.extracted->'autoReview'->'check'), 'null') = 'null'
          and coalesce(r.extracted->>'place_name', '') <> ''
          and jsonb_array_length(coalesce(r.extracted->'dishes', '[]')) > 0
        )
      )
    returning r.id
  `);
  return { reopened: reopened.length, ...(await autoReviewPending(deps)) };
}
