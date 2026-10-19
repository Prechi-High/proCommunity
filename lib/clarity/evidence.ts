import type { DimensionEvidenceItem, DimensionExperienceBundle } from '@/lib/unmask/dimensionEvidence';
export function summarizeReports(items: DimensionEvidenceItem[], skin = 'All') {
    const unique = [...new Map(items.filter(x => x.affectsScore && x.url && ['positive', 'mixed', 'negative'].includes(x.stance)).map(x => [x.evidenceId, x])).values()];
    const matched = skin === 'All' ? unique : unique.filter(x => (x as DimensionEvidenceItem & {
        skinType?: string;
        skinTypeSource?: string;
    }).skinTypeSource === 'self_disclosed' && (x as DimensionEvidenceItem & {
        skinType?: string;
    }).skinType === skin);
    const positive = matched.filter(x => x.stance === 'positive').length, mixed = matched.filter(x => x.stance === 'mixed').length, negative = matched.filter(x => x.stance === 'negative').length, total = positive + mixed + negative;
    return { positive, mixed, negative, total, percent: total >= 20 ? Math.round(positive / total * 100) : null, items: matched, unknown: unique.filter(x => !(x as DimensionEvidenceItem & {
            skinTypeSource?: string;
        }).skinTypeSource).length };
}
export function numericReportShare(summary: ReturnType<typeof summarizeReports>, bundle: DimensionExperienceBundle) { return bundle.sufficiencyGate?.sufficientForNumericScore === false ? null : summary.percent; }
