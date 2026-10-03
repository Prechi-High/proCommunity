import { ActivityIndicator, Text, View } from 'react-native';

import { MiniBarChart } from '@/components/admin/MiniBarChart';
import { Caption, Card, SectionHeader, Title } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import type { AdminDashboard } from '@/lib/community';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card style={{ minWidth: '46%', flexGrow: 1, gap: 4, paddingVertical: 14 }}>
      <Caption>{label}</Caption>
      <Title>{String(value)}</Title>
      {sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>{sub}</Text> : null}
    </Card>
  );
}

export function AdminInsightsPanel({
  insights,
  loading,
  error,
}: {
  insights?: AdminDashboard;
  loading: boolean;
  error: boolean;
}) {
  if (loading) return <ActivityIndicator color={colors.hi} />;
  if (error) {
    return <Caption color={colors.rosewood}>Could not load dashboard. Redeploy product-intelligence and apply migration 0026.</Caption>;
  }
  if (!insights) return null;

  const s = insights.stats;
  const series = insights.series;

  return (
    <View style={{ gap: 20 }}>
      <Caption>
        Last {insights.windowDays} days — visits, searches, product views, and members. Charts show the most recent 14 days.
      </Caption>

      <SectionHeader title="Today" hint="Live snapshot for the current UTC day." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <StatCard label="Site visits today" value={s.visitsToday ?? 0} sub={`${s.newVisitsToday ?? 0} new · ${s.returnVisitsToday ?? 0} returning`} />
        <StatCard label="Searches today" value={s.searchesToday ?? 0} />
        <StatCard label="Product views today" value={s.productViewsToday ?? 0} />
        <StatCard label="New accounts today" value={s.signupsToday ?? 0} />
        <StatCard label="Members signed in today" value={s.membersActiveToday ?? 0} />
      </View>

      <SectionHeader title="Last 30 days" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <StatCard label="Total site visits" value={s.totalVisits30d ?? 0} sub={`${s.uniqueVisitors30d ?? 0} unique visitors`} />
        <StatCard label="Total searches" value={s.totalSearches30d ?? 0} />
        <StatCard label="New members" value={s.signups30d ?? 0} sub={`${s.members} all-time profiles`} />
        <StatCard label="Product views (7d)" value={s.productViews7d} />
        <StatCard label="Saves (7d)" value={s.saves7d} />
        <StatCard label="Compares (7d)" value={s.compares7d} />
        <StatCard label="Posts (7d)" value={s.posts7d} />
        <StatCard label="Quick questions (7d)" value={s.quickQuestions7d} />
      </View>

      {series ? (
        <View style={{ gap: 18 }}>
          <Card style={{ gap: 12 }}>
            <MiniBarChart title="Daily site visits" hint="Session starts in the app." data={series.visits} color={colors.hi} />
          </Card>
          <Card style={{ gap: 12 }}>
            <MiniBarChart title="Daily searches" hint="Product catalog searches." data={series.searches} color={colors.sage} />
          </Card>
          <Card style={{ gap: 12 }}>
            <MiniBarChart title="Daily product page views" data={series.productViews} color="#D9A441" />
          </Card>
          <Card style={{ gap: 12 }}>
            <MiniBarChart title="New member signups" data={series.signups} color={colors.rosewood} />
          </Card>
        </View>
      ) : null}

      <SectionHeader title="Accounts created today" />
      {insights.members?.newToday?.length ? (
        insights.members.newToday.map((m) => (
          <Card key={m.id} style={{ gap: 4 }}>
            <Title>{m.displayName || m.email || m.id}</Title>
            <Caption>{m.email}</Caption>
            <Caption>{new Date(m.createdAt).toLocaleString()}</Caption>
          </Card>
        ))
      ) : (
        <Caption>No new accounts yet today.</Caption>
      )}

      <SectionHeader title="Recent members" hint="Latest profiles and last sign-in." />
      {insights.members?.recent?.map((m) => (
        <Card key={m.id} style={{ gap: 4 }}>
          <Title>{m.displayName || 'Member'}</Title>
          <Caption>{m.email}</Caption>
          <Caption>
            Joined {new Date(m.createdAt).toLocaleDateString()}
            {m.lastSignInAt ? ` · Last sign-in ${new Date(m.lastSignInAt).toLocaleDateString()}` : ''}
          </Caption>
        </Card>
      ))}

      <SectionHeader title="Visit history" hint="Latest session starts (most recent first)." />
      {insights.recentVisits?.length ? (
        insights.recentVisits.map((v, i) => (
          <Card key={`${v.at}-${i}`} style={{ gap: 4 }}>
            <Title>{new Date(v.at).toLocaleString()}</Title>
            <Caption>
              {v.returning ? 'Returning visitor' : 'New visitor'}
              {v.signedIn ? ' · Signed in' : ' · Guest'}
              {v.event === 'session_start' ? ' · App open' : ''}
            </Caption>
          </Card>
        ))
      ) : (
        <Caption>No visits logged yet. Open the app after migration 0026 and edge deploy.</Caption>
      )}

      <SectionHeader title="Recent searches" />
      {insights.recentSearches?.length ? (
        insights.recentSearches.map((q, i) => (
          <Card key={`${q.at}-${i}`} style={{ gap: 4 }}>
            <Title>{q.query}</Title>
            <Caption>{`${new Date(q.at).toLocaleString()} · ${q.signedIn ? 'Signed in' : 'Guest'}`}</Caption>
          </Card>
        ))
      ) : (
        <Caption>No searches logged yet. Run a search in the app after migration 0026 is applied.</Caption>
      )}

      <SectionHeader title="Trending products" hint="What people are looking up most." />
      {insights.trending.length ? (
        insights.trending.map((t, i) => (
          <Card key={t.id} style={{ gap: 4 }}>
            <Title>{`${i + 1}. ${t.name}`}</Title>
            <Caption>{`${t.views} views · ${t.asks} quick questions · heat ${t.heat}`}</Caption>
          </Card>
        ))
      ) : (
        <Caption>No trending data yet.</Caption>
      )}

      <SectionHeader title="Recent posts" />
      {insights.recentThreads.map((t) => (
        <Card key={t.id} style={{ gap: 4 }}>
          <Title>{t.title}</Title>
          <Caption>{`${t.kind} · ${t.product_name} · ${t.author_name}`}</Caption>
        </Card>
      ))}

      <SectionHeader title="Recent quick questions" />
      {insights.recentQuestions.map((q, i) => (
        <Card key={`${q.created_at}-${i}`} style={{ gap: 4 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.bone }}>{q.question}</Text>
          <Caption>{q.product_name}</Caption>
        </Card>
      ))}
    </View>
  );
}
