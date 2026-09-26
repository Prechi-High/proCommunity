import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { HapticPressable } from '@/components/HapticPressable';
import { Camera, MagnifyingGlass } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { Caption, Wordmark } from '@/components/ui';
import { colors, fonts, radii } from '@/constants/theme';
import { hapticHeavy, hapticSelect, hapticSuccess } from '@/lib/haptics';
import { extractProductFromPhoto as extractFromIntelligence } from '@/lib/productIntelligence';
import { searchCatalog } from '@/lib/products';
import { unlockAudio } from '@/lib/sounds';
import { useAppStore } from '@/lib/store';

export default function HomeScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const trimmed = query.trim();

  const { data: suggestions = [] } = useQuery({
    queryKey: ['home-suggest', trimmed],
    queryFn: () => searchCatalog(trimmed),
    enabled: trimmed.length >= 2,
    staleTime: 60_000,
  });

  const submit = () => {
    unlockAudio();
    if (!trimmed) {
      hapticHeavy();
      return;
    }
    hapticSelect();
    if (suggestions.length === 1) {
      router.push(`/probe/${suggestions[0].id}`);
    } else {
      router.push({ pathname: '/results', params: { q: trimmed } } as Href);
    }
  };

  const scan = async (camera: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const permission = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        hapticHeavy();
        Alert.alert('Permission needed', 'Allow photo access so Sourced can identify the product.');
        return;
      }

      const result = camera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
          });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        hapticSelect();
        if (!result.canceled) {
          Alert.alert('No photo selected', 'Try again with a clearer photo of the product label or bottle.');
        }
        return;
      }

      const asset = result.assets[0];
      if (!asset || !asset.uri) {
        hapticHeavy();
        Alert.alert(
          'Could not read photo',
          'That file may be in a format we do not support. Retry, or pick a different picture.',
        );
        return;
      }

      // Vision via Supabase product-vision (not Open Beauty Facts).
      console.log('[DEBUG] Starting product intelligence extraction for asset:', asset.uri);
      const intelligence = await extractFromIntelligence(asset);
      console.log('[DEBUG] Intelligence result:', intelligence);

      if (!intelligence.ok || !intelligence.label) {
        hapticHeavy();
        const title =
          intelligence.errorCode === 'no_vision_llm'
            ? 'Vision not configured'
            : intelligence.errorCode === 'network_error' || intelligence.errorCode === 'endpoint_missing'
              ? 'Scan unavailable offline'
              : intelligence.errorCode === 'image_read_failed' ||
                  intelligence.errorCode === 'no_asset_uri' ||
                  intelligence.errorCode === 'no_asset'
                ? 'Could not read that photo'
                : intelligence.errorCode === 'vision_timeout'
                  ? 'Vision timed out'
                  : intelligence.errorCode === 'vision_empty_output' || intelligence.errorCode === 'empty_response'
                    ? 'Not enough detail in the photo'
                    : 'Could not identify it';
        const attemptsSummary =
          intelligence.attempts && Array.isArray(intelligence.attempts) && intelligence.attempts.length > 0
            ? intelligence.attempts
                .slice(0, 5)
                .map((a: any) => {
                  if (!a) return '';
                  const parts: string[] = [];
                  if (a.provider) parts.push(String(a.provider));
                  if (a.label) parts.push(String(a.label).replace(/^or_|^g_|^nv_/, ''));
                  if (a.http || a.err) parts.push(a.err ? String(a.err) : `HTTP ${a.http}`);
                  return parts.join(' · ');
                })
                .filter(Boolean)
                .join('\n')
            : '';
        const baseMessage = intelligence.hint
          ? intelligence.hint
          : intelligence.errorMessage && intelligence.errorMessage !== intelligence.errorCode
            ? `${intelligence.errorMessage}${intelligence.source ? ` (${intelligence.source})` : ''}`
            : 'Try a clearer photo, or search by typing the product name below.';
        const message = attemptsSummary ? `${baseMessage}\n\nProviders tried:\n${attemptsSummary}` : baseMessage;
        Alert.alert(title, message);
        return;
      }

      hapticSuccess();

      const ur = intelligence.universalResult;
      const name = ur?.name || intelligence.label;
      router.push({
        pathname: '/results',
        params: {
          q: name || 'Product',
          universalName: name ?? '',
          universalBrand: ur?.brand ?? '',
          universalCategory: ur?.category ?? 'general',
          universalDescription: ur?.description ?? '',
          universalConfidence: String(ur?.confidence ?? 0.8),
          universalKeyFeatures: JSON.stringify(ur?.keyFeatures || []),
          universalProvider: ur?.provider ?? 'product-vision',
          universalModel: ur?.model ?? '',
        },
      } as Href);
    } catch (err) {
      hapticHeavy();
      const detail = err instanceof Error ? err.message : String(err ?? '');
      Alert.alert(
        'Scan failed',
        detail && detail !== 'undefined' && detail !== ''
          ? `${detail}\n\nTry another photo or search by name.`
          : 'Try another photo or search by typing the product name.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 }}>
        <Wordmark />
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.bone2 }}>
          {profile?.displayName ? profile.displayName.split(' ')[0] : 'Know before you buy'}
        </Text>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 24 }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 58, lineHeight: 56, letterSpacing: -2, color: colors.bone }}>
          Someone’s{`\n`}already{`\n`}tried it.
        </Text>
        <Caption color={colors.bone2}>Real people. Real use. Clearer choices.</Caption>

        <View style={{ marginTop: 26, height: 70, borderRadius: radii.search, backgroundColor: colors.bone, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={submit}
            placeholder="Search a product or brand"
            placeholderTextColor="rgba(42,14,22,0.5)"
            accessibilityLabel="Search a product"
            style={{ flex: 1, height: '100%', paddingHorizontal: 14, color: colors.wine, fontFamily: fonts.medium, fontSize: 16 }}
          />
          <HapticPressable onPress={submit} skipHaptic style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: trimmed ? colors.hi : colors.wine, alignItems: 'center', justifyContent: 'center' }}>
            <MagnifyingGlass size={22} color={trimmed ? colors.wine : colors.bone} weight="bold" />
          </HapticPressable>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Pressable onPress={() => scan(false)} disabled={busy} style={{ flex: 1, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.line, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
            <Camera size={18} color={colors.bone} weight="bold" />
            <Text style={{ marginTop: 5, fontFamily: fonts.medium, fontSize: 13, color: colors.bone }}>{busy ? 'Scanning…' : 'Upload photo'}</Text>
          </Pressable>
          <Pressable onPress={() => scan(true)} disabled={busy} style={{ flex: 1, padding: 14, borderRadius: 16, backgroundColor: colors.rosewoodSoft, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
            <Camera size={18} color={colors.hi} weight="fill" />
            <Text style={{ marginTop: 5, fontFamily: fonts.medium, fontSize: 13, color: colors.bone }}>{busy ? 'Scanning…' : 'Take photo'}</Text>
          </Pressable>
        </View>

        {trimmed.length >= 2 && suggestions.slice(0, 3).map((product) => (
          <HapticPressable key={product.id} onPress={() => router.push(`/probe/${product.id}`)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, color: colors.bone }}>{product.name}</Text>
              <Caption>{product.brand}</Caption>
            </View>
            <Text style={{ fontFamily: fonts.serif, fontSize: 24, color: colors.bone }}>›</Text>
          </HapticPressable>
        ))}
      </View>
    </Screen>
  );
}
