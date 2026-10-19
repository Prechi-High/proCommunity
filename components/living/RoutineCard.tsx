import { Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import type { Routine } from '@/lib/living/types';
import { colors as c, fonts as f } from '@/constants/theme';
import { Card, Tag, Title, Body, Button, design } from './ui';
import { FollowButton } from './FollowButton';
export function RoutineCard({ routine: x, follow = false }: { routine: Routine; follow?: boolean }) {
 const r = useRouter();
 const age = x.started_on ? Math.max(0, Math.floor((Date.now() - Date.parse(x.started_on)) / 86400000)) : null;
 return <Card>
  <View style={[design.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}><Tag text={x.time_of_day === 'pm' ? 'Evening ritual' : x.time_of_day === 'am' ? 'Morning ritual' : x.time_of_day} tone={x.time_of_day === 'pm' ? 'gold' : 'sage'} /><Text style={design.small}>{x.visibility} · {x.is_active ? 'Active' : 'Paused'}</Text></View>
  <Title>{x.name}</Title><Body>{x.goal || 'A routine in progress.'}</Body>
  <View style={{ borderLeftWidth: 3, borderColor: c.marker, paddingLeft: 14, gap: 6 }}><Text style={{ fontFamily: f.semibold, fontSize: 12, color: c.brand }}>THE CONTEXT</Text><Body>{x.context || 'Context not shared yet.'}</Body>{x.uncertainty ? <Text style={design.small}>Still open: {x.uncertainty}</Text> : null}</View>
  <Text style={design.small}>{age !== null && Number.isFinite(age) ? `${age} days since reported start · ` : ''}Updated {new Date(x.updated_at).toLocaleDateString()}</Text>
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Button quiet label="Products & routine story →" onPress={() => r.push(`/routine/${x.id}` as Href)} />{follow ? <FollowButton type="routine" id={x.id} /> : null}</View>
 </Card>;
}
