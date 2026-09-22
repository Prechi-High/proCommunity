import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Button, Caption, Heading, Title } from '@/components/ui';
import { BackButton } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';
import {
  expertById,
  expertInitial,
  roomById,
  SAMPLE_ROOM_CHAT,
} from '@/lib/communitySample';
import { hapticExpertVoice, hapticSelect, hapticSuccess, hapticTap } from '@/lib/haptics';
import { useAppStore } from '@/lib/store';

/**
 * Live room / upcoming session sheet from sourced-v1 (2).html.
 */
export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const room = roomById(String(id));
  const profile = useAppStore((s) => s.profile);
  const reminders = useAppStore((s) => s.roomReminders);
  const toggleRemind = useAppStore((s) => s.toggleRoomRemind);

  if (!room) {
    return (
      <Screen>
        <BackButton />
        <Caption>That session isn’t available.</Caption>
      </Screen>
    );
  }

  const host = expertById(room.hostId);
  const on = Boolean(reminders[room.id]);

  if (!room.live) {
    return (
      <Screen>
        <BackButton />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <Mark letter={expertInitial(host.name)} expert />
          <View style={{ flex: 1 }}>
            <Title>{host.name}</Title>
            <Caption>✓ Verified expert · {host.role}</Caption>
          </View>
        </View>
        <Heading size={27} style={{ marginTop: 18, textAlign: 'left' }}>
          {room.title}
        </Heading>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <Pill text={room.when ?? ''} />
          <Pill text={`${room.going ?? 0} going`} />
          <Pill text="Voice and text" />
        </View>
        <Heading size={20} style={{ marginTop: 22 }}>
          What we’ll cover
        </Heading>
        {(room.about ?? []).map((item) => (
          <Caption key={item}>• {item}</Caption>
        ))}
        <Button
          label={on ? `Alarm set for ${room.alarmLabel}. Tap to remove` : 'Remind me with an alarm'}
          kind={on ? 'primary' : 'quiet'}
          style={{ marginTop: 22 }}
          onPress={() => {
            toggleRemind(room.id);
            hapticSuccess();
          }}
        />
        <Caption>
          Rings 5 minutes before, even on silent. On iPhone this is a real alarm on iOS 26 and later. On
          Android it’s added to your alarm app.
        </Caption>
        <Text
          style={{
            marginTop: 22,
            fontFamily: fonts.semibold,
            fontSize: 15,
            color: colors.bone,
          }}
        >
          Send a question in advance
        </Text>
        <AdvanceAsk signed={Boolean(profile)} onNeedAuth={() => router.push('/(auth)/sign-in')} />
        <Caption>Experts give general information, not medical advice.</Caption>
      </Screen>
    );
  }

  return <LiveRoom hostName={host.name} hostRole={host.role} title={room.title} startN={room.listening ?? 47} />;
}

function LiveRoom({
  hostName,
  hostRole,
  title,
  startN,
}: {
  hostName: string;
  hostRole: string;
  title: string;
  startN: number;
}) {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const [n, setN] = useState(startN);
  const [hand, setHand] = useState(false);
  const [lines, setLines] = useState(SAMPLE_ROOM_CHAT.slice(0, 1));
  const [draft, setDraft] = useState('');
  const i = useRef(1);

  useEffect(() => {
    const t = setInterval(() => {
      if (i.current < SAMPLE_ROOM_CHAT.length) {
        const next = SAMPLE_ROOM_CHAT[i.current];
        setLines((prev) => [...prev, next]);
        if (next.expert) hapticExpertVoice();
        i.current += 1;
      }
      setN((v) => v + 1);
    }, 2600);
    return () => clearInterval(t);
  }, []);

  return (
    <Screen scroll={false}>
      <BackButton />
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <Mark letter={expertInitial(hostName)} expert big />
        <Text
          style={{
            fontFamily: fonts.serif,
            fontWeight: '500',
            fontSize: 24,
            color: colors.bone,
            marginTop: 14,
          }}
        >
          {hostName}
        </Text>
        <Caption>✓ Verified expert · {hostRole}</Caption>
      </View>
      <Heading size={22} style={{ textAlign: 'center', marginTop: 16 }}>
        {title}
      </Heading>
      <Caption>
        {n} listening
      </Caption>
      <ScrollView style={{ flex: 1, marginTop: 12 }} contentContainerStyle={{ paddingBottom: 12, gap: 10 }}>
        {lines.map((m, idx) => (
          <View key={`${m.name}-${idx}`}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: m.expert ? colors.honey : colors.bone }}>
              {m.name} {m.skin ? <Text style={{ fontFamily: fonts.regular, color: colors.bone3 }}>{m.skin}</Text> : null}
            </Text>
            <Caption>{m.text}</Caption>
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        <Ctl
          label={hand ? 'Hand raised' : 'Raise hand'}
          on={hand}
          onPress={() => {
            setHand(!hand);
            hapticSuccess();
          }}
        />
        <Ctl label="Muted" disabled />
        <Ctl
          label="Leave"
          onPress={() => {
            hapticSelect();
            router.back();
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Send a question"
          placeholderTextColor={colors.bone3}
          style={{
            flex: 1,
            height: 48,
            borderRadius: 16,
            backgroundColor: colors.lac,
            paddingHorizontal: 14,
            color: colors.bone,
            fontFamily: fonts.regular,
          }}
        />
        <Pressable
          onPress={() => {
            const v = draft.trim();
            if (!v) return;
            if (!profile) {
              router.push('/(auth)/sign-in');
              return;
            }
            setLines((prev) => [...prev, { name: 'You', skin: '', text: v }]);
            setDraft('');
            hapticTap();
          }}
        >
          <Text style={{ fontFamily: fonts.semibold, color: colors.hi }}>Send</Text>
        </Pressable>
      </View>
      <Caption>
        You can listen without an account. Verify to ask a question. Experts give general information, not
        medical advice.
      </Caption>
    </Screen>
  );
}

function AdvanceAsk({ signed, onNeedAuth }: { signed: boolean; onNeedAuth: () => void }) {
  const [v, setV] = useState('');
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 }}>
      <TextInput
        value={v}
        onChangeText={setV}
        placeholder="What would you like answered?"
        placeholderTextColor={colors.bone3}
        style={{
          flex: 1,
          height: 48,
          borderRadius: 16,
          backgroundColor: colors.lac,
          paddingHorizontal: 14,
          color: colors.bone,
          fontFamily: fonts.regular,
        }}
      />
      <Pressable
        onPress={() => {
          if (!v.trim()) return;
          if (!signed) {
            onNeedAuth();
            return;
          }
          setV('');
          hapticSuccess();
        }}
      >
        <Text style={{ fontFamily: fonts.semibold, color: colors.hi }}>Send</Text>
      </Pressable>
    </View>
  );
}

function Mark({ letter, expert, big }: { letter: string; expert?: boolean; big?: boolean }) {
  const size = big ? 72 : 44;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: expert ? 'rgba(232,185,90,0.2)' : colors.lac2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.serif, fontSize: big ? 28 : 19, color: expert ? colors.honey : colors.bone }}>
        {letter}
      </Text>
    </View>
  );
}

function Pill({ text }: { text: string }) {
  return (
    <View style={{ borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.bone2 }}>{text}</Text>
    </View>
  );
}

function Ctl({
  label,
  on,
  disabled,
  onPress,
}: {
  label: string;
  on?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 12,
        borderRadius: 14,
        alignItems: 'center',
        backgroundColor: on ? colors.bone : colors.lac,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: on ? colors.wine : colors.bone2 }}>{label}</Text>
    </Pressable>
  );
}
