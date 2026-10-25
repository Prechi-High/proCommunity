import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import * as api from '@/lib/clarity/api';
import { useAppStore } from '@/lib/store';
import { colors, fonts } from '@/constants/theme';
import { FilterChips } from './FilterChips';
import { ActionButton } from './ActionButton';
export function ExperienceAttachment({ productId, value, onChange }: { productId?: string | null; value: string; onChange: (id: string) => void }) {
  const uid = useAppStore(s => s.profile?.id);
  const q = useQuery({ queryKey: ['attach-experiences', uid, productId], queryFn: () => api.experiences(true, productId!), enabled: !!uid && !!productId });
  const rows = q.data?.filter(e => e.visibility === 'public') ?? [];
  if (!uid || !productId || !rows.length) return null;
  const ids = ['None', ...rows.map(e => e.id)];
  return <View style={{ gap: 8 }}><Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.ink }}>Attach your published product experience</Text><Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>People can open it to see your usage context and updates.</Text><FilterChips options={['No attachment', ...rows.map((e, i) => `${i + 1}. ${e.duration || 'My experience'}`)]} value={value ? `${rows.findIndex(e => e.id === value) + 1}. ${rows.find(e => e.id === value)?.duration || 'My experience'}` : 'No attachment'} onChange={label => { const n = label === 'No attachment' ? 0 : Number(label.split('.')[0]); onChange(n ? ids[n] : ''); }}/></View>;
}
export function AttachedExperienceLink({ id }: { id?: string | null }) {
  const router = useRouter();
  if (!id) return null;
  return <ActionButton tone="ghost" label="View attached experience & updates" onPress={() => router.push(`/story/${id}` as Href)} />;
}
