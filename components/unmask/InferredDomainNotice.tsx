import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { dismissDomainNotice, fetchDomainNoticeDismissed, recordDomainNoticeShown, votePrioritizeDomain } from '@/lib/domainApi';
import { trackInferredNoticeShown, trackInferredVoteSubmitted } from '@/lib/unmask/productAnalytics';
import { colors, fonts, radii } from '@/constants/theme';
import { hapticSuccess, hapticTap } from '@/lib/haptics';

type Props = {
  domainId: string;
  domainName: string;
  productId: string;
  officialDomains: string[];
  canVote: boolean;
  onContinue: () => void;
};

export function InferredDomainNotice({
  domainId,
  domainName,
  productId,
  officialDomains,
  canVote,
  onContinue,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [voted, setVoted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchDomainNoticeDismissed(domainId).then((dismissed) => {
      if (cancelled || dismissed) return;
      setVisible(true);
      trackInferredNoticeShown(domainName, productId);
      void recordDomainNoticeShown(domainId);
    });
    return () => {
      cancelled = true;
    };
  }, [domainId, domainName, productId]);

  if (!visible) return null;

  const officialLine = officialDomains.join(' · ');

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 16,
        borderRadius: radii.card,
        backgroundColor: '#FFF8E7',
        borderWidth: 1,
        borderColor: '#E8D9A8',
        gap: 10,
      }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.bone }}>New territory for Unmask</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2, lineHeight: 20 }}>
        This product belongs to {domainName}. We&apos;re currently building our deepest category experiences for {officialLine}.
        We&apos;ll still fully investigate this product using Unmask&apos;s adaptive intelligence. Want us to prioritize {domainName} next?
      </Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>
        Your search already helps us understand what category to build next.
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        {canVote ? (
          <Pressable
            onPress={() => {
              hapticSuccess();
              setVoted(true);
              trackInferredVoteSubmitted(domainName, productId);
              void votePrioritizeDomain(domainId, productId);
            }}
            style={{
              flexGrow: 1,
              minWidth: 140,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: radii.button,
              backgroundColor: colors.hi,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.white }}>
              {voted ? 'Thanks — noted' : 'Prioritize this category'}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => {
            hapticTap();
            void dismissDomainNotice(domainId);
            setVisible(false);
            onContinue();
          }}
          style={{
            flexGrow: 1,
            minWidth: 140,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: radii.button,
            borderWidth: 1.5,
            borderColor: colors.hi,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.hi }}>Continue unmasking</Text>
        </Pressable>
      </View>
    </View>
  );
}
