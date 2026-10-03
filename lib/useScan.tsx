import * as ImagePicker from 'expo-image-picker';
import { useRouter, type Href } from 'expo-router';
import { createElement, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { ResearchOverlay } from '@/components/brand/ResearchOverlay';
import { FocusCorners } from '@/components/brand/FocusCorners';
import { ArrowsLeftRight, Camera, CameraRotate, CaretRight, Check, UploadSimple, X } from '@/components/icons';
import { PrimaryButton, ProductImage } from '@/components/kit';
import { colors, fonts } from '@/constants/theme';

import { hapticHeavy, hapticSelect, hapticSuccess, hapticTap } from './haptics';
import { stageForPhotoIdentify } from './research/overlayStages';
import { useResearchElapsed } from './research/useResearchElapsed';
import { extractProductFromPhoto, visionErrorCopy, type DetectedProduct, type VisionAsset, type VisionResult } from './productVision';
import { rememberProduct, slugify } from './products';
import { useAppStore } from './store';

export const MAX_COMPARE = 3;

type MultiScan = { photo: string; width: number; height: number; products: DetectedProduct[]; imageUrl: string };

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
  const [multi, setMulti] = useState<MultiScan | null>(null);
  const [pendingReview, setPendingReview] = useState<VisionAsset | null>(null);
  const identifyElapsed = useResearchElapsed(stage !== 'idle');
  const identifyStage = stageForPhotoIdentify(identifyElapsed);

  const photoFor = (asset: VisionAsset, vision: VisionResult) =>
    vision.imageUrl || (asset.uri.startsWith('data:') && asset.uri.length > 400_000 ? '' : asset.uri);

  /** Remembers a detected product (with the photo it came from) and returns its id. */
  const adopt = (p: Pick<DetectedProduct, 'label' | 'name' | 'brand' | 'category' | 'confidence'>, photo: string, extra?: Partial<VisionResult>) => {
    const id = slugify(p.label);
    rememberProduct({
      id,
      name: p.name || p.label,
      brand: p.brand ?? '',
      category: p.category || 'Product',
      heroImageUrl: extra?.matches?.find((m) => m.exact && m.image)?.image ?? null,
    });
    useAppStore.getState().rememberScan(id, {
      photo,
      label: p.label,
      confidence: p.confidence ?? 0.6,
      features: extra?.features ?? [],
      alternatives: extra?.alternatives ?? [],
      matches: extra?.matches ?? [],
      at: new Date().toISOString(),
    });
    return id;
  };

  const openOne = (p: DetectedProduct, photo: string) => {
    setMulti(null);
    hapticTap();
    const id = adopt(p, photo);
    addSearch(p.label);
    router.push({ pathname: '/product/[id]', params: { id, q: p.searchQuery || p.label, from: 'scan' } } as Href);
  };

  const compareMany = (list: DetectedProduct[], photo: string) => {
    setMulti(null);
    hapticSuccess();
    const ids = list.slice(0, MAX_COMPARE).map((p) => adopt(p, photo));
    router.push({ pathname: '/compare', params: { ids: ids.join(','), from: 'scan' } } as Href);
  };

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
      const photo = photoFor(asset, vision);
      if (vision.products && vision.products.length > 1) {
        setMulti({ photo: asset.uri, width: asset.width ?? 0, height: asset.height ?? 0, products: vision.products, imageUrl: photo });
        return;
      }
      const id = adopt({ label: vision.label, name: vision.name || vision.label, brand: vision.brand ?? '', category: vision.category ?? '', confidence: vision.confidence ?? 0.6 }, photo, vision);
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
        notify('Permission needed', 'Allow access so Unmask can identify the product from a photo.');
        return;
      }
    }
    const result = camera ? await ImagePicker.launchCameraAsync(PICKER_OPTS) : await ImagePicker.launchImageLibraryAsync(PICKER_OPTS);
    if (result.canceled || !result.assets?.[0]?.uri) {
      hapticSelect();
      return;
    }
    const a = result.assets[0];
    setPendingReview({ uri: a.uri, fileName: a.fileName, width: a.width, height: a.height, base64: a.base64, mimeType: a.mimeType });
  };

  const confirmReview = async () => {
    if (!pendingReview) return;
    const asset = pendingReview;
    setPendingReview(null);
    await identify(asset);
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
            setPendingReview(asset);
          }}
        />
      ) : null}
      {pendingReview ? (
        <PhotoReviewModal asset={pendingReview} onBack={() => setPendingReview(null)} onRetake={() => setPendingReview(null)} onUse={() => void confirmReview()} />
      ) : null}
      <ResearchOverlay visible={stage !== 'idle'} stage={identifyStage} photoUri={preview} onCancel={() => { setStage('idle'); setPreview(null); }} />
      {multi ? (
        <MultiPickSheet
          scan={multi}
          onClose={() => setMulti(null)}
          onOpen={(p) => openOne(p, multi.imageUrl)}
          onCompare={(list) => compareMany(list, multi.imageUrl)}
        />
      ) : null}
    </>
  );

  return { start, openCamera: takePhoto, openUpload: upload, stage, preview, busy: stage !== 'idle', sheet };
}

