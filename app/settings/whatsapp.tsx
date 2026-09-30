import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Camera, ChatsCircle, Files, WhatsappLogo } from '@/components/icons';
import { Pill } from '@/components/kit';
import { TopBar } from '@/components/research';
import { colors, fonts } from '@/constants/theme';

const PREVIEW = [
  { icon: Camera, title: 'Send a photo or a name', body: 'Snap a product in a store and send it to Sourced like any chat.' },
  { icon: Files, title: 'Get a Research Card back', body: 'What owners say, prices and stores — saved to your account, same as in the app.' },
  { icon: ChatsCircle, title: 'Ask follow-ups', body: '“Is it good for oily skin?” “Compare it with…” — right in the conversation.' },
];

export default function WhatsAppComingSoonScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.wine }} edges={['top', 'bottom']}>
      <TopBar title="WhatsApp" fallback="/you" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 22 }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', gap: 12, paddingTop: 18 }}>
          <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: colors.sageSoft, alignItems: 'center', justifyContent: 'center' }}>
            <WhatsappLogo size={40} color={colors.sage} weight="fill" />
          </View>
          <Pill label="Coming soon" tone="accent" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, letterSpacing: -0.7, color: colors.bone, textAlign: 'center' }}>Sourced on WhatsApp</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.bone2, textAlign: 'center' }}>
            We’re putting the finishing touches on it. It will arrive in a later update — nothing to set up until then.
          </Text>
        </View>

        <View style={{ backgroundColor: colors.lac, borderRadius: 20, padding: 16, gap: 16 }}>
          {PREVIEW.map(({ icon: I, title, body }) => (
            <View key={title} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: colors.hiSoft, alignItems: 'center', justifyContent: 'center' }}>
                <I size={18} color={colors.hi} weight="bold" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>{title}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.bone2 }}>{body}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.bone3, textAlign: 'center' }}>
          Everything it will do already works in the app — snap a product or search, then save it as a Research Card.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
