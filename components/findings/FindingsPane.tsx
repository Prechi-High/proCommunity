import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Marker } from '@/components/community';
import { ClaimDuelCard } from '@/components/findings/ClaimDuelCard';
import { UNMASK_COPY } from '@/components/findings/copy';
import { Eyebrow, Tile } from '@/components/kit';
import { markPhraseInText } from '@/lib/claims/markPhrase';
import type { OwnerDiscovery, ProductFindings } from '@/lib/claims/types';
import type { ProductProfile } from '@/lib/types';
import { colors, fonts, radii } from '@/constants/theme';

function UnmaskHero({ findings, brand }: { findings: ProductFindings; brand: string }) {
  const scored = findings.claims.filter((c) => c.score !== null);
  const backed = scored.filter((c) => (c.score ?? 0) >= 8).length;
  const mixed = scored.filter((c) => (c.score ?? 0) >= 3 && (c.score ?? 0) < 8).length;
  const contested = scored.filter((c) => (c.score ?? 0) < 3).length;
  const headline =
    findings.claims.length === 0
      ? 'We’re still collecting promises and owner reports for this product.'
      : `${findings.claims.length} brand promise${findings.claims.length === 1 ? '' : 's'} checked${
          scored.length ? ` · ${backed} hold up · ${mixed} mixed · ${contested} contested` : ''
        }`;

  const hook = findings.keyFindings[0];
  return (
    <View style={{ borderRadius: radii.card, overflow: 'hidden', backgroundColor: colors.bone }}>
      <View style={{ padding: 20, gap: 12 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 26, letterSpacing: -0.8, lineHeight: 30, color: colors.white }}>
          {UNMASK_COPY.leadTitle}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: 'rgba(255,255,255,0.78)' }}>{UNMASK_COPY.leadBody}</Text>
        {brand ? (
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.marker }}>
            Checking {brand}’s story against owner experience
          </Text>
        ) : null}
      </View>
      <View style={{ backgroundColor: colors.lac, paddingHorizontal: 16, paddingVertical: 14, gap: 10 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.bone2 }}>{headline}</Text>
        {hook ? (
          <Marker
            text={hook.text}
            marks={[hook.markerPhrase || '']}
            tone="hint"
            delay={200}
            style={{ fontFamily: fonts.medium, fontSize: 16, lineHeight: 24, color: colors.bone }}
          />
        ) : null}
      </View>
    </View>
  );
}

function MatchStrip({ findings }: { findings: ProductFindings }) {
  const m = findings.match;
  if (m.level === 'exact') return null;
  return (
    <Tile style={{ gap: 6, borderWidth: 1, borderColor: colors.honey, backgroundColor: colors.honeySoft }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.honeyInk }}>
        {m.level === 'possible' ? 'Confirm the exact model' : 'We need a clearer match'}
      </Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.honeyInk }}>{m.message}</Text>
    </Tile>
  );
}

function DiscoveryCard({ d }: { d: OwnerDiscovery }) {
  const isConcern = d.observationType === 'concern';
  const accent = isConcern ? colors.coral : d.observationType === 'benefit' ? colors.sage : colors.hi;
  const label = isConcern ? 'Watch for' : d.observationType === 'benefit' ? 'Pleasant surprise' : 'Good to know';

  return (
    <View style={{ borderRadius: radii.card, backgroundColor: colors.lac, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.wineDeep }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.bone2 }}>{label}</Text>
        <Text style={{ flex: 1, textAlign: 'right', fontFamily: fonts.regular, fontSize: 11, color: colors.bone3 }}>{d.mentionLabel}</Text>
      </View>
      <View style={{ padding: 14, gap: 8 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.bone }}>{d.topic}</Text>
        <Marker
          text={d.summary}
          marks={[markPhraseInText(d.summary, d.markerPhrase)]}
          tone={isConcern ? 'bad' : d.observationType === 'benefit' ? 'good' : 'hint'}
          instant
          style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.bone }}
        />
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.bone2 }}>{d.buyingImplication}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.bone3 }}>{d.manufacturerRelation}</Text>
      </View>
    </View>
  );
}

export function FindingsPane({ profile, onOpenSources }: { profile: ProductProfile; onOpenSources: () => void }) {
  const findings = profile.findings;
  const brand = profile.identity.brand;

  const sortedClaims = useMemo(() => {
    if (!findings) return [];
    return [...findings.claims].sort((a, b) => {
      const drama = (c: typeof a) => {
        if (c.score === null) return 0;
        if (c.score < 3) return 3;
        if (c.score < 8) return 2;
        return 1;
      };
      return drama(b) - drama(a) || (b.score ?? 0) - (a.score ?? 0);
    });
  }, [findings]);

  if (!findings) {
    return (
      <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.bone2 }}>
        Unmasking this product… pull to refresh if this stays empty.
      </Text>
    );
  }

  return (
    <View style={{ gap: 28 }}>
      <UnmaskHero findings={findings} brand={brand} />
      <MatchStrip findings={findings} />

      <View style={{ gap: 14 }}>
        <View style={{ gap: 4 }}>
          <Eyebrow>Promise by promise</Eyebrow>
          <Text style={{ fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.4, color: colors.bone }}>The brand said it. Owners lived it.</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone2 }}>
            Each card is one claim — with the receipts on who backs it up and who doesn’t.
          </Text>
        </View>
        {sortedClaims.map((c, i) => (
          <ClaimDuelCard key={c.id} claim={c} index={i} defaultOpen={i === 0} />
        ))}
        {!sortedClaims.length ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>
            No testable brand promises yet. Try refreshing after more sources load.
          </Text>
        ) : null}
      </View>

      {findings.discoveries.length ? (
        <View style={{ gap: 12 }}>
          <View style={{ gap: 4 }}>
            <Eyebrow>{UNMASK_COPY.beyondPitch}</Eyebrow>
            <Text style={{ fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.4, color: colors.bone }}>{UNMASK_COPY.beyondPitchSub}</Text>
          </View>
          {findings.discoveries.map((d) => (
            <DiscoveryCard key={d.id} d={d} />
          ))}
        </View>
      ) : null}

      <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.bone3 }}>{UNMASK_COPY.disclaimerFoot}</Text>
      <Pressable onPress={onOpenSources} accessibilityRole="button" style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: radii.button, borderWidth: 1, borderColor: colors.line }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.hi }}>{UNMASK_COPY.sources}</Text>
      </Pressable>
    </View>
  );
}
