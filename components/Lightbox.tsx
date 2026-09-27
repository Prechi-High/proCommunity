import { useEffect, useRef, useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArrowLeft, ArrowRight, X } from '@/components/icons';
import { fonts } from '@/constants/theme';
import { hapticSelect } from '@/lib/haptics';

export interface LightboxImage {
  url: string;
  caption?: string;
  source?: string;
}

/** Full-screen, swipeable image viewer. Arrow keys and buttons on web, swipe everywhere. */
export function Lightbox({ images, index, onClose }: { images: LightboxImage[]; index: number | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  const [current, setCurrent] = useState(index ?? 0);
  const open = index !== null && images.length > 0;

  useEffect(() => {
    if (index === null) return;
    setCurrent(index);
    const t = setTimeout(() => scroller.current?.scrollTo({ x: index * width, animated: false }), 0);
    return () => clearTimeout(t);
  }, [index, width]);

  const go = (i: number) => {
    const next = Math.max(0, Math.min(images.length - 1, i));
    if (next === current) return;
    hapticSelect();
    setCurrent(next);
    scroller.current?.scrollTo({ x: next * width, animated: true });
  };

  useEffect(() => {
    if (!open || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(current + 1);
      if (e.key === 'ArrowLeft') go(current - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const item = images[current];

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' }}>
        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
          onScroll={Platform.OS === 'web' ? (e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width)) : undefined}
          scrollEventThrottle={64}
          style={{ flex: 1 }}
        >
          {images.map((img, i) => (
            <Pressable key={`${img.url}-${i}`} onPress={onClose} style={{ width, height, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
              <Image source={{ uri: img.url }} style={{ width: width - 32, height: height * 0.72 }} resizeMode="contain" />
            </Pressable>
          ))}
        </ScrollView>

        <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0 }} pointerEvents="box-none">
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, gap: 12 }}>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Close image"
              hitSlop={10}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={18} color="#fff" weight="bold" />
            </Pressable>
            <View style={{ flex: 1 }} />
            {images.length > 1 ? (
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
                {current + 1} / {images.length}
              </Text>
            ) : null}
          </View>
        </SafeAreaView>

        {images.length > 1 && width > 600 ? (
          <>
            <NavButton side="left" disabled={current === 0} onPress={() => go(current - 1)} />
            <NavButton side="right" disabled={current === images.length - 1} onPress={() => go(current + 1)} />
          </>
        ) : null}

        {item?.caption || item?.source ? (
          <SafeAreaView edges={['bottom']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} pointerEvents="none">
            <View style={{ paddingHorizontal: 20, paddingBottom: 18, gap: 3, alignItems: 'center' }}>
              {item.caption ? (
                <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 15, color: '#fff', textAlign: 'center' }}>
                  {item.caption}
                </Text>
              ) : null}
              {item.source ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.6)' }}>{item.source}</Text> : null}
            </View>
          </SafeAreaView>
        ) : null}

        {images.length > 1 ? (
          <View pointerEvents="none" style={{ position: 'absolute', bottom: item?.caption ? 70 : 28, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            {images.slice(0, 14).map((_, i) => (
              <View key={i} style={{ width: i === current ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === current ? '#fff' : 'rgba(255,255,255,0.35)' }} />
            ))}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function NavButton({ side, disabled, onPress }: { side: 'left' | 'right'; disabled: boolean; onPress: () => void }) {
  const Icon = side === 'left' ? ArrowLeft : ArrowRight;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={side === 'left' ? 'Previous image' : 'Next image'}
      style={{
        position: 'absolute',
        top: '50%',
        [side]: 20,
        marginTop: -24,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.14)',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.25 : 1,
      }}
    >
      <Icon size={20} color="#fff" weight="bold" />
    </Pressable>
  );
}
