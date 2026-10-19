import { useRouter, type Href } from 'expo-router';
import { Text, View } from 'react-native';
import { Body, Button, Card, Tag, Title, design } from '@/components/living/ui';
import { type Experience } from '@/lib/clarity/api';
export function ExperienceCard({ item }: {
    item: Experience;
}) { const r = useRouter(); return <Card><View style={[design.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}><Tag text={item.visibility === 'private' ? 'Only you' : item.author_name}/><Text style={design.small}>{item.duration} · self-reported</Text></View><Title>{item.unmask_catalog?.name || 'Product experience'}</Title><Text style={design.small}>{item.acquisition} · {item.usage_status}</Text><Text style={design.label}>What changed</Text><Body>{item.body}</Body>{item.uncertainty ? <><Text style={design.label}>Still uncertain</Text><Body>{item.uncertainty}</Body></> : null}{item.context ? <Text style={design.small}>{item.context}</Text> : null}{item.skin_type ? <Tag text={`${item.skin_type} skin · self-disclosed`}/> : null}<Button quiet label="Open experience" onPress={() => r.push(`/contribute?experience=${item.id}` as Href)}/></Card>; }
