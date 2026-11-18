type Listener = (jobId: string) => void;

let mountListener: Listener | null = null;

export function registerNativeRenderMount(listener: Listener | null) {
  mountListener = listener;
}

export function requestNativeRenderMount(jobId: string) {
  mountListener?.(jobId);
}