import { Appearance } from 'react-native';

export { type ProductCaseAnalysis } from './productCase';

export function scoreBand(score: number | null | undefined): 'Excellent' | 'Good' | 'Average' | 'Weak' {
  if (score == null) return 'Weak';
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 50) return 'Average';
  return 'Weak';
}
