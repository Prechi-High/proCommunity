import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { Screen } from '@/components/Screen';
import { X } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';
import { routeId } from '@/lib/catalog';
import {
  loadProductCase,
  renderMarkedText,
  type MarkedFrag,
} from '@/lib/productCase';
import { hapticPeel, hapticSourceDone, hapticTap } from '@/lib/haptics';
import { useAppStore } from '@/lib/store';
import { useProduct } from '@/lib/useProduct';

const STAGES = [
  'Opening the case.',
  'Reading YouTube comments.',
  'Reading the Reddit threads brands never see.',
  'Checking the ingredient list.',
  'Sorting praise from complaints.',
] as const;

/**
 * Investigation probe — HTML process with LLM/heuristic case evidence.
 * Quote lines are real comment fragments; black seals peel L/R; marks fill yellow.
 */
export default function ProbeScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = routeId(rawId);
  const router = useRouter();
  const userPosts = useAppStore((s) => s.userPosts);
  const { data: product } = useProduct(id);

  const caseQuery = useQuery({
    queryKey: ['product-case', product?.id],
    queryFn: () => loadProductCase(product!, userPosts),
    enabled: Boolean(product),
    staleTime: 30 * 60 * 1000,
  });

  const analysis = caseQuery.data;
  const [stage, setStage] = useState('');
  const [showSkip, setShowSkip] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [counts, setCounts] = useState({ yt: 0, rd: 0, ig: 0 });
  const [lifted, setLifted] = useState<number[]>([]);
  const runId = useRef(0);
  const cancelled = useRef(false);

  const frags: MarkedFrag[] = useMemo(() => {
    if (analysis?.frags?.length) return analysis.frags.slice(0, 6);
    return [];
  }, [analysis]);

  const targets = {
    yt: Math.max(analysis?.counts.yt ?? 0, 1),
    rd: Math.max(analysis?.counts.rd ?? 0, 0),
    ig: Math.max(analysis?.counts.ig ?? product?.ingredients.length ?? 0, 1),
  };

  const finish = () => {
    cancelled.current = true;
    router.replace(`/product/${id}`);
  };

  useEffect(() => {
    if (!product || !analysis) return;
    cancelled.current = false;
    const myRun = ++runId.current;
    const alive = () => myRun === runId.current && !cancelled.current;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    const countTo = async (key: 'yt' | 'rd' | 'ig', target: number, ms: number) => {
      if (target <= 0) {
        setDone((d) => ({ ...d, [key]: true }));
        hapticSourceDone();
        return;
      }
      const start = Date.now();
      return new Promise<void>((resolve) => {
        const tick = () => {
          if (!alive()) return resolve();
          const k = Math.min(1, (Date.now() - start) / ms);
          const eased = 1 - Math.pow(1 - k, 3);
          setCounts((c) => ({ ...c, [key]: Math.round(target * eased) }));
          if (k < 1) requestAnimationFrame(tick);
          else {
            setDone((d) => ({ ...d, [key]: true }));
            hapticSourceDone();
            resolve();
          }
        };
        tick();
      });
    };

    (async () => {
      setDone({});
      setCounts({ yt: 0, rd: 0, ig: 0 });
      setLifted([]);
      setShowSkip(false);
      setTimeout(() => {
        if (alive()) setShowSkip(true);
      }, 2600);

      await wait(450);
      if (!alive()) return;
      setStage(STAGES[0]);
      await wait(700);
      if (!alive()) return;

      setStage(STAGES[1]);
      await Promise.all([
        countTo('yt', targets.yt, analysis.tooFew ? 900 : 1600),
        (async () => {
          await wait(400);
          if (alive()) setLifted((l) => [...l, 0]);
          await wait(550);
          if (alive()) setLifted((l) => [...l, 1]);
        })(),
      ]);
      if (!alive()) return;

      setStage(STAGES[2]);
      await Promise.all([
        countTo('rd', Math.max(targets.rd, analysis.tooFew ? 0 : 0), analysis.tooFew ? 700 : 1200),
        (async () => {
          await wait(350);
          if (alive()) setLifted((l) => [...l, 2]);
          await wait(500);
          if (alive()) setLifted((l) => [...l, 3]);
        })(),
      ]);
      if (!alive()) return;

      setStage(STAGES[3]);
      await Promise.all([
        countTo('ig', targets.ig, 900),
        (async () => {
          await wait(400);
          if (alive()) setLifted((l) => [...l, 4]);
        })(),
      ]);
      if (!alive()) return;

      setStage(STAGES[4]);
      await wait(500);
      if (alive()) setLifted((l) => [...l, 5]);
      await wait(650);
      if (!alive()) return;

      const total = (analysis.counts.yt ?? 0) + (analysis.counts.own ?? 0);
      setStage(
        analysis.tooFew
          ? `${total} comments read. That’s not enough for a score.`
          : `${Math.max(total, targets.yt).toLocaleString()} comments read. Here’s what they say.`,
      );
      await wait(1100);
      if (!alive()) return;
      finish();
    })();

    return () => {
      cancelled.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, analysis?.analyzedAt]);

  if (!product || caseQuery.isLoading) {
    return (
      <Screen>
        <Text style={{ fontFamily: fonts.serif, fontSize: 22, color: colors.bone, marginTop: 40 }}>
          Gathering what people said…
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone3, marginTop: 10 }}>
          Reading YouTube comments and owner reports for this product.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} padded={false}>
      <View style={{ flex: 1, paddingTop: 12 }}>
        <View style={{ paddingHorizontal: 14 }}>
          <Pressable
            onPress={() => {
              cancelled.current = true;
              router.back();
            }}
            style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
            accessibilityLabel="Cancel"
          >
            <X size={22} color={colors.bone} weight="bold" />
          </Pressable>
        </View>

        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 4 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone3, marginBottom: 6 }}>
            Opening the case on
          </Text>
          <Text
            style={{
              fontFamily: fonts.serif,
              fontWeight: '500',
              fontSize: 26,
              lineHeight: 29,
              letterSpacing: -0.5,
              color: colors.bone,
            }}
          >
            {product.name}
          </Text>

          <View
            style={{
              marginTop: 18,
              backgroundColor: colors.lac,
              borderRadius: 20,
              paddingVertical: 12,
              paddingHorizontal: 18,
            }}
          >
            {(frags.length ? frags : placeholderFrags(product.name)).map((frag, i) => (
              <QuoteLine
                key={`${frag.text}-${i}`}
                frag={frag}
                lifted={lifted.includes(i)}
                fromRight={i % 2 === 1}
              />
            ))}
          </View>

          <Text
            style={{
              marginTop: 22,
              fontFamily: fonts.serif,
              fontWeight: '500',
              fontSize: 30,
              lineHeight: 32,
              letterSpacing: -0.5,
              color: colors.bone,
              minHeight: 66,
            }}
          >
            {stage || (caseQuery.isFetching ? 'Gathering evidence…' : '')}
          </Text>

          <View style={{ marginTop: 'auto', paddingBottom: 12 }}>
            <SourceRow
              label="YouTube comments"
              value={counts.yt}
              unit="comments"
              done={done.yt}
              progress={targets.yt ? counts.yt / targets.yt : 0}
            />
            <SourceRow
              label="Reddit threads"
              value={counts.rd}
              unit="comments"
              done={done.rd || targets.rd === 0}
              progress={targets.rd ? counts.rd / targets.rd : done.rd ? 1 : 0}
              note={targets.rd === 0 ? 'Coming soon' : undefined}
            />
            <SourceRow
              label="Ingredient list"
              value={counts.ig}
              unit="ingredients"
              done={done.ig}
              progress={targets.ig ? counts.ig / targets.ig : 0}
            />
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 24,
            paddingBottom: 18,
            minHeight: 56,
          }}
        >
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone3 }}>
            Nothing paid for. Nothing removed.
          </Text>
          {showSkip ? (
            <Pressable
              onPress={() => {
                hapticTap();
                finish();
              }}
              hitSlop={8}
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone2 }}>Skip</Text>
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>
      </View>
    </Screen>
  );
}

