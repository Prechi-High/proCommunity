import * as ImagePicker from 'expo-image-picker';
import { useRouter, type Href } from 'expo-router';
import { createElement, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, Text, View } from 'react-native';

import { Camera, CameraRotate, UploadSimple, X } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';

import { hapticHeavy, hapticSelect, hapticSuccess, hapticTap } from './haptics';
import { extractProductFromPhoto, visionErrorCopy, type VisionAsset } from './productVision';
import { rememberProduct, slugify } from './products';
import { useAppStore } from './store';

export type ScanStage = 'idle' | 'reading' | 'identifying';

const PICKER_OPTS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: false,
  quality: 0.6,
  base64: true,
  exif: false,
};

function notify(title: string, body: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(`${title}\n\n${body}`);
  else Alert.alert(title, body);
}

function hasWebCamera(): boolean {
  return Platform.OS === 'web' && typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

/** Photo → identity → full profile. Offers a live camera or an upload, on web and native. */
export function useScan() {
  const router = useRouter();
  const addSearch = useAppStore((s) => s.addSearch);
  const [stage, setStage] = useState<ScanStage>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [webCamera, setWebCamera] = useState(false);

  const identify = async (asset: VisionAsset) => {
    try {
      setPreview(asset.uri);
      setStage('identifying');
      const vision = await extractProductFromPhoto(asset);
      if (!vision.ok || !vision.label) {
        hapticHeavy();
        const copy = visionErrorCopy(vision);
        notify(copy.title, copy.body);
        return;
      }
      hapticSuccess();
      const id = slugify(vision.label);
      const photo = vision.imageUrl || (asset.uri.startsWith('data:') && asset.uri.length > 400_000 ? '' : asset.uri);
      rememberProduct({
        id,
        name: vision.name || vision.label,
        brand: vision.brand ?? '',
        category: vision.category || 'Product',
        heroImageUrl: vision.matches?.find((m) => m.exact && m.image)?.image ?? null,
      });
      useAppStore.getState().rememberScan(id, {
        photo,
        label: vision.label,
        confidence: vision.confidence ?? 0.6,
        features: vision.features ?? [],
        alternatives: vision.alternatives ?? [],
        matches: vision.matches ?? [],
        at: new Date().toISOString(),
      });
      addSearch(vision.label);
      router.push({ pathname: '/product/[id]', params: { id, q: vision.searchQuery || vision.label, from: 'scan' } } as Href);
    } catch (err) {
      hapticHeavy();
      notify('Photo search hit a snag', err instanceof Error ? err.message : 'Try again, or type the product name.');
    } finally {
      setStage('idle');
      setPreview(null);
    }
  };

  const pick = async (camera: boolean) => {
    if (stage !== 'idle') return;
    if (Platform.OS !== 'web') {
      const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        hapticHeavy();
        notify('Permission needed', 'Allow access so Sourced can identify the product from a photo.');
        return;
      }
    }
    const result = camera ? await ImagePicker.launchCameraAsync(PICKER_OPTS) : await ImagePicker.launchImageLibraryAsync(PICKER_OPTS);
    if (result.canceled || !result.assets?.[0]?.uri) {
      hapticSelect();
      return;
    }
    const a = result.assets[0];
    await identify({ uri: a.uri, fileName: a.fileName, width: a.width, height: a.height, base64: a.base64, mimeType: a.mimeType });
  };

  const takePhoto = () => {
    setChoosing(false);
    if (hasWebCamera()) setWebCamera(true);
    else void pick(true);
  };

  const upload = () => {
    setChoosing(false);
    void pick(false);
  };

  const start = () => {
    if (stage !== 'idle') return;
    hapticTap();
    setChoosing(true);
  };

  const sheet: ReactNode = (
    <>
      <Modal visible={choosing} transparent animationType="fade" onRequestClose={() => setChoosing(false)}>
        <Pressable onPress={() => setChoosing(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <Pressable
            onPress={() => undefined}
            style={{ backgroundColor: colors.wine, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 30, gap: 12 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 21, letterSpacing: -0.4, color: colors.bone }}>Search with a photo</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>Point at the product, its label or its box.</Text>
              </View>
              <Pressable onPress={() => setChoosing(false)} hitSlop={10} accessibilityLabel="Close">
                <X size={20} color={colors.bone2} weight="bold" />
              </Pressable>
            </View>
            <SheetOption icon={<Camera size={22} color={colors.white} weight="bold" />} tone="accent" title="Take a photo" body="Use your camera right now" onPress={takePhoto} />
            <SheetOption icon={<UploadSimple size={22} color={colors.hi} weight="bold" />} title="Upload a photo" body="Pick one from your gallery or files" onPress={upload} />
          </Pressable>
        </Pressable>
      </Modal>
      {webCamera ? (
        <WebCameraModal
          onClose={() => setWebCamera(false)}
          onFallback={() => {
            setWebCamera(false);
            void pick(true);
          }}
          onCapture={(asset) => {
            setWebCamera(false);
            void identify(asset);
          }}
        />
      ) : null}
    </>
  );

  return { start, stage, preview, busy: stage !== 'idle', sheet };
}

function SheetOption({ icon, title, body, onPress, tone }: { icon: ReactNode; title: string; body: string; onPress: () => void; tone?: 'accent' }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 14,
        borderRadius: 18,
        backgroundColor: colors.lac,
        borderWidth: 1,
        borderColor: colors.line,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: tone === 'accent' ? colors.hi : colors.hiSoft, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>{title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone3 }}>{body}</Text>
      </View>
    </Pressable>
  );
}

