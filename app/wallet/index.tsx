import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';

import { ActionButton, AppShell, EmptyState, StatusMessage } from '@/components/unmask-ui';
import { COPY } from '@/constants/brand';
import { colors, fonts } from '@/constants/theme';
import { wallet } from '@/lib/investigations/api';
import { history } from '@/lib/utilities/api';
import { sparkNaira } from '@/lib/unmask/status';
import { useAppStore } from '@/lib/store';

export default function Wallet() {
  const router = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const q = useQuery({
    queryKey: ['spark-wallet', uid],
    queryFn: wallet,
    enabled: !!uid,
  });
  const h = useQuery({
    queryKey: ['spark-history', uid],
    queryFn: history,
    enabled: !!uid,
  });

  return (
    <AppShell back title="Sparks" subtitle={COPY.sparkTeach}>
      {!uid ? (
        <>
          <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.inkSoft }}>
            Sign in to add Sparks. You’re not buying a verdict. You’re saying this cannot die here.
          </Text>
          <ActionButton label="Sign in" onPress={() => router.push('/(auth)/sign-in' as Href)} />
        </>
      ) : (
        <>
          {q.isError ? <StatusMessage kind="error" title="Couldn’t load your Sparks." /> : null}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {[
              { label: 'Sparks', value: q.data?.sparks ?? 0, hint: sparkNaira(q.data?.sparks ?? 0) },
              { label: 'Thunder', value: q.data?.thunder ?? 0, hint: '1 Thunder = 100 Sparks' },
            ].map((row) => (
              <View
                key={row.label}
                style={{
                  flex: 1,
                  backgroundColor: row.label === 'Thunder' ? colors.goldSoft : colors.hiSoft,
                  borderRadius: 18,
                  padding: 16,
                  gap: 6,
                }}
              >
                <Text style={{ fontFamily: fonts.serifBold, fontSize: 28, lineHeight: 32, color: colors.ink }}>
                  {row.value}
                </Text>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>{row.label}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft }}>{row.hint}</Text>
              </View>
            ))}
          </View>
          <ActionButton tone="gold" label="Add Sparks" onPress={() => router.push('/wallet/recharge' as Href)} />
        </>
      )}
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 0.5, color: colors.inkSoft }}>RECENT</Text>
      {uid && (h.data ?? []).length ? (
        (h.data ?? []).slice(0, 5).map((e) => (
          <View key={e.id} style={{ gap: 4, paddingVertical: 8 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>
              {e.unmask_investigations?.title || 'Ultra Unmask'}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft }}>
              −{e.amount} {e.kind === 'sparks' ? 'Sparks' : 'Thunder'} · you pushed this
            </Text>
            <ActionButton
              tone="ghost"
              label="See it"
              onPress={() => router.push(`/investigation/${e.investigation_id}` as Href)}
            />
          </View>
        ))
      ) : uid ? (
        <EmptyState title="No Sparks added yet." detail="When a story needs why, this is how you take it further." />
      ) : null}
      <ActionButton tone="ghost" label="All contributions" onPress={() => router.push('/wallet/history' as Href)} />
    </AppShell>
  );
}
