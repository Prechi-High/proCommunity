export type PublicUnmaskStage =
  | 'open'
  | 'picked'
  | 'making'
  | 'unmasked'
  | 'held';

export function publicUnmaskStage(status?: string | null): PublicUnmaskStage {
  if (status === 'published') return 'unmasked';
  if (status === 'investigating') return 'making';
  if (status === 'selected') return 'picked';
  if (status === 'held' || status === 'cancelled') return 'held';
  return 'open';
}

export function publicUnmaskLabel(stage: PublicUnmaskStage): string {
  return {
    open: 'Open for Sparks',
    picked: 'An Unmasker has this',
    making: 'In the making',
    unmasked: 'Ultra Unmasked',
    held: 'Not going further',
  }[stage];
}

/** Default Spark weight before the team can start an Ultra Unmask. Admin can change this. */
export const ULTRA_UNMASK_SPARK_GOAL = 500;

export function sparkProgress(weight = 0, goal = ULTRA_UNMASK_SPARK_GOAL) {
  const safeGoal = Math.max(1, goal);
  const clamped = Math.max(0, weight);
  return {
    weight: clamped,
    goal: safeGoal,
    ratio: Math.min(1, clamped / safeGoal),
    remaining: Math.max(0, safeGoal - clamped),
    ready: clamped >= safeGoal,
  };
}

export function sparkNaira(sparks: number): string {
  return `₦${(sparks * 10).toLocaleString('en-NG')}`;
}

export function combinedSupport(sparks = 0, thunder = 0): number {
  return sparks + thunder * 100;
}
