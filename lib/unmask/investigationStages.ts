import type { ProductProfile } from '@/lib/types';

export type InvestigationStep = {
  id: string;
  title: string;
  detail: string;
  status: 'pending' | 'active' | 'done';
  progress: number;
};

export function investigationSteps(input: {
  loading: boolean;
  profile: ProductProfile | null;
  clipsLoading: boolean;
  clipsCount: number;
}): InvestigationStep[] {
  const { loading, profile, clipsLoading, clipsCount } = input;
  const claims = profile?.findings?.claims ?? [];
  const voices = profile?.voices?.length ?? 0;
  const discoveries = profile?.findings?.discoveries?.length ?? 0;
  const mixed = claims.filter((c) => c.score !== null && c.score >= 3 && c.score < 8).length;

  const done = (ok: boolean) => (ok ? 'done' : loading ? 'active' : 'pending');
  const experiencesDone = !loading && Boolean(profile) && (voices > 0 || claims.length > 0);
  const videosDone = !clipsLoading && clipsCount > 0;
  const patternsDone = !loading && claims.length > 0;
  const disagreeDone = !loading && mixed > 0;
  const surprisesDone = !loading && discoveries > 0;

  const steps: Omit<InvestigationStep, 'status' | 'progress'>[] = [
    {
      id: 'experiences',
      title: 'Checking owner experiences',
      detail: experiencesDone
        ? `${profile?.people?.ratings ?? voices ?? claims.reduce((n, c) => n + c.eligibleOwnerCount, 0)} experiences checked`
        : 'Reading reviews and owner comments…',
    },
    {
      id: 'videos',
      title: 'Reviewing video evidence',
      detail: videosDone ? `${clipsCount} videos indexed` : clipsLoading ? 'Finding relevant videos…' : 'Videos optional for this product',
    },
    {
      id: 'patterns',
      title: 'Finding recurring patterns',
      detail: patternsDone ? `${claims.length} themes mapped` : 'Grouping what people repeat…',
    },
    {
      id: 'disagree',
      title: 'Looking for disagreement',
      detail: disagreeDone ? `${mixed} mixed areas found` : 'Checking where owners split…',
    },
    {
      id: 'surprises',
      title: 'Searching for surprises',
      detail: surprisesDone ? `${discoveries} less obvious findings` : 'Scanning for unexpected insights…',
    },
  ];

  const flags = [experiencesDone, videosDone, patternsDone, disagreeDone, surprisesDone];
  return steps.map((step, i) => {
    const isDone = flags[i];
    const prevDone = i === 0 || flags[i - 1];
    let status: InvestigationStep['status'] = 'pending';
    if (isDone) status = 'done';
    else if (loading && prevDone) status = 'active';
    else if (!loading && !isDone && prevDone) status = 'active';
    const progress = isDone ? 1 : status === 'active' ? 0.45 : 0.08;
    return { ...step, status, progress };
  });
}

export function investigationComplete(loading: boolean, profile: ProductProfile | null): boolean {
  return !loading && Boolean(profile?.findings);
}
