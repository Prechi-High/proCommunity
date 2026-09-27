import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Camera, CaretRight, CheckCircle, MagnifyingGlass, X } from '@/components/icons';
import type { LightboxImage } from '@/components/Lightbox';
import { colors, fonts } from '@/constants/theme';
import { hapticTap } from '@/lib/haptics';
import type { ProductProfile, ProductVariant, ScanRecord, VisualMatch } from '@/lib/types';

/** Photos to browse for a product: the shopper's own snap first, then the web gallery. */
export function galleryFor(profile: ProductProfile | null, scan: ScanRecord | undefined, hero: string | null): LightboxImage[] {
  const out: LightboxImage[] = [];
  const seen = new Set<string>();
  const add = (url: string | null | undefined, caption?: string, source?: string) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push({ url, caption, source });
  };
  if (scan?.photo) add(scan.photo, 'Your photo', `Identified as ${scan.label}`);
  for (const g of profile?.gallery ?? []) add(g.url, g.title, g.source);
  for (const u of profile?.images ?? []) add(u);
  add(hero);
  return out.slice(0, 16);
}

export function GalleryStrip({ images, onOpen, hasScan }: { images: LightboxImage[]; onOpen: (i: number) => void; hasScan: boolean }) {
  if (images.length < 2) return null;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 19, letterSpacing: -0.4, color: colors.bone }}>Gallery</Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.bone3 }}>{images.length} photos · tap to view</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
        {images.map((img, i) => {
          const mine = hasScan && i === 0;
          return (
            <Pressable
              key={img.url}
              onPress={() => {
                hapticTap();
                onOpen(i);
              }}
              accessibilityLabel={mine ? 'View your photo' : `View photo ${i + 1}`}
              style={({ pressed }) => ({
                width: i === 0 ? 168 : 128,
                height: 168,
                borderRadius: 18,
                overflow: 'hidden',
                backgroundColor: colors.lac,
                borderWidth: mine ? 2 : 1,
                borderColor: mine ? colors.hi : colors.line,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Image source={{ uri: img.url }} style={{ width: '100%', height: '100%' }} resizeMode={mine ? 'cover' : 'contain'} />
              {mine ? (
                <View style={{ position: 'absolute', left: 8, top: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.hi, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Camera size={11} color={colors.white} weight="fill" />
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.white }}>Your photo</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function VariantChips({ variants, current, onPick }: { variants: ProductVariant[]; current: string; onPick: (v: ProductVariant) => void }) {
  if (!variants.length) return null;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 19, letterSpacing: -0.4, color: colors.bone }}>Other versions</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone3 }}>Sizes, colours and models it comes in — tap to research one.</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {variants.map((v) => {
          const on = current && current.toLowerCase().includes(v.label.toLowerCase());
          return (
            <Pressable
              key={`${v.kind}-${v.label}`}
              onPress={() => {
                hapticTap();
                onPick(v);
              }}
              style={({ pressed }) => ({
                paddingHorizontal: 14,
                height: 38,
                borderRadius: 12,
                justifyContent: 'center',
                backgroundColor: on ? colors.black : colors.lac,
                borderWidth: on ? 0 : 1,
                borderColor: colors.line,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: on ? colors.white : colors.bone }}>{v.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ScanBanner({ scan, onPhoto, onMatches }: { scan: ScanRecord; onPhoto: () => void; onMatches: () => void }) {
  const pct = Math.round(scan.confidence * 100);
  const others = scan.matches.length + scan.alternatives.length;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.hiSoft, borderRadius: 18, padding: 10 }}>
      {scan.photo ? (
        <Pressable onPress={onPhoto} accessibilityLabel="View your photo">
          <Image source={{ uri: scan.photo }} style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: colors.lac }} resizeMode="cover" />
        </Pressable>
      ) : (
        <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: colors.hi, alignItems: 'center', justifyContent: 'center' }}>
          <Camera size={22} color={colors.white} weight="bold" />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <CheckCircle size={14} color={colors.hi} weight="fill" />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.hiInk }}>Matched from your photo · {pct}% sure</Text>
        </View>
        <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 16, color: colors.hiInk, opacity: 0.8 }}>
          {scan.features.length ? scan.features.slice(0, 2).join(' · ') : 'Read from the label, shape and design.'}
        </Text>
      </View>
      {others ? (
        <Pressable
          onPress={() => {
            hapticTap();
            onMatches();
          }}
          style={({ pressed }) => ({ paddingHorizontal: 12, height: 34, borderRadius: 999, backgroundColor: colors.white, justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.hi }}>Not it?</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function MatchesSheet({
  scan,
  visible,
  onClose,
  onPick,
}: {
  scan: ScanRecord | undefined;
  visible: boolean;
  onClose: () => void;
  onPick: (name: string, image?: string) => void;
}) {
  if (!scan) return null;
  const exact = scan.matches.filter((m) => m.exact);
  const similar = scan.matches.filter((m) => !m.exact);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.wine }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.5, color: colors.bone }}>Pick the exact one</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.bone2 }}>Products that look like your photo across the web.</Text>
          </View>
          <Pressable onPress={onClose} accessibilityLabel="Close" style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.lac, alignItems: 'center', justifyContent: 'center' }}>
            <X size={17} color={colors.bone} weight="bold" />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 18 }}>
          {scan.photo ? (
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Image source={{ uri: scan.photo }} style={{ width: 72, height: 72, borderRadius: 14 }} resizeMode="cover" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.bone3 }}>We read it as</Text>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>{scan.label}</Text>
              </View>
            </View>
          ) : null}
          {scan.alternatives.length ? (
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.bone3 }}>It could also be</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {scan.alternatives.map((a) => (
                  <Pressable key={a} onPress={() => onPick(a)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 38, borderRadius: 12, backgroundColor: colors.lac, borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.7 : 1 })}>
                    <MagnifyingGlass size={13} color={colors.bone3} weight="bold" />
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone }}>{a}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          {exact.length ? <MatchList title="Same product" rows={exact} onPick={onPick} /> : null}
          {similar.length ? <MatchList title="Looks similar" rows={similar} onPick={onPick} /> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function MatchList({ title, rows, onPick }: { title: string; rows: VisualMatch[]; onPick: (name: string, image?: string) => void }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.bone3 }}>{title}</Text>
      <View style={{ backgroundColor: colors.lac, borderRadius: 18, overflow: 'hidden' }}>
        {rows.map((m, i) => (
          <Pressable
            key={`${m.link}-${i}`}
            onPress={() => onPick(cleanTitle(m.title), m.image)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: colors.line, opacity: pressed ? 0.7 : 1 })}
          >
            {m.image ? <Image source={{ uri: m.image }} style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: colors.lac2 }} resizeMode="contain" /> : null}
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18, color: colors.bone }}>{cleanTitle(m.title)}</Text>
              <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>{m.source}</Text>
            </View>
            <CaretRight size={14} color={colors.bone3} weight="bold" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Store titles carry seller noise ("| Amazon.com", "Buy online…"); keep the product part. */
export function cleanTitle(title: string): string {
  return title
    .split(/\s[|–—]\s|\s-\s(?=[A-Z][a-z]+\.?(com|co|ng|uk)?\b)/)[0]
    .replace(/^(amazon\.com:|buy|shop)\s*/i, '')
    .replace(/\s*:\s*electronics$/i, '')
    .trim()
    .slice(0, 90);
}
