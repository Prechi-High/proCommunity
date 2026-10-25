import { useState } from 'react';
import { Linking, Share, Text, View } from 'react-native';
import * as ExpoLinking from 'expo-linking';
import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';

import { FollowButton } from '@/components/living/FollowButton';
import { ActionButton, AppShell, Avatar, FilterChips, StatusMessage, StoryCard } from '@/components/unmask-ui';
import { COPY } from '@/constants/brand';
import { colors, fonts } from '@/constants/theme';
import { useAppStore } from '@/lib/store';
import * as api from '@/lib/profiles/api';
import * as community from '@/lib/community-v2/api';
import { SAMPLE_CREATORS, SAMPLE_FEED } from '@/lib/unmask/samples';

export function PublicProfile({
  id,
  creatorOnly = false,
}: {
  id: string;
  creatorOnly?: boolean;
}) {
  const uid = useAppStore((s) => s.profile?.id);
  const router = useRouter();
  const sample = SAMPLE_CREATORS.find((c) => c.user_id === id);
  const [tab, setTab] = useState(creatorOnly || sample ? 'Ultra Unmasks' : 'Stories');
  const [error, setError] = useState('');
  const identity = useQuery({
    queryKey: ['public-identity', id],
    queryFn: () => api.identity(id),
    enabled: !!id && !sample,
  });
  const counts = useQuery({
    queryKey: ['profile-counts', id, uid],
    queryFn: () => api.counts(id),
    enabled: !!id && !sample,
  });
  const experiences = useQuery({
    queryKey: ['profile-experiences', id],
    queryFn: () => api.experiences(id),
    enabled: !!id && !sample,
  });
  const questions = useQuery({
    queryKey: ['profile-questions', id],
    queryFn: () => api.questions(id),
    enabled: !!id && !sample,
  });
  const support = useQuery({
    queryKey: ['profile-support', id],
    queryFn: () => api.support(id),
    enabled: !!id && !sample,
  });
  const creators = useQuery({
    queryKey: ['creators'],
    queryFn: community.creators,
    enabled: !sample,
  });
  const videos = useQuery({
    queryKey: ['creator-publications', id],
    queryFn: () => community.publications(id),
    enabled: !!id && !sample,
  });
  const live = creators.data?.find((c) => c.user_id === id);
  const unmasker = Boolean(live || sample);
  const name = identity.data?.display_name || live?.display_name || sample?.display_name || 'Unmasker';
  const handle = identity.data?.handle || live?.handle || sample?.handle;
  const bio =
    identity.data?.bio ||
    live?.bio ||
    (sample ? `${name} is an Unmask Creator. They take lived stories to the company and to people who know.` : '');
  const avatar = identity.data?.avatar_url || live?.avatar_url || sample?.avatar_url;
  const options = unmasker ? ['Ultra Unmasks', 'Stories', 'About'] : ['Stories', 'Questions', 'Sparked'];
  const active = options.includes(tab) ? tab : options[0];
  const sampleCases = SAMPLE_FEED.filter((row) => row.kind === 'unmask' && row.creatorName === sample?.display_name);
  const sampleStories = SAMPLE_FEED.filter((row) => row.kind === 'experience' && row.author === sample?.display_name);

  const share = async () => {
    try {
      await Share.share({
        message: `${name} on Unmask\n${ExpoLinking.createURL(`/member/${id}`)}`,
      });
    } catch {
      setError('Could not share this profile.');
    }
  };

  return (
    <AppShell back title={unmasker ? 'Unmask Creator' : name} subtitle={unmasker ? COPY.unmaskersTeach : undefined}>
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <Avatar name={name} uri={avatar} size={72} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: fonts.serifBold, fontSize: 26, lineHeight: 30, color: colors.ink, letterSpacing: -0.4 }}>
            {name}
          </Text>
          {handle ? <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.inkSoft }}>@{handle}</Text> : null}
        </View>
      </View>
      {unmasker ? (
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.brandDeep }}>
          Unmask Creator · product investigations
        </Text>
      ) : null}
      {bio ? <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.ink }}>{bio}</Text> : null}
      {counts.data ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft }}>
          {counts.data.followers} followers · {counts.data.following} following
        </Text>
      ) : sample ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft }}>Preview creator · labeled sample</Text>
      ) : null}
      {uid === id ? (
        <ActionButton tone="secondary" label="Edit profile" onPress={() => router.push('/profile/edit' as Href)} />
      ) : sample ? (
        <ActionButton tone="secondary" label="Follow this creator" onPress={() => router.push('/(auth)/sign-in' as Href)} />
      ) : (
        <FollowButton type="person" id={id} />
      )}
      <ActionButton tone="ghost" label="Share" onPress={() => void share()} />
      {error ? <StatusMessage kind="error" title={error} /> : null}
      <FilterChips options={options} value={active} onChange={setTab} />

      {active === 'Ultra Unmasks' ? (
        sample ? (
          sampleCases.length ? (
            sampleCases.map((item) => <StoryCard key={item.id} item={item} />)
          ) : (
            <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.inkSoft }}>No Ultra Unmasks in this preview yet.</Text>
          )
        ) : (
          <>
            {(videos.data ?? []).map((v) => (
              <View key={v.id} style={{ gap: 8 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: colors.ink }}>{v.title}</Text>
                <ActionButton label={COPY.watchUnmask} onPress={() => void Linking.openURL(v.video_url).catch(() => setError('Could not open this video.'))} />
              </View>
            ))}
            {videos.data?.length === 0 ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.inkSoft }}>No published Ultra Unmasks yet.</Text>
            ) : null}
          </>
        )
      ) : null}

      {active === 'Stories' ? (
        sample ? (
          sampleStories.length ? (
            sampleStories.map((item) => <StoryCard key={item.id} item={item} />)
          ) : (
            <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.inkSoft }}>No public stories in this preview.</Text>
          )
        ) : (
          <>
            {(experiences.data ?? []).map((e) => (
              <View key={e.id} style={{ gap: 8 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>{e.unmask_catalog?.name || 'Lived story'}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.ink }}>{e.body}</Text>
                <ActionButton tone="ghost" label={COPY.readStory} onPress={() => router.push(`/story/${e.id}` as Href)} />
              </View>
            ))}
            {experiences.data?.length === 0 ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.inkSoft }}>No public stories yet.</Text>
            ) : null}
          </>
        )
      ) : null}

      {active === 'Questions' ? (
        <>
          {(questions.data ?? []).map((q) => (
            <View key={q.id} style={{ gap: 8 }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.ink }}>{q.body}</Text>
              <ActionButton tone="ghost" label={COPY.answerCta} onPress={() => router.push(`/question/${q.id}` as Href)} />
            </View>
          ))}
          {questions.data?.length === 0 ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.inkSoft }}>No public questions yet.</Text>
          ) : null}
        </>
      ) : null}

      {active === 'Sparked' ? (
        <>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.inkSoft }}>
            Only public Sparks show here. Amounts stay private.
          </Text>
          {(support.data ?? []).map((i) => (
            <ActionButton key={i.id} tone="secondary" label={i.title} onPress={() => router.push(`/investigation/${i.id}` as Href)} />
          ))}
          {support.data?.length === 0 ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.inkSoft }}>No public Sparks to show.</Text>
          ) : null}
        </>
      ) : null}

      {active === 'About' ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.inkSoft }}>
          {bio || 'No bio yet.'} Unmask Creators gather experiences and seek company or expert responses. Sparks cannot buy the answer.
        </Text>
      ) : null}
    </AppShell>
  );
}
