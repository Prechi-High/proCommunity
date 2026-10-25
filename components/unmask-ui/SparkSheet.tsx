import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Lightning, Sparkle } from '@/components/icons';
import { COPY } from '@/constants/brand';
import { colors, fonts } from '@/constants/theme';
import { hapticSupportConfirmed, hapticError, hapticSelect } from '@/lib/haptics';
import * as api from '@/lib/investigations/api';
import { sparkNaira } from '@/lib/unmask/status';
import { useAppStore } from '@/lib/store';

import { ActionButton } from './ActionButton';
import { ActionSheet } from './ActionSheet';
import { SparkBurst } from './SparkBurst';
import { StatusMessage } from './StatusMessage';

function opKey() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16);
    return (c === 'x' ? n : (n & 3) | 8).toString(16);
  });
}

export function SparkSheet({
  open,
  onClose,
  investigationId,
}: {
  open: boolean;
  onClose: () => void;
  investigationId: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const uid = useAppStore((s) => s.profile?.id);
  const [kind, setKind] = useState<'sparks' | 'thunder'>('sparks');
  const [pending, setPending] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [receipt, setReceipt] = useState<api.Receipt | null>(null);
  const [error, setError] = useState('');
  const key = useRef(opKey());
  const wallet = useQuery({
    queryKey: ['spark-wallet', uid],
    queryFn: api.wallet,
    enabled: !!uid && open,
  });
  const naira = kind === 'sparks' ? 100 : 1000;
  const confirm = async () => {
    if (!uid) {
      onClose();
      router.push('/(auth)/sign-in' as Href);
      return;
    }
    setPending(true);
    setError('');
    setUnknown(false);
    try {
      const out = await api.contribute(investigationId, kind, kind === 'sparks' ? 10 : 1, false, key.current);
      setReceipt(out);
      hapticSupportConfirmed(key.current);
      void qc.invalidateQueries({ queryKey: ['investigation-support', investigationId] });
      void qc.invalidateQueries({ queryKey: ['spark-wallet', uid] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not add Sparks.';
      if (/timeout|network|fetch/i.test(msg)) {
        setUnknown(true);
      } else {
        hapticError();
        setError(msg);
        key.current = opKey();
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <ActionSheet open={open} title={COPY.sparkSheetTitle} onClose={onClose}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkSoft }}>
        {kind === 'sparks'
          ? COPY.sparkSheetDetail
          : `1 Thunder Spark · ₦1,000 = 100 Sparks of support weight. ${COPY.sparkTeach}`}
      </Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {(
          [
            { id: 'sparks' as const, label: '10 Sparks', money: '₦100', Icon: Sparkle },
            { id: 'thunder' as const, label: 'Thunder', money: '₦1,000', Icon: Lightning },
          ] as const
        ).map((opt) => {
          const on = kind === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => {
                hapticSelect();
                setKind(opt.id);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={{
                flex: 1,
                borderRadius: 18,
                padding: 16,
                gap: 8,
                backgroundColor: on ? (opt.id === 'thunder' ? colors.goldSoft : colors.brandDeep) : colors.mist,
              }}
            >
              <opt.Icon size={22} color={on && opt.id !== 'thunder' ? colors.white : colors.brandDeep} weight="fill" />
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 16,
                  color: on && opt.id !== 'thunder' ? colors.white : colors.ink,
                }}
              >
                {opt.label}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 13,
                  color: on && opt.id !== 'thunder' ? 'rgba(255,255,255,0.8)' : colors.inkSoft,
                }}
              >
                {opt.money}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.inkSoft }}>
        This action: {kind === 'sparks' ? '10 Sparks' : '1 Thunder Spark'} · {sparkNaira(kind === 'sparks' ? 10 : 100)}.
        {wallet.data
          ? ` Your balance: ${wallet.data.sparks} Sparks · ${wallet.data.thunder} Thunder.`
          : uid
            ? ''
            : ' Sign in to support.'}
      </Text>
      {receipt ? (
        <>
          <SparkBurst show thunder={kind === 'thunder'} />
          <StatusMessage
            kind="success"
            title={COPY.supportConfirm(kind === 'sparks' ? 10 : 100)}
            detail={`You’re in control of this. Combined support is now ${receipt.summary.sparks + receipt.summary.thunder * 100} Sparks.`}
          />
        </>
      ) : unknown ? (
        <StatusMessage kind="pending" title={COPY.checkingSupport} detail="Don’t pay again yet. Refresh the Unmask to see the latest status." />
      ) : error ? (
        <StatusMessage kind="error" title={COPY.supportFailed} detail={error} />
      ) : null}
      {!receipt ? (
        <ActionButton
          tone={kind === 'thunder' ? 'gold' : 'primary'}
          label={kind === 'sparks' ? `Add 10 Sparks · ₦${naira}` : `Add Thunder · ₦${naira}`}
          pending={pending}
          onPress={() => void confirm()}
          explanation={pending ? 'Adding Sparks' : undefined}
        />
      ) : (
        <ActionButton label="Done" tone="secondary" onPress={onClose} />
      )}
    </ActionSheet>
  );
}
