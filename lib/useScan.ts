import * as ImagePicker from 'expo-image-picker';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';

import { hapticHeavy, hapticSelect, hapticSuccess } from './haptics';
import { extractProductFromPhoto, visionErrorCopy } from './productVision';
import { rememberProduct, slugify } from './products';
import { useAppStore } from './store';

export type ScanStage = 'idle' | 'reading' | 'identifying';

/** Photo → identity → full intelligence profile, in one gesture. */
export function useScan() {
  const router = useRouter();
  const addSearch = useAppStore((s) => s.addSearch);
  const [stage, setStage] = useState<ScanStage>('idle');
  const [preview, setPreview] = useState<string | null>(null);

  const run = async (camera: boolean) => {
    if (stage !== 'idle') return;
    try {
      const permission = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        hapticHeavy();
        Alert.alert('Permission needed', 'Allow access so Sourced can identify the product from a photo.');
        return;
      }
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.6,
        base64: true,
        exif: false,
      };
      const result = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (result.canceled || !result.assets?.[0]?.uri) {
        hapticSelect();
        return;
      }
      const asset = result.assets[0];
      setPreview(asset.uri);
      setStage('identifying');
      const vision = await extractProductFromPhoto({
        uri: asset.uri,
        fileName: asset.fileName,
        width: asset.width,
        height: asset.height,
        base64: asset.base64,
        mimeType: asset.mimeType,
      });
      if (!vision.ok || !vision.label) {
        hapticHeavy();
        const copy = visionErrorCopy(vision);
        Alert.alert(copy.title, copy.body);
        return;
      }
      hapticSuccess();
      const id = slugify(vision.label);
      rememberProduct({
        id,
        name: vision.name || vision.label,
        brand: vision.brand ?? '',
        category: vision.category || 'Product',
        heroImageUrl: null,
      });
      addSearch(vision.label);
      router.push({ pathname: '/product/[id]', params: { id, q: vision.label, from: 'scan' } } as Href);
    } catch (err) {
      hapticHeavy();
      Alert.alert('Photo search hit a snag', err instanceof Error ? err.message : 'Try again, or type the product name.');
    } finally {
      setStage('idle');
      setPreview(null);
    }
  };

  const start = () => {
    if (Platform.OS === 'web') {
      void run(false);
      return;
    }
    Alert.alert('Search with a photo', 'Point at the product, its label or its box.', [
      { text: 'Take photo', onPress: () => void run(true) },
      { text: 'Choose from library', onPress: () => void run(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return { start, stage, preview, busy: stage !== 'idle' };
}