function PhotoReviewModal({
  asset,
  onBack,
  onRetake,
  onUse,
}: {
  asset: VisionAsset;
  onBack: () => void;
  onRetake: () => void;
  onUse: () => void;
}) {
  return (
    <Modal visible animationType="slide" onRequestClose={onBack}>
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <Image source={{ uri: asset.uri }} style={{ flex: 1 }} resizeMode="contain" />
        <View style={{ padding: 20, gap: 10, backgroundColor: colors.wine, borderTopWidth: 1, borderTopColor: colors.line }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: colors.bone }}>Use this photo?</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2, lineHeight: 20 }}>
            We’ll identify the product from packaging and labels. Retake if the label isn’t clear.
          </Text>
          <PrimaryButton label="Use photo" onPress={onUse} />
          <Pressable onPress={onRetake} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.hi }}>Retake</Text>
          </Pressable>
          <Pressable onPress={onBack} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone3 }}>Back</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
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

/** A square crop of the original photo around one detected product. */
function CropThumb({ uri, width, height, box, category, size = 64 }: { uri: string; width: number; height: number; box: DetectedProduct['box']; category: string; size?: number }) {
  if (!box || !width || !height || !uri) return <ProductImage uri={null} category={category} size={size} radius={14} />;
  const [y0, x0, y1, x1] = box.map((n) => n / 1000);
  const side = Math.max((x1 - x0) * width, (y1 - y0) * height) * 1.15;
  const scale = size / side;
  const cx = ((x0 + x1) / 2) * width;
  const cy = ((y0 + y1) / 2) * height;
  return (
    <View style={{ width: size, height: size, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.lac2 }}>
      <Image
        source={{ uri }}
        style={{ position: 'absolute', width: width * scale, height: height * scale, left: size / 2 - cx * scale, top: size / 2 - cy * scale }}
      />
    </View>
  );
}

