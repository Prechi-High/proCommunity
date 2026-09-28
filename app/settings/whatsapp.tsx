import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CheckCircle, Files, WhatsappLogo } from '@/components/icons';
import { Eyebrow, Group, PrimaryButton, Shimmer } from '@/components/kit';
import { TopBar } from '@/components/research';
import { colors, fonts } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { whatsapp, type NotificationPreferences } from '@/lib/research';
import { useAppStore } from '@/lib/store';

const PREFS: Array<{ key: Exclude<keyof NotificationPreferences, 'product_drops'>; label: string; detail: string }> = [
  { key: 'research_updates', label: 'Research updates', detail: 'When a Research Card finishes or gets new information.' },
  { key: 'price_alerts', label: 'Price alerts', detail: 'When a product you researched changes price.' },
  { key: 'community_replies', label: 'Community replies', detail: 'Replies in discussions you follow.' },
  { key: 'refill_reminders', label: 'Refill reminders', detail: 'A nudge before you run out of something you use.' },
];

function PrefRow({ label, detail, value, onChange, last }: { label: string; detail: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.line }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.bone }}>{label}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.bone3 }}>{detail}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          hapticSelect();
          onChange(v);
        }}
        trackColor={{ true: colors.hi, false: colors.wineDeep }}
      />
    </View>
  );
}

