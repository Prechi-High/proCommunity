import { Platform } from 'react-native';

type Capture = (event: string, props?: Record<string, unknown>) => void;

let captureImpl: Capture = () => undefined;

export function bindAnalytics(capture: Capture) {
  captureImpl = capture;
}

export function track(event: string, props?: Record<string, unknown>) {
  captureImpl(event, { platform: Platform.OS, ...props });
}
