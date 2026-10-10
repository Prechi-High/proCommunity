import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { ProductScreenChrome } from '@/components/shell/ProductScreenChrome';
import { PrimaryButton } from '@/components/kit';
import { colors, fonts, radii } from '@/constants/theme';
import { routeId } from '@/lib/catalog';
import { postThread } from '@/lib/community';
import { hapticSuccess } from '@/lib/haptics';
import { getKnownProduct, investigateProduct, profileToProduct } from '@/lib/products';
import { useMemberGate } from '@/components/community';

export default function AskCommunityScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ id: string; q?: string }>();
  const id = routeId(params.id);
  const initialQ = typeof params.q === 'string' ? params.q : '';
  const [title, setTitle] = useState(initialQ);
  const [details, setDetails] = useState('');
  const { requireMember, gate } = useMemberGate();

  const intel = useQuery({
    queryKey: ['intel', id],
    queryFn: () => investigateProduct({ id }),
    enabled: Boolean(id),
  });
  const profile = intel.data;
  const product = getKnownProduct(id);

  const post = useMutation({
    mutationFn: () =>
      postThread({
        product: profile ? profileToProduct(profile, product) : { id, name: title, brand: '', category: 'Product' },
        kind: 'question',
        title: title.trim(),
      }),
    onSuccess: (thread) => {
      hapticSuccess();
      void qc.invalidateQueries({ queryKey: ['threads', id] });
      void qc.invalidateQueries({ queryKey: ['pulse'] });
      router.replace({ pathname: '/thread/[id]', params: { id: thread.id } } as Href);
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.wine }}>
      <ProductScreenChrome onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontFamily: fonts.serifBold, fontSize: 28, color: colors.bone }}>Ask the Community</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.bone2, lineHeight: 22 }}>
          Get first-hand experiences from people who own or have used this product.
        </Text>

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone }}>Your question</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>{title.length}/300</Text>
          </View>
          <TextInput
            value={title}
            onChangeText={(t) => setTitle(t.slice(0, 300))}
            multiline
            style={{
              minHeight: 88,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: radii.card,
              padding: 14,
              fontFamily: fonts.regular,
              fontSize: 16,
              color: colors.bone,
              backgroundColor: colors.lac,
            }}
          />
        </View>

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone }}>Add more details (optional)</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>{details.length}/1000</Text>
          </View>
          <TextInput
            value={details}
            onChangeText={(t) => setDetails(t.slice(0, 1000))}
            multiline
            placeholder="What setup are you trying to achieve?"
            placeholderTextColor={colors.bone3}
            style={{
              minHeight: 120,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: radii.card,
              padding: 14,
              fontFamily: fonts.regular,
              fontSize: 15,
              color: colors.bone,
              backgroundColor: colors.lac,
            }}
          />
        </View>

        <View style={{ borderRadius: radii.card, backgroundColor: colors.goldSoft, padding: 14 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.bone2 }}>
            Helpful answers strengthen Unmask. Great community answers may improve evidence for this product.
          </Text>
        </View>

        <PrimaryButton
          label="Post to community →"
          disabled={!title.trim() || post.isPending}
          onPress={() => requireMember(() => post.mutate())}
        />
      </ScrollView>
      {gate}
    </View>
  );
}
