let seq = 0;

export function nextResearchRequestId(): string {
  seq += 1;
  return `research_${seq}_${Date.now().toString(36)}`;
}

/** Ignore late responses when a newer request superseded this one. */
export function isStaleRequest(currentId: string | null, observedId: string): boolean {
  return Boolean(currentId && currentId !== observedId);
}
