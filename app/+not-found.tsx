import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Body, Button, Heading } from '@/components/ui';

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen>
      <Heading>This screen does not exist</Heading>
      <Body>Check the link or go back to your shelf.</Body>
      <Button label="Go to Shelf" onPress={() => router.replace('/(tabs)')} />
    </Screen>
  );
}
