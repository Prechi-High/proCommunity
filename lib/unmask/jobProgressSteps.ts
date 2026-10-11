import type { UnmaskJobProgress } from '@/lib/products';

export type JobProgressStep = {
  id: string;
  title: string;
  detail: string;
  status: 'pending' | 'active' | 'done';
};

export function jobProgressSteps(job: UnmaskJobProgress | null | undefined): JobProgressStep[] {
  const completed = new Set(job?.completedStages ?? []);
  const active = new Set(job?.activeStages ?? []);
  const m = job?.milestones;
  const sections = job?.sections;

  const done = (id: string, when: boolean) => (when ? 'done' : active.has(id) ? 'active' : completed.has(id) ? 'done' : 'pending');

  const identifiedDone = completed.has('preview') || completed.has('llm') || job?.state === 'identified' || Boolean(m?.identified);
  const videosDone = Boolean(m?.youtubeComplete) || sections?.videos === 'ready';
  const commentsN = m?.rawComments ?? 0;
  const videosN = m?.videosFound ?? 0;
  const evidenceDone = sections?.evidence === 'ready' || Boolean(m?.evidenceMappingComplete);
  const scoreDone = sections?.scores === 'ready' || job?.state === 'ready' || Boolean(m?.scorecardComplete);

  const steps: JobProgressStep[] = [
    {
      id: 'identified',
      title: 'Product identified',
      detail: identifiedDone ? 'Identity resolved for this product' : 'Confirming product identity…',
      status: identifiedDone ? 'done' : 'active',
    },
    {
      id: 'videos',
      title: 'Reviewing video evidence',
      detail: videosDone
        ? videosN > 0
          ? `${videosN} relevant videos found`
          : 'Video search complete'
        : videosN > 0
          ? `${videosN} relevant videos found`
          : 'Finding relevant videos…',
      status: done('youtube', videosDone || videosN > 0),
    },
    {
      id: 'comments',
      title: 'Collecting owner comments',
      detail: commentsN > 0 ? `${commentsN.toLocaleString()} owner comments collected` : 'Reading YouTube & community comments…',
      status: done('evidence', commentsN > 0 || evidenceDone),
    },
    {
      id: 'validate',
      title: 'Validating owner experiences',
      detail: evidenceDone ? 'Experiences validated for scoring' : 'Checking relevance to this product…',
      status: evidenceDone ? 'done' : active.has('evidence') || active.has('youtube') ? 'active' : 'pending',
    },
    {
      id: 'scorecard',
      title: 'Building scorecard',
      detail: scoreDone ? 'Scorecard ready' : 'Mapping dimensions and scores…',
      status: scoreDone ? 'done' : active.has('blueprint') || active.has('scoring') ? 'active' : 'pending',
    },
  ];

  return steps;
}
