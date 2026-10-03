/** Backend-aligned research stages — copy from Unmask AI Builder spec step 2. */
export type ResearchStage = 'idle' | 'identifying' | 'details' | 'experiences' | 'organising' | 'generic';

export const RESEARCH_STAGE_LABEL: Record<ResearchStage, string> = {
  idle: '',
  identifying: 'Identifying your product…',
  details: 'Finding product details…',
  experiences: 'Checking owner experiences…',
  organising: 'Organising the evidence…',
  generic: 'Looking beneath the surface…',
};

export function labelForStage(stage: ResearchStage): string {
  return RESEARCH_STAGE_LABEL[stage] || RESEARCH_STAGE_LABEL.generic;
}

/** Map a catalog search lifecycle to visible stage text (no fake percentages). */
export function stageForTextSearch(opts: { fetching: boolean; hasResults: boolean; elapsedMs: number }): ResearchStage {
  if (!opts.fetching) return 'idle';
  if (opts.hasResults) return 'organising';
  if (opts.elapsedMs < 900) return 'identifying';
  if (opts.elapsedMs < 2200) return 'details';
  if (opts.elapsedMs < 4000) return 'experiences';
  return 'organising';
}

export function stageForPhotoIdentify(elapsedMs: number): ResearchStage {
  if (elapsedMs < 1200) return 'identifying';
  if (elapsedMs < 2800) return 'details';
  return 'experiences';
}
