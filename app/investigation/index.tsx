import { Redirect, type Href } from 'expo-router';

export default function InvestigationsRedirect() {
  return <Redirect href={'/unmask' as Href} />;
}