function MultiPickSheet({
  scan,
  onClose,
  onOpen,
  onCompare,
}: {
  scan: MultiScan;
  onClose: () => void;
  onOpen: (p: DetectedProduct) => void;
  onCompare: (list: DetectedProduct[]) => void;
}) {
  const [picked, setPicked] = useState<number[]>([0]);
  const n = scan.products.length;

  const toggle = (i: number) => {
    hapticSelect();
    setPicked((cur) => {
      if (cur.includes(i)) return cur.length === 1 ? cur : cur.filter((x) => x !== i);
      return cur.length >= MAX_COMPARE ? cur : [...cur, i];
    });
  };

  const selected = picked.map((i) => scan.products[i]).filter(Boolean);
  const canCheck = selected.length === 1;
  const canCompare = selected.length >= 2;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={() => undefined}
          style={{ backgroundColor: colors.wine, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 18, paddingBottom: 28, maxHeight: '88%' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingHorizontal: 20 }}>
            {scan.photo ? <Image source={{ uri: scan.photo }} style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: colors.lac2 }} resizeMode="cover" /> : null}
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 21, letterSpacing: -0.4, color: colors.bone }}>We spotted {n} products</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.bone2 }}>
                Select one product to check it now, or select 2-{MAX_COMPARE} products to compare them side by side.
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <X size={20} color={colors.bone2} weight="bold" />
            </Pressable>
          </View>

          <View style={{ marginHorizontal: 20, marginTop: 12, backgroundColor: colors.hiSoft, borderRadius: 16, padding: 12, gap: 4 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.hiInk }}>How this works</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.hiInk, opacity: 0.82 }}>
              One selected item opens its product check. Multiple selected items open comparison, then we ask what matters to you before searching.
            </Text>
          </View>

          <ScrollView style={{ marginTop: 14 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }} showsVerticalScrollIndicator={false}>
            {scan.products.map((p, i) => {
              const on = picked.includes(i);
              const full = !on && picked.length >= MAX_COMPARE;
              return (
                <Pressable
                  key={`${p.label}-${i}`}
                  onPress={() => toggle(i)}
                  disabled={full}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: full }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 10,
                    borderRadius: 18,
                    backgroundColor: on ? colors.hiSoft : colors.lac,
                    borderWidth: 1.5,
                    borderColor: on ? colors.hi : 'transparent',
                    opacity: pressed || full ? 0.6 : 1,
                  })}
                >
                  <CropThumb uri={scan.photo} width={scan.width} height={scan.height} box={p.box} category={p.category} />
                  <View style={{ flex: 1, gap: 2 }}>
                    {p.brand ? <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, letterSpacing: 0.4, color: colors.hi, textTransform: 'uppercase' }}>{p.brand}</Text> : null}
                    <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 15.5, lineHeight: 20, color: colors.bone }}>
                      {p.name || p.label}
                    </Text>
                    {p.category ? <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone3 }}>{p.category}</Text> : null}
                  </View>
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: picked.length > 1 ? 8 : 13,
                      borderWidth: on ? 0 : 1.5,
                      borderColor: colors.bone3,
                      backgroundColor: on ? colors.hi : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {on ? <Check size={14} color={colors.white} weight="bold" /> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ paddingHorizontal: 20, paddingTop: 14, gap: 10 }}>
            <Pressable
              disabled={!canCheck}
              onPress={() => selected[0] && onOpen(selected[0])}
              style={({ pressed }) => ({
                height: 50,
                borderRadius: 16,
                flexDirection: 'row',
                gap: 8,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: canCheck ? colors.hi : colors.wineDeep,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <CaretRight size={18} color={colors.white} weight="bold" />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15.5, color: colors.white }}>
                {canCheck ? `Check ${selected[0]?.name || 'selected product'}` : 'Select one product to check'}
              </Text>
            </Pressable>
            <Pressable
              disabled={!canCompare}
              onPress={() => onCompare(selected)}
              style={({ pressed }) => ({
                height: 50,
                borderRadius: 16,
                flexDirection: 'row',
                gap: 8,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: canCompare ? colors.black : colors.lac,
                borderWidth: canCompare ? 0 : 1,
                borderColor: colors.line,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <ArrowsLeftRight size={18} color={canCompare ? colors.white : colors.bone3} weight="bold" />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15.5, color: canCompare ? colors.white : colors.bone3 }}>
                {canCompare ? `Compare ${selected.length} selected products` : `Select 2-${MAX_COMPARE} products to compare`}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const MAX_EDGE = 1280;

/**
 * Live browser camera (getUserMedia) with a shutter, for laptops and phones on the web.
 * Without `onFallback` there is no escape hatch to a file picker — used where only a live photo counts.
 */
export function WebCameraModal({
  onCapture,
  onClose,
  onFallback,
  title = 'Fit the product in the frame',
}: {
  onCapture: (asset: VisionAsset) => void;
  onClose: () => void;
  onFallback?: () => void;
  title?: string;
}) {
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
          <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
            <FocusCorners size={280} color="rgba(255,255,255,0.85)" />
          </View>
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
              {onFallback
                ? 'Allow camera access in your browser’s address bar, or use your device’s camera app instead.'
                : 'Allow camera access in your browser’s address bar, then try again. A live photo is needed here.'}
            </Text>
            {onFallback ? (
              <Pressable onPress={onFallback} style={{ height: 46, paddingHorizontal: 20, borderRadius: 14, backgroundColor: colors.hi, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.white }}>Open device camera</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={{ position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={onClose} accessibilityLabel="Close camera" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} color={colors.white} weight="bold" />
          </Pressable>
          <Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 15, color: colors.white }}>{title}</Text>
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
