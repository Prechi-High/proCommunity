import { type ReactNode, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Avatar, Button, Caption, Card, Check, Heading, Notice, Seg, Title } from '@/components/ui';
import { Bell, Check as CheckIcon, Lock } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';
import { getProduct, getProductPosts } from '@/lib/catalog';
import { SAMPLE_JOURNEYS, SAMPLE_ROOMS, expertById } from '@/lib/communitySample';
import { computeConfidence } from '@/lib/confidence';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { currentStreak, resolvedSkinType, useAppStore } from '@/lib/store';
import { daysUntil, withUsageDates } from '@/lib/usage';
import { useProducts } from '@/lib/useProduct';

type ShelfSeg = 'today' | 'saved' | 'journeys';

/**
 * Shelf — Today / Saved / Journeys, matching sourced-v1 (2).html.
 */
export default function ShelfScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const guestSkin = useAppStore((s) => s.guestSkinType);
  const skin = resolvedSkinType({ profile, guestSkinType: guestSkin });
  const steps = useAppStore((s) => s.routineSteps);
  const logs = useAppStore((s) => s.routineLogs);
  const toggleRoutineStep = useAppStore((s) => s.toggleRoutineStep);
  const favorites = useAppStore((s) => s.favorites);
  const setPriceAlert = useAppStore((s) => s.setPriceAlert);
  const markPurchased = useAppStore((s) => s.markPurchased);
  const ownerships = useAppStore((s) => s.ownerships);
  const usage = useAppStore((s) => s.usageEstimates);
  const userPosts = useAppStore((s) => s.userPosts);
  const dropsOptIn = useAppStore((s) => s.dropsOptIn);
  const setDropsOptIn = useAppStore((s) => s.setDropsOptIn);
  const reminders = useAppStore((s) => s.roomReminders);
  const following = useAppStore((s) => s.followingJourneyIds);
  const progress = useAppStore((s) => s.progressEntries);
  const addProgress = useAppStore((s) => s.addProgressEntry);
  const setShared = useAppStore((s) => s.setProgressShared);
  const recent = useAppStore((s) => s.recentProductIds);
  const clearRecent = useAppStore((s) => s.clearRecentProducts);
  const eveningDefault = new Date().getHours() >= 17;
  const [mode, setMode] = useState<'am' | 'pm'>(eveningDefault ? 'pm' : 'am');
  const [seg, setSeg] = useState<ShelfSeg>('today');

  const active = steps.filter((s) => s.timeOfDay === mode);
  const today = new Date().toISOString().slice(0, 10);
  const log = logs.find((item) => item.date === today && item.timeOfDay === mode);
  const doneCount = Math.min(log?.completedStepIds.length ?? 0, active.length);
  const streak = currentStreak(logs, steps);

  useProducts([
    ...ownerships.map((o) => o.productId),
    ...favorites.map((f) => f.productId),
    ...usage.map((u) => u.productId),
    ...recent,
  ]);

  const refill = usage
    .map((item) => {
      const product = getProduct(item.productId);
      if (!product?.typicalDurationDays) return null;
      const dated = withUsageDates(item, product);
      const days = daysUntil(dated.estimatedEmptyDate);
      if (days == null || days > 10) return null;
      return { product, days };
    })
    .find(Boolean);

  const reminded = SAMPLE_ROOMS.find((r) => reminders[r.id] && !r.live);
  const followed = SAMPLE_JOURNEYS.filter((j) => following.includes(j.id));
  const boughtIds = ownerships.map((o) => o.productId);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
        <Heading size={34}>Your shelf</Heading>
        {profile ? (
          <Pressable onPress={() => router.push('/(tabs)/you')}>
            <Avatar name={profile.displayName} size={40} />
          </Pressable>
        ) : (
          <View />
        )}
      </View>

      <View style={{ marginTop: 14 }}>
        <Seg
          options={[
            { id: 'today', label: 'Today' },
            { id: 'saved', label: 'Saved' },
            { id: 'journeys', label: 'Journeys' },
          ]}
          value={seg}
          onChange={(id) => setSeg(id as ShelfSeg)}
        />
      </View>

      {seg === 'today' ? (
        <View>
          <Card style={{ marginTop: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Caption>{mode === 'pm' ? 'Evening routine' : 'Morning routine'}</Caption>
                <Text
                  style={{
                    fontFamily: fonts.serif,
                    fontSize: 24,
                    color: colors.bone,
                    marginTop: 2,
                    fontWeight: '500',
                  }}
                >
                  {active.length ? `${doneCount} of ${active.length} done` : 'No steps yet'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: fonts.serif, fontSize: 30, color: colors.bone, fontWeight: '500' }}>
                  {streak}
                </Text>
                <Caption>days in a row</Caption>
              </View>
            </View>
            {active.length ? (
              <View style={{ flexDirection: 'row', gap: 5, marginTop: 14 }}>
                {active.map((step) => {
                  const done = Boolean(log?.completedStepIds.includes(step.id));
                  return (
                    <View
                      key={step.id}
                      style={{
                        flex: 1,
                        height: 4,
                        borderRadius: 3,
                        backgroundColor: done ? colors.sage : 'rgba(243,235,226,0.2)',
                      }}
                    />
                  );
                })}
              </View>
            ) : null}
          </Card>

          <View style={{ marginTop: 14 }}>
            <Seg
              options={[
                { id: 'am', label: 'Morning' },
                { id: 'pm', label: 'Evening' },
              ]}
              value={mode}
              onChange={(id) => setMode(id as 'am' | 'pm')}
            />
          </View>

          <View style={{ marginTop: 8 }}>
            {active.map((step, index) => {
              const product = getProduct(step.productId);
              const done = Boolean(log?.completedStepIds.includes(step.id));
              return (
                <Pressable
                  key={step.id}
                  onPress={() => toggleRoutineStep(step.id, mode)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    paddingVertical: 14,
                    borderTopWidth: 1,
                    borderTopColor: colors.line,
                  }}
                >
                  <Check done={done} />
                  <View style={{ flex: 1 }}>
                    <Title>{product?.name ?? 'Step'}</Title>
                    <Caption>{`Step ${index + 1}`}</Caption>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {active.length ? (
            <Caption>Miss a day and you simply pick up where you left off.</Caption>
          ) : (
            <View style={{ marginTop: 12, gap: 12 }}>
              <Caption color={colors.bone2}>No routine yet. Add products from a case file.</Caption>
              <Button label="Find a product" onPress={() => router.push('/(tabs)')} />
            </View>
          )}

          {refill ? (
            <View style={{ marginTop: 18 }}>
              <Notice>{`Your ${refill.product.name.toLowerCase()} may be running low. It should last about ${Math.max(refill.days, 0)} more days.`}</Notice>
            </View>
          ) : null}

          {reminded ? (
            <Pressable
              onPress={() => router.push(`/room/${reminded.id}` as Href)}
              style={{
                marginTop: 14,
                flexDirection: 'row',
                paddingVertical: 14,
                borderTopWidth: 1,
                borderTopColor: colors.line,
              }}
            >
              <View style={{ flex: 1 }}>
                <Title>{reminded.title}</Title>
                <Caption>
                  {expertById(reminded.hostId).name} · {reminded.when} · alarm at {reminded.alarmLabel}
                </Caption>
              </View>
            </Pressable>
          ) : null}

          <DropBlock
            dropsOn={dropsOptIn}
            skin={skin}
            onEnable={() => {
              setDropsOptIn(true);
              hapticSuccess();
            }}
            onQuiz={() => router.push('/quiz-sheet' as Href)}
            onDrop={() => router.push('/probe/mineral-spf-50')}
          />
        </View>
      ) : null}

      {seg === 'saved' ? (
        <View>
          {favorites.length ? (
            <>
              <Caption>Things you’re considering. Still deciding? That’s okay.</Caption>
              {favorites.map((fav) => {
                const product = getProduct(fav.productId);
                if (!product) return null;
                const score = computeConfidence(product, profile, getProductPosts(product.id, userPosts))
                  .compositeScore;
                const bought = boughtIds.includes(fav.productId);
                return (
                  <View
                    key={fav.productId}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingVertical: 12,
                      borderTopWidth: 1,
                      borderTopColor: colors.line,
                    }}
                  >
                    <Pressable
                      onPress={() => router.push(`/product/${product.id}`)}
                      style={{ flex: 1 }}
                    >
                      <Title>{product.name}</Title>
                      <Caption>{score == null ? 'No score yet' : `Product Score ${score}`}</Caption>
                    </Pressable>
                    <IconToggle
                      on={bought}
                      label="Mark as bought"
                      onPress={() => {
                        if (!profile) {
                          router.push('/(auth)/sign-in');
                          return;
                        }
                        if (!bought) {
                          markPurchased(fav.productId);
                          hapticSuccess();
                        } else {
                          hapticSelect();
                        }
                      }}
                    >
                      <CheckIcon size={18} color={bought ? colors.wine : colors.bone2} weight="bold" />
                    </IconToggle>
                    <IconToggle
                      on={fav.priceAlertEnabled}
                      label="Price alert"
                      onPress={() => {
                        setPriceAlert(fav.productId, !fav.priceAlertEnabled);
                        hapticSelect();
                      }}
                    >
                      <Bell
                        size={18}
                        color={fav.priceAlertEnabled ? colors.wine : colors.bone2}
                        weight={fav.priceAlertEnabled ? 'fill' : 'regular'}
                      />
                    </IconToggle>
                  </View>
                );
              })}
              <Caption>
                Tick a product once you’ve bought it. The bell turns on price alerts, which fire only on real
                changes.
              </Caption>
              {boughtIds.length ? (
                <>
                  <Button
                    label="You’ve used it. Leave a Trace"
                    kind="quiet"
                    style={{ marginTop: 14 }}
                    onPress={() =>
                      router.push(`/compose?kind=trace&product=${boughtIds[0]}` as Href)
                    }
                  />
                  <Caption>In the real app this unlocks 14 days after you mark it as bought.</Caption>
                </>
              ) : null}
              <Button
                label="Ready to buy"
                kind="hl"
                style={{ marginTop: 14 }}
                onPress={() => router.push(`/product/${favorites[0].productId}/stores`)}
              />
            </>
          ) : (
            <Card style={{ marginTop: 16 }}>
              <Title>Nothing here yet.</Title>
              <Caption>Tap the bookmark on any case to keep it here while you decide.</Caption>
            </Card>
          )}

          {recent.length ? (
            <View style={{ marginTop: 28 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Heading size={21}>Recently opened</Heading>
                <Pressable
                  onPress={() => {
                    hapticSelect();
                    clearRecent();
                  }}
                >
                  <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone2 }}>Clear</Text>
                </Pressable>
              </View>
              {recent.map((id) => {
                const product = getProduct(id);
                if (!product) return null;
                const score = computeConfidence(product, profile, getProductPosts(product.id, userPosts))
                  .compositeScore;
                return (
                  <Pressable
                    key={id}
                    onPress={() => router.push(`/product/${id}`)}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      paddingVertical: 14,
                      borderTopWidth: 1,
                      borderTopColor: colors.line,
                    }}
                  >
                    <View>
                      <Title>{product.name}</Title>
                      <Caption>Only you can see this</Caption>
                    </View>
                    <Text
                      style={{
                        fontFamily: fonts.serif,
                        fontSize: 22,
                        color: score == null ? colors.bone3 : colors.bone,
                        fontWeight: '500',
                      }}
                    >
                      {score == null ? 'No score' : score}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      {seg === 'journeys' ? (
        <View>
          <View
            style={{
              marginTop: 16,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <Heading size={22}>Your progress</Heading>
            <Pressable
              onPress={() => {
                const productId = ownerships[0]?.productId ?? favorites[0]?.productId ?? 'niacinamide-10-zinc';
                addProgress({
                  productId,
                  note: 'Added a photo. Skin feels balanced.',
                  entryDate: new Date().toISOString(),
                  weekLabel: `Week ${progress.length + 1} · Today`,
                });
                hapticSuccess();
              }}
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone2 }}>Add entry</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 8 }}>
            <Lock size={12} color={colors.bone3} weight="fill" />
            <Caption>Private by default</Caption>
          </View>
          {progress.map((entry) => (
            <View
              key={entry.id}
              style={{
                flexDirection: 'row',
                gap: 12,
                paddingVertical: 12,
                borderTopWidth: 1,
                borderTopColor: colors.line,
              }}
            >
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 12,
                  backgroundColor: colors.lac2,
                }}
              />
              <View style={{ flex: 1 }}>
                <Title>{entry.weekLabel}</Title>
                <Caption>{entry.note}</Caption>
                <Pressable
                  onPress={() => {
                    if (!profile && !entry.isShared) {
                      router.push('/(auth)/sign-in');
                      return;
                    }
                    setShared(entry.id, !entry.isShared);
                    hapticSelect();
                  }}
                >
                  <Text style={{ marginTop: 6, fontFamily: fonts.medium, fontSize: 13, color: colors.hi }}>
                    {entry.isShared ? 'Shared. Make private' : 'Share this entry'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
          <Caption>
            Share a journey and people can follow it, react, and ask you questions. Only the entries you
            choose.
          </Caption>

          <Heading size={22} style={{ marginTop: 30 }}>
            Following
          </Heading>
          {followed.length ? (
            followed.map((j) => (
              <Pressable
                key={j.id}
                onPress={() => router.push(`/product/${j.productId}`)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 14,
                  borderTopWidth: 1,
                  borderTopColor: colors.line,
                }}
              >
                <Avatar name={j.name} size={40} />
                <View style={{ flex: 1 }}>
                  <Title>{j.name}</Title>
                  <Caption>
                    {j.productLabel} · {j.week} posted 2h ago
                  </Caption>
                </View>
              </Pressable>
            ))
          ) : (
            <>
              <Caption>Follow someone’s journey and their new updates land here.</Caption>
              <Button
                label="Find journeys to follow"
                kind="quiet"
                style={{ marginTop: 12 }}
                onPress={() => router.push('/(tabs)/search')}
              />
            </>
          )}
        </View>
      ) : null}
    </Screen>
  );
}

function IconToggle({
  on,
  label,
  onPress,
  children,
}: {
  on: boolean;
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: on ? colors.bone : colors.lac2,
      }}
    >
      {children}
    </Pressable>
  );
}

function DropBlock({
  dropsOn,
  skin,
  onEnable,
  onQuiz,
  onDrop,
}: {
  dropsOn: boolean;
  skin: string | null;
  onEnable: () => void;
  onQuiz: () => void;
  onDrop: () => void;
}) {
  if (!dropsOn) {
    return (
      <Pressable
        onPress={onEnable}
        style={{
          marginTop: 22,
          backgroundColor: colors.lac,
          borderRadius: 22,
          padding: 18,
        }}
      >
        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone, lineHeight: 22 }}>
          Want a message when something’s been community-tested for your skin?
        </Text>
        <Caption>Sponsored ones are always labeled. Off unless you turn it on.</Caption>
      </Pressable>
    );
  }
  if (!skin) {
    return (
      <View style={{ marginTop: 22, backgroundColor: colors.lac, borderRadius: 22, padding: 18 }}>
        <Caption>From Sourced</Caption>
        <Text
          style={{
            fontFamily: fonts.serif,
            fontSize: 20,
            fontWeight: '500',
            color: colors.bone,
            marginTop: 6,
          }}
        >
          Tell us your skin type and drops will actually match you.
        </Text>
        <Button label="Take the 3-question quiz" kind="quiet" style={{ marginTop: 14 }} onPress={onQuiz} />
      </View>
    );
  }
  if (skin === 'sensitive' || skin === 'dry') {
    return (
      <View style={{ marginTop: 22, backgroundColor: colors.lac, borderRadius: 22, padding: 18 }}>
        <Caption>A message from Sourced</Caption>
        <Text
          style={{
            fontFamily: fonts.serif,
            fontSize: 18,
            fontWeight: '500',
            color: colors.bone,
            marginTop: 6,
            lineHeight: 24,
          }}
        >
          “This one’s for {skin} skin like yours. 23 owners tried it, and the testers’ score is mixed.”
        </Text>
        <Caption>
          Sponsored. Solène paid Sourced to introduce this. Testers received it free. The score is theirs, and
          it’s mixed overall.
        </Caption>
        <Button label="See what the testers said" kind="hl" style={{ marginTop: 16 }} onPress={onDrop} />
      </View>
    );
  }
  return (
    <View style={{ marginTop: 22 }}>
      <Caption>
        Nothing has been community-tested for {skin} skin right now. We’ll message you when there is.
      </Caption>
    </View>
  );
}
