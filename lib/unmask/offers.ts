import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import * as api from "@/lib/team/api";
import { db } from "@/lib/clarity/api";
import { SAMPLE_OFFERS } from "./samples";
export type DisplayOffer = {
  id: string;
  sponsor: string;
  title: string;
  product_id: string;
  kind: string;
  description: string;
  disclosure: string;
  price?: number | null;
  compare_at_price?: number | null;
  currency?: string;
  unmask_catalog: {
    name: string;
    brand: string | null;
    category: string | null;
    image_url: string | null;
  } | null;
  experience_count?: number;
  sample?: boolean;
};
export { offerDiscount, offerMoney } from "./offerPresentation";
export function useOffers() {
  const demo = useAppStore((s) => s.demoCommunity);
  const q = useQuery({
    queryKey: ["offers", "public"],
    queryFn: () => api.offers(),
    enabled: !demo,
  });
  const ids = [...new Set((q.data ?? []).map((x) => x.product_id))].sort();
  const counts = useQuery({
    queryKey: ["offer-counts", ids],
    enabled: !demo && ids.length > 0,
    queryFn: () =>
      api.read<{ product_id: string; experience_count: number }[]>(
        db().rpc("unmask_offer_evidence_counts", { p_ids: ids }),
      ),
  });
  const rows: DisplayOffer[] = demo
    ? SAMPLE_OFFERS.map((x) => ({ ...x, sample: true }))
    : (q.data ?? []).map((x) => ({
        ...x,
        experience_count: counts.data?.find(
          (c) => c.product_id === x.product_id,
        )?.experience_count,
      }));
  return {
    rows,
    demo,
    isLoading: !demo && q.isLoading,
    error: !demo ? q.error : null,
    countError: counts.error,
    retry: () => {
      void q.refetch();
      void counts.refetch();
    },
  };
}
