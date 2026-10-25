import { Redirect, type Href } from 'expo-router';

/** Community feed now lives on Home. */
export default function PulseRedirect() {
  return <Redirect href={'/' as Href} />;
}
