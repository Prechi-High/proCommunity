import * as ImagePicker from 'expo-image-picker';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, Text, View } from 'react-native';

import { useMemberGate } from '@/components/community';
import { Camera, Lock, SealCheck, Warning, X } from '@/components/icons';
import { PrimaryButton, ProductImage } from '@/components/kit';
import { colors, fonts } from '@/constants/theme';
import { hapticHeavy, hapticSuccess } from '@/lib/haptics';
import { useRefreshOwnership, verifyOwnership, type VerifyOutcome } from '@/lib/owners';
import type { VisionAsset } from '@/lib/productVision';
import type { Product } from '@/lib/types';
import { WebCameraModal } from '@/lib/useScan';

type Step =
  | { kind: 'intro' }
  | { kind: 'camera' }
  | { kind: 'checking'; photo: string }
  | { kind: 'done'; outcome: VerifyOutcome; photo: string }
  | { kind: 'error'; message: string };

function hasWebCamera(): boolean {
  return Platform.OS === 'web' && typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

/**
 * "I own this" → live in-app photo → checked against the product. Gallery uploads are never offered,
 * so a downloaded picture can't be used; the server also rejects screens, prints and stock images.
 */
export function useVerifyOwner() {
  const [product, setProduct] = useState<Product | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'intro' });
  const { requireMember, gate } = useMemberGate();
  const refresh = useRefreshOwnership();

  const start = (p: Product) =>
    requireMember(() => {
      setProduct(p);
      setStep({ kind: 'intro' });
    });

  const close = () => {
    setProduct(null);
    setStep({ kind: 'intro' });
  };

  const check = async (asset: VisionAsset) => {
    if (!product) return;
    setStep({ kind: 'checking', photo: asset.uri });
    try {
      const outcome = await verifyOwnership(asset, product);
      if (outcome.status === 'verified') {
        hapticSuccess();
        refresh();
      } else hapticHeavy();
      setStep({ kind: 'done', outcome, photo: asset.uri });
    } catch (err) {
      hapticHeavy();
      setStep({ kind: 'error', message: err instanceof Error ? err.message : 'Verification didn’t finish. Try again.' });
    }
  };

  const openCamera = async () => {
    if (Platform.OS === 'web') {
      if (hasWebCamera()) setStep({ kind: 'camera' });
      else setStep({ kind: 'error', message: 'This browser can’t open a live camera. Open Sourced on your phone to verify.' });
      return;
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setStep({ kind: 'error', message: 'Allow camera access so you can take the verification photo.' });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.6, base64: true, exif: false });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset?.uri) return;
    void check({ uri: asset.uri, width: asset.width, height: asset.height, base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg', fileName: asset.fileName });
  };

  const sheet: ReactNode = (
    <>
      {gate}
      {product && step.kind === 'camera' ? (
        <WebCameraModal title={`Take a photo of your ${product.name}`} onClose={() => setStep({ kind: 'intro' })} onCapture={(asset) => void check(asset)} />
      ) : null}
      <Modal visible={Boolean(product) && step.kind !== 'camera'} transparent animationType="fade" onRequestClose={close}>
        <Pressable onPress={step.kind === 'checking' ? undefined : close} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <Pressable
            onPress={() => undefined}
            style={{ backgroundColor: colors.wine, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 30, gap: 16, width: '100%', maxWidth: 560, alignSelf: 'center' }}
          >
            {product ? <Body product={product} step={step} onCamera={() => void openCamera()} onClose={close} /> : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );

  return { start, sheet };
}

function Body({ product, step, onCamera, onClose }: { product: Product; step: Step; onCamera: () => void; onClose: () => void }) {
  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <ProductImage uri={product.heroImageUrl ?? null} category={product.category} size={48} radius={14} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.bone3 }}>Verify ownership</Text>
        <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>{product.name}</Text>
      </View>
      {step.kind !== 'checking' ? (
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
          <X size={20} color={colors.bone2} weight="bold" />
        </Pressable>
      ) : null}
    </View>
  );

  if (step.kind === 'intro') {
    return (
      <>
        {header}
        <View style={{ gap: 4 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.5, color: colors.bone }}>Show us yours</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.bone2 }}>
            Take one photo of your own {product.name}. Once it checks out, your answers about it carry a Verified owner mark.
          </Text>
        </View>
        <View style={{ gap: 10 }}>
          <Rule icon={<Camera size={17} color={colors.hi} weight="bold" />} text="Live photo from the in-app camera. Uploads aren’t accepted." />
          <Rule icon={<SealCheck size={17} color={colors.hi} weight="bold" />} text="Show the actual item. Screens, prints and product pictures won’t pass." />
          <Rule icon={<Lock size={17} color={colors.hi} weight="bold" />} text="Your photo stays private. People only see that you own it." />
        </View>
        <PrimaryButton label="Open camera" icon={Camera} onPress={onCamera} />
      </>
    );
  }

  if (step.kind === 'checking') {
    return (
      <>
        {header}
        <View style={{ alignItems: 'center', gap: 14, paddingVertical: 10 }}>
          <Image source={{ uri: step.photo }} style={{ width: 150, height: 150, borderRadius: 20, backgroundColor: colors.lac2 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ActivityIndicator color={colors.hi} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.bone }}>Checking your photo…</Text>
          </View>
        </View>
      </>
    );
  }

  if (step.kind === 'error') {
    return (
      <>
        {header}
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Warning size={20} color={colors.coral} weight="bold" />
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.bone }}>{step.message}</Text>
        </View>
        <PrimaryButton label="Try again" icon={Camera} onPress={onCamera} />
      </>
    );
  }

  if (step.kind !== 'done') return null;
  const { outcome } = step;
  if (outcome.status === 'verified') {
    return (
      <>
        {header}
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 6 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.sageSoft, alignItems: 'center', justifyContent: 'center' }}>
            <SealCheck size={34} color={colors.sage} weight="fill" />
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 21, letterSpacing: -0.4, color: colors.bone, textAlign: 'center' }}>You’re a verified owner</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.bone2, textAlign: 'center' }}>
            Your answers about the {product.name} now show it, and it’s listed on your profile.
          </Text>
        </View>
        <PrimaryButton label="Done" onPress={onClose} />
      </>
    );
  }

  return (
    <>
      {header}
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Image source={{ uri: step.photo }} style={{ width: 72, height: 72, borderRadius: 14, backgroundColor: colors.lac2 }} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>That one didn’t pass</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone2 }}>{outcome.reason}</Text>
        </View>
      </View>
      {outcome.tip ? <Text style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.hiInk }}>{outcome.tip}</Text> : null}
      {outcome.attemptsLeft > 0 ? (
        <PrimaryButton label="Retake photo" icon={Camera} onPress={onCamera} />
      ) : (
        <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.bone3 }}>You’ve used today’s tries for this product. Try again tomorrow.</Text>
      )}
    </>
  );
}

function Rule({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.hiSoft, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.bone }}>{text}</Text>
    </View>
  );
}
