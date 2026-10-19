import { useRouter, type Href } from 'expo-router';
import { Body, Button, Card, Tag, Title } from '@/components/living/ui';
export function TogetherInvite() { const r = useRouter(); return <Card><Tag text="UNMASK TOGETHER · OPTIONAL"/><Title>Used it? Leave something useful.</Title><Body>Share what happened. Help the next person decide.</Body><Button label="Explore the gathering" onPress={() => r.push('/together' as Href)}/></Card>; }