const MAX_EDGE = 1280;

/** Live browser camera (getUserMedia) with a shutter, for laptops and phones on the web. */
function WebCameraModal({ onCapture, onClose, onFallback }: { onCapture: (asset: VisionAsset) => void; onClose: () => void; onFallback: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [status, setStatus] = useState<'starting' | 'live' | 'denied'>('starting');

  useEffect(() => {
    let cancelled = false;
    setStatus('starting');
    const stalled = setTimeout(() => !cancelled && !streamRef.current && setStatus('denied'), 12_000);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
        setStatus('live');
      })
      .catch(() => !cancelled && setStatus('denied'));
    return () => {
      cancelled = true;
      clearTimeout(stalled);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facing]);

  const shoot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    hapticSuccess();
    const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')?.drawImage(video, 0, 0, w, h);
    const uri = canvas.toDataURL('image/jpeg', 0.82);
    onCapture({ uri, width: w, height: h, base64: uri.split(',')[1], mimeType: 'image/jpeg', fileName: 'snap.jpg' });
  };

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {createElement('video', {
          ref: videoRef,
          autoPlay: true,
          playsInline: true,
          muted: true,
          style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: facing === 'user' ? 'scaleX(-1)' : undefined },
        })}

        {status === 'live' ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: '18%', bottom: '24%', left: '10%', right: '10%', borderRadius: 28, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' }} />
        ) : null}

        {status === 'starting' ? (
          <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: 12 } as never}>
            <ActivityIndicator color={colors.white} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>Allow camera access to continue</Text>
          </View>
        ) : null}

        {status === 'denied' ? (
          <View pointerEvents="box-none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 } as never}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.white, textAlign: 'center' }}>Camera not available</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
              Allow camera access in your browser’s address bar, or use your device’s camera app instead.
            </Text>
            <Pressable onPress={onFallback} style={{ height: 46, paddingHorizontal: 20, borderRadius: 14, backgroundColor: colors.hi, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.white }}>Open device camera</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={{ position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={onClose} accessibilityLabel="Close camera" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} color={colors.white} weight="bold" />
          </Pressable>
          <Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 15, color: colors.white }}>Fit the product in the frame</Text>
          <View style={{ width: 42 }} />
        </View>

        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 40 }}>
          <View style={{ width: 46 }} />
          <Pressable
            onPress={shoot}
            disabled={status !== 'live'}
            accessibilityLabel="Take photo"
            style={({ pressed }) => ({
              width: 78,
              height: 78,
              borderRadius: 39,
              borderWidth: 5,
              borderColor: colors.white,
              backgroundColor: pressed ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)',
              opacity: status === 'live' ? 1 : 0.4,
            })}
          />
          <Pressable
            onPress={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
            accessibilityLabel="Switch camera"
            style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}
          >
            <CameraRotate size={22} color={colors.white} weight="bold" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