export default function WhatsAppSettingsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const profile = useAppStore((s) => s.profile);
  const [link, setLink] = useState<{ code: string; waLink: string | null; expiresAt: string } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ['whatsapp', 'status'],
    queryFn: whatsapp.status,
    enabled: Boolean(profile),
    refetchInterval: (q) => (link && !q.state.data?.connected ? 4000 : false),
  });
  const connected = status.data?.connected ?? false;

  useEffect(() => {
    if (connected && link) {
      hapticSuccess();
      track('whatsapp_connected', {});
      setLink(null);
    }
  }, [connected, link]);

  useEffect(() => {
    if (!link) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((new Date(link.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [link]);

  const start = useMutation({
    mutationFn: whatsapp.link,
    onSuccess: (out) => {
      setError(null);
      setLink(out);
      track('whatsapp_connection_started', {});
      if (out.waLink) void Linking.openURL(out.waLink);
    },
    onError: (e) => setError(e instanceof Error && e.message === 'rate_limited' ? 'Too many attempts. Wait a few minutes and try again.' : 'WhatsApp isn’t available right now. Try again later.'),
  });
  const disconnect = useMutation({
    mutationFn: whatsapp.disconnect,
    onSuccess: () => {
      track('whatsapp_disconnected', { source: 'app' });
      void qc.invalidateQueries({ queryKey: ['whatsapp', 'status'] });
    },
  });
  const setPrefs = useMutation({
    mutationFn: whatsapp.setPreferences,
    onMutate: async (patch) => {
      const prev = qc.getQueryData(['whatsapp', 'status']);
      qc.setQueryData(['whatsapp', 'status'], (old: typeof status.data) => (old ? { ...old, preferences: { ...old.preferences, ...patch } } : old));
      return { prev };
    },
    onError: (_e, _p, ctx) => qc.setQueryData(['whatsapp', 'status'], ctx?.prev),
  });

  const prefs = status.data?.preferences;
  const expired = link && secondsLeft === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.wine }} edges={['top', 'bottom']}>
      <TopBar title="WhatsApp" fallback="/you" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48, gap: 18 }}>
        <View style={{ alignItems: 'center', gap: 10, paddingTop: 8 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.sageSoft, alignItems: 'center', justifyContent: 'center' }}>
            <WhatsappLogo size={34} color={colors.sage} weight="fill" />
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 24, letterSpacing: -0.6, color: colors.bone, textAlign: 'center' }}>Sourced on WhatsApp</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.bone2, textAlign: 'center' }}>
            Send a product photo or name and get a Research Card back — saved to your account, same as in the app.
          </Text>
        </View>

        {!profile ? (
          <PrimaryButton label="Sign in to connect" onPress={() => router.push('/(auth)/sign-in')} />
        ) : status.isLoading ? (
          <Shimmer height={120} radius={20} />
        ) : status.data && !status.data.enabled ? (
          <Group style={{ padding: 16 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 21, color: colors.bone2 }}>WhatsApp is coming soon. We’ll let you know when you can connect.</Text>
          </Group>
        ) : connected ? (
          <>
            <Group style={{ paddingVertical: 14, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={20} color={colors.sage} weight="fill" />
                <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>Connected</Text>
              </View>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.bone3 }}>
                {status.data?.phone ?? 'Your number'}
                {status.data?.connectedAt ? ` · since ${new Date(status.data.connectedAt).toLocaleDateString()}` : ''}
              </Text>
            </Group>

            {prefs ? (
              <View style={{ gap: 8 }}>
                <Eyebrow>WhatsApp notifications</Eyebrow>
                <Group>
                  {PREFS.map((p, i) => (
                    <PrefRow key={p.key} label={p.label} detail={p.detail} value={prefs[p.key]} onChange={(v) => setPrefs.mutate({ [p.key]: v })} last={i === PREFS.length - 1} />
                  ))}
                </Group>
              </View>
            ) : null}

            {prefs ? (
              <View style={{ gap: 8 }}>
                <Eyebrow>Optional</Eyebrow>
                <Group>
                  <PrefRow
                    label="Product drops"
                    detail="New launches from brands you research. Off unless you turn it on — you can stop any time."
                    value={prefs.product_drops}
                    onChange={(v) => setPrefs.mutate({ product_drops: v })}
                    last
                  />
                </Group>
              </View>
            ) : null}

            <Pressable onPress={() => router.push('/research' as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center' }}>
              <Files size={16} color={colors.hi} weight="bold" />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.hi }}>View my Research Cards</Text>
            </Pressable>

            <PrimaryButton label={disconnect.isPending ? 'Disconnecting…' : 'Disconnect WhatsApp'} tone="plain" onPress={() => disconnect.mutate()} />
            <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.bone3, textAlign: 'center' }}>
              Disconnecting stops WhatsApp access immediately. Your Research Cards stay in your account.
            </Text>
          </>
        ) : link && !expired ? (
          <Group style={{ padding: 16, gap: 12 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>Send this message on WhatsApp</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone2 }}>
              {link.waLink ? 'WhatsApp should open with the message ready — just tap send.' : 'Send this exact message to the Sourced WhatsApp number.'}
            </Text>
            <View style={{ backgroundColor: colors.wine, borderRadius: 12, padding: 12 }}>
              <Text selectable style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13.5, color: colors.bone }}>
                {link.code}
              </Text>
            </View>
            {link.waLink ? <PrimaryButton label="Open WhatsApp" onPress={() => void Linking.openURL(link.waLink!)} /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <ActivityIndicator size="small" color={colors.hi} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.bone3 }}>
                Waiting for your message · expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
              </Text>
            </View>
          </Group>
        ) : (
          <>
            <Group style={{ padding: 16, gap: 10 }}>
              {['Tap Connect — WhatsApp opens with a one-time code', 'Send the message to Sourced', 'Send product photos or names any time'].map((t, i) => (
                <View key={t} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.hiSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.hiInk }}>{i + 1}</Text>
                  </View>
                  <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14.5, color: colors.bone }}>{t}</Text>
                </View>
              ))}
            </Group>
            {expired ? <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.honeyInk, textAlign: 'center' }}>That code expired. Get a new one below.</Text> : null}
            <PrimaryButton label={start.isPending ? 'Preparing…' : 'Connect WhatsApp'} disabled={start.isPending} onPress={() => start.mutate()} />
            <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.bone3, textAlign: 'center' }}>
              We never ask for your password in WhatsApp. The code works once and expires in about 12 minutes.
            </Text>
          </>
        )}
        {error ? <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.coral, textAlign: 'center' }}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
