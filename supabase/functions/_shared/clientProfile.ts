/** Public rendering payload. Detailed assessment audit remains in server storage. */
export function clientProductProfile<T extends Record<string, any>>(profile: T): T {
  const result: Record<string, any> = { ...profile };
  if (profile.semanticReview) {
    const review = profile.semanticReview;
    result.semanticReview = {
      ...review,
      rows: Array.isArray(review.rows) ? review.rows.map((row: any) => ({ id: row.id ?? row.evidenceId })) : review.rows,
      decisions: review.decisions ? Object.fromEntries(Object.entries(review.decisions).map(([id, decision]: [string, any]) => [id, { status: decision.status }])) : review.decisions,
    };
  }
  // All rendering consumers prefer the top-level bundle. Do not send its two audit duplicates.
  if (profile.dimensionExperience && profile.presentation?.dimensionExperience) {
    const { dimensionExperience: _duplicate, ...presentation } = profile.presentation;
    result.presentation = presentation;
  }
  return result as T;
}