function placeholderFrags(name: string): MarkedFrag[] {
  return [
    { text: `Looking for lived comments on ${name}`, mark: name, source: 'yt' },
    { text: 'Pulling YouTube comment threads', mark: 'YouTube comment', source: 'yt' },
    { text: 'Checking Verified Owner traces on Sourced', mark: 'Verified Owner', source: 'own' },
  ];
}

function QuoteLine({
  frag,
  lifted,
  fromRight,
}: {
  frag: MarkedFrag;
  lifted: boolean;
  fromRight: boolean;
}) {
  const anim = useRef(new Animated.Value(1)).current;
  const didPeel = useRef(false);
  useEffect(() => {
    if (lifted && !didPeel.current) {
      didPeel.current = true;
      hapticPeel();
    }
    Animated.timing(anim, {
      toValue: lifted ? 0 : 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [lifted, anim]);

  const parts = renderMarkedText(frag.text, [frag.mark]);

  return (
    <View style={{ paddingVertical: 7, overflow: 'hidden' }}>
      <Text style={{ fontFamily: fonts.serif, fontSize: 17, lineHeight: 21, color: colors.bone }}>
        “…
        {parts.map((part, i) =>
          part.marked && lifted ? (
            <Text
              key={i}
              style={{
                backgroundColor: colors.hi,
                color: colors.wine,
                borderRadius: 3,
              }}
            >
              {part.text}
            </Text>
          ) : (
            <Text key={i}>{part.text}</Text>
          ),
        )}
        …”
      </Text>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 4,
          bottom: 4,
          backgroundColor: colors.redact,
          borderRadius: 2,
          transform: [{ scaleX: anim }],
          ...(Platform.OS === 'web'
            ? ({ transformOrigin: fromRight ? '100% 50%' : '0% 50%' } as object)
            : null),
        }}
      />
    </View>
  );
}

function SourceRow({
  label,
  value,
  unit,
  done,
  progress,
  note,
}: {
  label: string;
  value: number;
  unit: string;
  done?: boolean;
  progress: number;
  note?: string;
}) {
  return (
    <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 15,
            color: done ? colors.bone : colors.bone3,
            flex: 1,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontFamily: fonts.medium,
            fontSize: 15,
            color: done ? colors.sage : colors.bone3,
            fontVariant: ['tabular-nums'],
          }}
        >
          {note && done && value === 0
            ? note
            : done
              ? `${value.toLocaleString()} ${unit} ✓`
              : value.toLocaleString()}
        </Text>
      </View>
      <View style={{ height: 2, backgroundColor: colors.line, borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
        <View
          style={{
            height: 2,
            width: `${Math.min(100, Math.max(0, progress * 100))}%`,
            backgroundColor: done ? colors.sage : colors.bone,
          }}
        />
      </View>
    </View>
  );
}
