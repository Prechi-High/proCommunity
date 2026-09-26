import { Image, Pressable, ScrollView, Text, View } from 'react-native';

import { Caption } from '@/components/ui';
import { colors, fonts, radii } from '@/constants/theme';
import type { ConfidenceBand } from '@/lib/productJourney';

export function ProductIdentityHero({
  brand,
  name,
  primaryImage,
  gallery,
  confidenceBand,
  category,
}: {
  brand: string;
  name: string;
  primaryImage: string | null;
  gallery: string[];
  confidenceBand: ConfidenceBand;
  category?: string;
}) {
  const bandColor =
    confidenceBand === 'High' ? colors.sage : confidenceBand === 'Likely' ? colors.honey : colors.coral;

  return (
    <View style={{ marginHorizontal: -22, marginBottom: 8 }}>
      <View style={{ height: 320, backgroundColor: colors.lac2, overflow: 'hidden' }}>
        {primaryImage ? (
          <Image source={{ uri: primaryImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : null}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 22,
            paddingBottom: 22,
            paddingTop: 56,
            backgroundColor: 'rgba(18,6,10,0.55)',
          }}
        >
          <Caption color="rgba(243,235,226,0.75)">{brand}</Caption>
          <Text
            style={{
              marginTop: 4,
              fontFamily: fonts.serif,
              fontSize: 34,
              lineHeight: 38,
              letterSpacing: -0.8,
              color: colors.bone,
            }}
          >
            {name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: radii.chip,
                backgroundColor: 'rgba(243,235,226,0.12)',
                borderWidth: 1,
                borderColor: bandColor,
              }}
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: bandColor }}>{confidenceBand} match</Text>
            </View>
            {category ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: 'rgba(243,235,226,0.55)' }}>
                {category}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
      {gallery.length >= 2 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 22, paddingTop: 12 }}
        >
          {gallery.slice(0, 4).map((uri) => (
            <Image
              key={uri}
              source={{ uri }}
              style={{ width: 56, height: 72, borderRadius: 12, backgroundColor: colors.lac }}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

export function VerdictMoment({
  score,
  verdict,
  basis,
  tooFew,
  loading,
}: {
  score: number | null;
  verdict: string | null;
  basis: string | null;
  tooFew: boolean;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <View style={{ marginTop: 20, padding: 20, borderRadius: 22, backgroundColor: colors.lac }}>
        <Caption>Weighing lived evidence…</Caption>
      </View>
    );
  }

  if (tooFew || score == null) {
    return (
      <View style={{ marginTop: 20, padding: 20, borderRadius: 22, backgroundColor: colors.lac }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 26, lineHeight: 30, color: colors.bone }}>
          Still gathering proof
        </Text>
        <Text style={{ marginTop: 10, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.bone2 }}>
          {basis || 'Not enough lived evidence yet. Explore what we know below, then ask owners.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 20, padding: 20, borderRadius: 22, backgroundColor: colors.lac }}>
      <Text style={{ fontFamily: fonts.serif, fontSize: 72, lineHeight: 74, color: colors.bone }}>{score}</Text>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.bone3 }}>Confidence</Text>
      {verdict ? (
        <Text style={{ marginTop: 14, fontFamily: fonts.serif, fontSize: 24, lineHeight: 30, color: colors.bone }}>
          {verdict}
        </Text>
      ) : null}
      {basis ? (
        <Text style={{ marginTop: 12, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.bone2 }}>
          {basis}
        </Text>
      ) : null}
    </View>
  );
}

export function ExperienceSplit({
  praise,
  complaints,
  signalCount,
}: {
  praise: string[];
  complaints: string[];
  signalCount: number;
}) {
  if (!praise.length && !complaints.length) return null;

  return (
    <View style={{ marginTop: 28 }}>
      <Text style={{ fontFamily: fonts.serif, fontSize: 26, color: colors.bone }}>Lived signal</Text>
      {signalCount > 0 ? (
        <Caption>Based on {signalCount} signals so far</Caption>
      ) : (
        <Caption>From public reviews and discussions</Caption>
      )}
      <View style={{ marginTop: 14, gap: 14 }}>
        {praise.length ? (
          <View>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.sage }}>People love</Text>
            {praise.map((line) => (
              <Text
                key={line}
                style={{ marginTop: 8, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.bone2 }}
              >
                “{line}”
              </Text>
            ))}
          </View>
        ) : null}
        {complaints.length ? (
          <View>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.coral }}>Watch for</Text>
            {complaints.map((line) => (
              <Text
                key={line}
                style={{ marginTop: 8, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.bone2 }}
              >
                “{line}”
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function ClaimRows({
  claims,
  expandedKey,
  onToggle,
}: {
  claims: Array<{ key: string; label: string; value: string; confidence: number; provenance?: string }>;
  expandedKey: string | null;
  onToggle: (key: string) => void;
}) {
  if (!claims.length) return null;

  return (
    <View style={{ marginTop: 28 }}>
      <Text style={{ fontFamily: fonts.serif, fontSize: 26, color: colors.bone }}>What matters</Text>
      <Caption>Facts Sourced can stand behind</Caption>
      <View style={{ marginTop: 8 }}>
        {claims.map((claim) => {
          const open = expandedKey === claim.key;
          const dot =
            claim.confidence >= 0.75 ? colors.sage : claim.confidence >= 0.45 ? colors.honey : colors.coral;
          return (
            <Pressable
              key={claim.key}
              onPress={() => onToggle(claim.key)}
              style={{ paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.line }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.bone3 }}>{claim.label}</Text>
                  <Text style={{ marginTop: 2, fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.bone }}>
                    {claim.value}
                  </Text>
                </View>
              </View>
              {open && claim.provenance ? (
                <Text style={{ marginTop: 8, marginLeft: 18, fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>
                  {claim.provenance}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function PriceSignal({
  price,
  priceRange,
}: {
  price: { amount: number; currency: string; seller?: string | null; observedAt?: string | null } | null;
  priceRange: { min: number; max: number; currency: string } | null;
}) {
  if (!price && !priceRange) return null;

  const format = (amount: number, currency: string) => {
    if (currency === 'NGN' || currency === '₦') return `₦${Math.round(amount).toLocaleString()}`;
    if (currency === 'USD' || currency === '$') return `$${amount.toFixed(2)}`;
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  };

  let headline = '';
  if (priceRange && priceRange.min !== priceRange.max) {
    headline = `${format(priceRange.min, priceRange.currency)} – ${format(priceRange.max, priceRange.currency)}`;
  } else if (priceRange) {
    headline = `About ${format(priceRange.min, priceRange.currency)}`;
  } else if (price) {
    headline = `About ${format(price.amount, price.currency)}`;
  }

  const captionParts: string[] = ['Observed'];
  if (price?.seller) captionParts.push(price.seller);
  if (price?.observedAt) {
    try {
      captionParts.push(new Date(price.observedAt).toLocaleDateString());
    } catch {
      /* ignore */
    }
  }

  return (
    <View style={{ marginTop: 28 }}>
      <Text style={{ fontFamily: fonts.serif, fontSize: 26, color: colors.bone }}>Price sense</Text>
      <Text style={{ marginTop: 10, fontFamily: fonts.semibold, fontSize: 22, color: colors.bone }}>{headline}</Text>
      <Caption>{captionParts.join(' · ')}</Caption>
    </View>
  );
}
