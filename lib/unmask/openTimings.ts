import { track } from '@/lib/analytics';

export type ProductOpenTimingEvent =
  | 'selection'
  | 'preview_request_started'
  | 'unmask_job_started'
  | 'preview_ready'
  | 'user_pressed_unmask'
  | 'job_ready'
  | 'blueprint_started'
  | 'youtube_started'
  | 'evidence_mapping_started';

type Session = {
  productId: string;
  selectionAt: number;
  marks: Partial<Record<ProductOpenTimingEvent, number>>;
};

const sessions = new Map<string, Session>();

function session(productId: string): Session {
  let s = sessions.get(productId);
  if (!s) {
    s = { productId, selectionAt: Date.now(), marks: {} };
    sessions.set(productId, s);
  }
  return s;
}

export function resetProductOpenTimings(productId: string): void {
  sessions.delete(productId);
}

export function markProductOpenTiming(productId: string, event: ProductOpenTimingEvent): void {
  const s = session(productId);
  if (event === 'selection') {
    s.selectionAt = Date.now();
    s.marks.selection = s.selectionAt;
  } else {
    s.marks[event] = Date.now();
  }
}

export function getProductOpenTimings(productId: string) {
  const s = sessions.get(productId);
  if (!s) return null;
  const base = s.selectionAt;
  const delta = (e: ProductOpenTimingEvent) => {
    const t = s.marks[e];
    return t != null ? t - base : null;
  };
  return {
    productId,
    selectionAt: base,
    msToPreviewRequest: delta('preview_request_started'),
    msToUnmaskJobStart: delta('unmask_job_started'),
    msToPreviewReady: delta('preview_ready'),
    msToUnmaskPress: delta('user_pressed_unmask'),
    msToJobReady: delta('job_ready'),
    msToBlueprintStarted: delta('blueprint_started'),
    msToYoutubeStarted: delta('youtube_started'),
    msToEvidenceMappingStarted: delta('evidence_mapping_started'),
    raw: s.marks,
  };
}

export function flushProductOpenTimings(productId: string): void {
  const report = getProductOpenTimings(productId);
  if (!report) return;
  track('product_open_timing', report as Record<string, unknown>);
  if (__DEV__) {
    console.log('[product_open_timing]', JSON.stringify(report));
  }
}
