import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { View } from "react-native";
import { useMemberGate } from "@/components/community";
import { ReferenceProductFlow } from "@/components/unmask/reference/ProductFlow";
import { routeId } from "@/lib/catalog";
import { trackProduct } from "@/lib/community";
import {
  displayName,
  getCachedPreviewResult,
  getKnownProduct,
  getUnmaskJobStatus,
  previewToProfile,
  profileToProduct,
  kickProductOpenPipeline,
  resolveProductPreview,
  startProductUnmask,
  rememberProduct,
  callIntel,
} from "@/lib/products";
import { useAppStore } from "@/lib/store";
import type { ProductProfile } from "@/lib/types";
import {
  flushProductOpenTimings,
  hasProductOpenTiming,
  markJobMilestoneTimings,
  markProductOpenTiming,
} from "@/lib/unmask/openTimings";
import { agentLog } from "@/lib/debug/agentLog";
import { investigationComplete } from "@/lib/unmask/investigationStages";
import { loadProductClips } from "@/lib/videos";
const ACTIVE_UNMASK_JOB_STATES = new Set([
  "queued",
  "identified",
  "researching",
  "mapping",
  "scoring",
]);
export default function ProductScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    id: string;
    q?: string;
    tab?: string;
  }>();
  const id = routeId(params.id);
  const q = typeof params.q === "string" ? params.q : undefined;
  const scan = useAppStore((s) => s.scans[id]);
  const favorites = useAppStore((s) => s.favorites);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const addRecent = useAppStore((s) => s.addRecentProduct);
  const known = getKnownProduct(id);
  const saved = favorites.some((f) => f.productId === id);
  const { requireMember, gate } = useMemberGate();
  const unmaskStarted = useRef(false);

  useEffect(() => {
    if (id) addRecent(id);
  }, [id, addRecent]);

  useEffect(() => {
    unmaskStarted.current = false;
  }, [id]);

  useEffect(() => {
    if (!id) return;
    if (!hasProductOpenTiming(id, "selection")) {
      markProductOpenTiming(id, "selection");
      agentLog(
        "product/index.tsx",
        "selection_on_screen_mount",
        { productId: id },
        "H1",
      );
      kickProductOpenPipeline({
        id,
        query: q,
        name: known?.name,
        brand: known?.brand,
      });
    }
  }, [id, q, known?.name, known?.brand]);

  const previewQuery = useQuery({
    queryKey: ["preview", id],
    initialData: () => getCachedPreviewResult(id),
    queryFn: async () => {
      if (!hasProductOpenTiming(id, "preview_request_started")) {
        markProductOpenTiming(id, "preview_request_started");
      }
      const out = await resolveProductPreview({
        id,
        query: q,
        name: known?.name,
        brand: known?.brand,
      });
      if (!hasProductOpenTiming(id, "preview_ready")) {
        markProductOpenTiming(id, "preview_ready");
      }
      return out;
    },
    enabled: Boolean(id),
    staleTime: 30 * 60_000,
    retry: false,
    refetchOnMount: false,
  });

  const jobQuery = useQuery({
    queryKey: ["unmaskJob", id],
    queryFn: () => getUnmaskJobStatus(id),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state === "ready" || state === "failed" ? false : 2500;
    },
  });

  useEffect(() => {
    if (jobQuery.data?.milestones) {
      markJobMilestoneTimings(id, jobQuery.data.milestones);
    }
  }, [id, jobQuery.data?.milestones]);

  useEffect(() => {
    if (jobQuery.data?.state === "ready") {
      markProductOpenTiming(id, "job_ready");
      flushProductOpenTimings(id);
      void queryClient.invalidateQueries({ queryKey: ["intel", id] });
    }
  }, [id, jobQuery.data?.state]);


  const intel = useQuery({
    queryKey: ["intel", id],
    queryFn: async () => {
      const res = await callIntel<{ profile?: ProductProfile | null }>(
        { action: "get", productId: id },
        20_000,
      );
      if (!res.profile) return null;
      const { hydrateProductFindings } = await import("@/lib/products");
      await hydrateProductFindings(res.profile);
      rememberProduct(profileToProduct(res.profile, getKnownProduct(id)));
      return res.profile;
    },
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const state = jobQuery.data?.state;
      if (state && ACTIVE_UNMASK_JOB_STATES.has(state)) return 3000;
      if (state === "ready" && !query.state.data && query.state.dataUpdateCount < 3) return 1500;
      return false;
    },
    staleTime: 30 * 60_000,
    retry: 1,
    retryDelay: 1000,
  });

  useEffect(() => {
    if (!id) return;
    if (previewQuery.isLoading || !previewQuery.data) return;
    if (jobQuery.isLoading) return;
    const state = jobQuery.data?.state;
    if (state === "failed") return;
    const stale = jobQuery.data && Date.now() - Date.parse(jobQuery.data.updatedAt) > 180_000;
    if (state === "ready" && intel.data !== null) return;
    if (state && ACTIVE_UNMASK_JOB_STATES.has(state) && !stale) return;
    if (unmaskStarted.current) return;
    unmaskStarted.current = true;
    void startProductUnmask({
      id,
      query: q ?? (known ? displayName(known) : undefined),
    }).then((result) => {
      if (result.profile) queryClient.setQueryData(["intel", id], result.profile);
      void jobQuery.refetch();
    }).catch(() => {
      unmaskStarted.current = false;
    });
  }, [
    id,
    q,
    known?.name,
    known?.brand,
    previewQuery.isLoading,
    previewQuery.data,
    jobQuery.isLoading,
    jobQuery.data?.state,
    jobQuery.data?.updatedAt,
    intel.data,
    queryClient,
  ]);

  const previewProfile = previewQuery.data
    ? previewToProfile(previewQuery.data.preview)
    : null;
  const profile = intel.data ?? previewProfile;
  const intelReady = Boolean(
    intel.data && investigationComplete(false, intel.data),
  );
  const jobState = jobQuery.data?.state;
  const intelLoading =
    (previewQuery.isLoading ||
      (jobState != null && ACTIVE_UNMASK_JOB_STATES.has(jobState)));

  const retryIntel = useCallback(() => {
    unmaskStarted.current = false;
    void startProductUnmask({ id, query: q ?? known?.name, force: true })
      .then(async (result) => {
        if (result.profile) queryClient.setQueryData(["intel", id], result.profile);
        await jobQuery.refetch();
        await intel.refetch();
      })
      .catch(() => undefined);
    void previewQuery.refetch();
    void jobQuery.refetch();

  }, [id, q, known?.name, previewQuery, jobQuery, intel]);

  const product = getKnownProduct(id) ?? known;
  const name =
    profile?.identity.name || (product ? displayName(product) : (q ?? ""));

  const clips = useQuery({
    queryKey: ["clips", id],
    queryFn: () =>
      loadProductClips({
        id,
        name: profile?.identity.name || product?.name || q || "",
        brand: profile?.identity.brand || product?.brand || "",
      }),
    enabled: Boolean(id) && (Boolean(profile) || Boolean(product?.name)),
    staleTime: 60 * 60_000,
  });

  const tracked = useRef(false);
  useEffect(() => {
    if (!profile || tracked.current) return;
    tracked.current = true;
    trackProduct(profileToProduct(profile, product), "view");
  }, [profile, product]);

  const image = product?.heroImageUrl || profile?.images[0] || null;
  const brand = profile?.identity.brand || product?.brand || "";
  const category = profile?.identity.category || product?.category || "";
  const currentProduct = profile
    ? profileToProduct(profile, product)
    : { id, name, brand, category, heroImageUrl: image };
  const onAskCommunity = (question: string) => {
    requireMember(() => {
      router.push({
        pathname: "/product/[id]/ask-community",
        params: { id, q: question },
      } as unknown as Href);
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <ReferenceProductFlow
        key={id}
        product={currentProduct}
        profile={profile}
        intelReady={intelReady}
        intelLoading={intelLoading}
        intelError={!intelReady && (intel.isError || (previewQuery.isError && !product))}
        jobProgress={jobQuery.data}
        previewLoading={previewQuery.isLoading}
        clips={clips.data || []}
        clipsLoading={clips.isLoading}
        scanPhoto={scan?.photo}
        saved={saved}
        onStart={() => markProductOpenTiming(id, "user_pressed_unmask")}
        onRetry={retryIntel}
        onAskCommunity={onAskCommunity}
        onSave={() => {
          toggleFavorite(id);
          if (!saved && profile)
            trackProduct(profileToProduct(profile, product), "save");
        }}
        onCompare={() =>
          router.push({ pathname: "/compare", params: { a: id } } as Href)
        }
      />
      {gate}
    </View>
  );
}
