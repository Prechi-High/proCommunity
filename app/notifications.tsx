import { useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, useMemberGate } from '@/components/community';
import { ArrowLeft, BellRinging, SealCheck } from '@/components/icons';
import { Shimmer } from '@/components/kit';
import { useNotifications } from '@/components/social';
import { colors, fonts } from '@/constants/theme';
import { markNotificationsRead, timeAgo } from '@/lib/community';
import { useAppStore } from '@/lib/store';

export default function NotificationsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const profile = useAppStore((s) => s.profile);
  const { requireMember, gate } = useMemberGate();
  const n = useNotifications();
  const list = n.data?.notifications ?? [];
  const unread = n.data?.unread ?? 0;

  useEffect(() => {
    if (!unread) return;
    const t = setTimeout(() => {
      void markNotificationsRead().then(() => qc.invalidateQueries({ queryKey: ['notifications'] }));
    }, 1500);
    return () => clearTimeout(t);
  }, [unread, qc]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.wine }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 10 }}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/pulse' as Href))}
          accessibilityLabel="Back"
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.lac, alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={18} color={colors.bone} weight="bold" />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>Updates</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10 }}>
        {!profile ? (
          <View style={{ backgroundColor: colors.lac, borderRadius: 20, padding: 20, gap: 10, alignItems: 'flex-start' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.bone }}>Follow the conversations you care about</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.bone2 }}>
              Join, then tap the bell on any post — you’ll see every new reply here.
            </Text>
            <Pressable onPress={() => requireMember(() => undefined)} style={{ height: 42, paddingHorizontal: 18, borderRadius: 21, backgroundColor: colors.hi, justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.white }}>Join the community</Text>
            </Pressable>
          </View>
        ) : n.isLoading ? (
          [0, 1, 2, 3].map((i) => <Shimmer key={i} height={76} radius={18} />)
        ) : list.length ? (
          list.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => router.push({ pathname: '/thread/[id]', params: { id: item.thread_id } } as Href)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                gap: 12,
                backgroundColor: item.read ? colors.lac : colors.hiSoft,
                borderRadius: 18,
                padding: 14,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Avatar name={item.actor_name} size={40} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 20, color: colors.bone }}>
                  <Text style={{ fontFamily: fonts.semibold }}>{item.actor_name}</Text>
                  {item.kind === 'owner_reply' ? ' (verified owner) replied to ' : ' replied to '}
                  <Text style={{ fontFamily: fonts.semibold }}>“{item.thread_title}”</Text>
                </Text>
                {item.snippet ? (
                  <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.bone2 }}>
                    {item.snippet}
                  </Text>
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {item.kind === 'owner_reply' ? <SealCheck size={12} color={colors.hi} weight="fill" /> : null}
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>
                    {item.product_name ? `${item.product_name} · ` : ''}
                    {timeAgo(item.created_at)}
                  </Text>
                </View>
              </View>
              {!item.read ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.hi, marginTop: 6 }} /> : null}
            </Pressable>
          ))
        ) : (
          <View style={{ alignItems: 'center', gap: 10, paddingTop: 60, paddingHorizontal: 20 }}>
            <BellRinging size={36} color={colors.bone3} weight="regular" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.bone, textAlign: 'center' }}>You’re all caught up</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.bone2, textAlign: 'center' }}>
              Tap the bell on a post to get updates when people reply. Posts you write or reply to are followed automatically.
            </Text>
          </View>
        )}
      </ScrollView>
      {gate}
    </SafeAreaView>
  );
}
