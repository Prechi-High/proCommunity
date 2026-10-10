import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Linking, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { ArrowSquareOut, ArrowsLeftRight, Globe, Storefront, X } from '@/components/icons';
import { Eyebrow, Group, GroupRow, Pill, Stars, Tile } from '@/components/kit';
import { colors, fonts } from '@/constants/theme';
import { hapticTap } from '@/lib/haptics';
import { formatPrice, formatRange } from '@/lib/products';
import type { ProductProfile } from '@/lib/types';

export async function openLink(url: string | null | undefined) {
  if (!url) return;
  hapticTap();
  if (Platform.OS === 'web') {
    void Linking.openURL(url);
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
  } catch {
    void Linking.openURL(url);
  }
}

// ---------------------------------------------------------------------------

export function SpecsPane({
  profile,
  onAlternative,
}: {
  profile: ProductProfile;
  onAlternative: (name: string) => void;
}) {
  const id = profile.identity;
  const identityRows = [
    ['Brand', id.brand],
    ['Model', id.model],
    ['Category', [id.category, id.subcategory].filter(Boolean).join(' · ')],
    ['Variant', id.variant],
    ['Size', id.size],
  ].filter(([, v]) => v) as [string, string][];
  return (
    <View style={{ gap: 16 }}>
      {profile.summary ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 22, color: colors.bone }}>{profile.summary}</Text>
      ) : null}
      {profile.specs.length ? (
        <View style={{ gap: 8 }}>
          <Eyebrow>Key specs</Eyebrow>
          <Group>
            {profile.specs.map((s, i) => (
              <GroupRow key={`${s.label}-${i}`} label={s.label} value={s.value} last={i === profile.specs.length - 1} />
            ))}
          </Group>
        </View>
      ) : null}
      {identityRows.length ? (
        <View style={{ gap: 8 }}>
          <Eyebrow>Identity</Eyebrow>
          <Group>
            {identityRows.map(([l, v], i) => (
              <GroupRow key={l} label={l} value={v} last={i === identityRows.length - 1} />
            ))}
          </Group>
        </View>
      ) : null}
      {profile.howToUse || profile.compatibility || profile.uses.length ? (
        <View style={{ gap: 8 }}>
          <Eyebrow>Using it</Eyebrow>
          <Group style={{ paddingVertical: 12, gap: 10 }}>
            {profile.uses.length ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.bone }}>
                <Text style={{ fontFamily: fonts.semibold }}>Good for: </Text>
                {profile.uses.join(' · ')}
              </Text>
            ) : null}
            {profile.howToUse ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.bone }}>
                <Text style={{ fontFamily: fonts.semibold }}>How: </Text>
                {profile.howToUse}
              </Text>
            ) : null}
            {profile.compatibility ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.bone }}>
                <Text style={{ fontFamily: fonts.semibold }}>Works with: </Text>
                {profile.compatibility}
              </Text>
            ) : null}
          </Group>
        </View>
      ) : null}
      {profile.alternatives.length ? (
        <View style={{ gap: 8 }}>
          <Eyebrow>Compare with</Eyebrow>
          <Group>
            {profile.alternatives.map((a, i) => (
              <GroupRow
                key={a.name}
                icon={ArrowsLeftRight}
                label={a.name}
                detail={a.reason}
                onPress={() => onAlternative(a.name)}
                last={i === profile.alternatives.length - 1}
              />
            ))}
          </Group>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

export function PricesPane({ profile }: { profile: ProductProfile }) {
  const offers = profile.offers.filter((o) => o.price);
  if (!offers.length) {
    return (
      <Tile style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
        <Storefront size={28} color={colors.bone3} weight="regular" />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>No live listings found</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.bone2, textAlign: 'center' }}>
          We couldn’t confirm a seller price right now. Check back soon — prices refresh often.
        </Text>
      </Tile>
    );
  }
  return (
    <View style={{ gap: 14 }}>
      <Tile tone="ink">
        <Eyebrow color="rgba(255,255,255,0.55)">Price range</Eyebrow>
        <Text style={{ marginTop: 6, fontFamily: fonts.bold, fontSize: 28, letterSpacing: -1, color: colors.white }}>
          {formatRange(profile.priceRange)}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
          across {profile.priceRange?.count ?? offers.length} listings · outliers removed
        </Text>
      </Tile>
      <Group>
        {offers.map((o, i) => (
          <Pressable
            key={`${o.seller}-${i}`}
            onPress={() => void openLink(o.link)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 14,
              borderBottomWidth: i === offers.length - 1 ? 0 : 1,
              borderBottomColor: colors.line,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.lac2, alignItems: 'center', justifyContent: 'center' }}>
              <Storefront size={17} color={colors.bone2} weight="regular" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>{o.seller}</Text>
              {i === 0 ? <Pill label="Lowest price" tone="good" /> : o.rating ? <Stars rating={o.rating} /> : null}
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.bone }}>{formatPrice(o.price)}</Text>
            <ArrowSquareOut size={16} color={colors.hi} weight="bold" />
          </Pressable>
        ))}
      </Group>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3, lineHeight: 17 }}>
        No seller pays to appear here. Prices come from public listings and can change — confirm on the seller’s page.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

export function SourcesSheet({ profile, visible, onClose }: { profile: ProductProfile | null; visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} transparent={Platform.OS === 'web'}>
      <View style={{ flex: 1, backgroundColor: colors.wine, paddingTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.5, color: colors.bone }}>Receipts</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone3 }}>
              Every point links back to the people and pages it came from.
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.lac, alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} color={colors.bone} weight="bold" />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <Group>
            {(profile?.sources ?? []).map((s, i, all) => (
              <GroupRow
                key={s.url}
                icon={Globe}
                label={s.title || s.domain}
                detail={`${s.n} · ${s.kind === 'community' ? 'Community' : s.kind === 'review' ? 'Review' : 'Web'} · ${s.domain}`}
                onPress={() => void openLink(s.url)}
                last={i === all.length - 1}
              />
            ))}
          </Group>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

export function InvestigatingState() {
  return (
    <View style={{ paddingVertical: 48, alignItems: 'center', gap: 12 }}>
      <ActivityIndicator color={colors.hi} size="large" />
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>Loading product details…</Text>
    </View>
  );
}
