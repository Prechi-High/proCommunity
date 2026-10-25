import { useEffect, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { TodayPage } from "@/components/today/Page";
import { InvestigationCard } from "@/components/today/InvestigationCard";
import { Field } from "@/components/community-v2/ui";
import {
  Button,
  Busy,
  Chips,
  Copy,
  Notice,
} from "@/components/unmask/reference/ui";
import { browse } from "@/lib/today/api";
import { catalog } from "@/lib/living/api";
import { useAppStore } from "@/lib/store";
export default function Investigations() {
  const uid = useAppStore((s) => s.profile?.id);
  const r = useRouter();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("Recent");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const categories = useQuery({
    queryKey: ["catalog"],
    queryFn: () => catalog(),
  });
  const q = useInfiniteQuery({
    queryKey: ["investigation-browse", debounced, category, sort, uid],
    queryFn: ({ pageParam }) => browse(debounced, category, sort, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.length === 20 ? pages.length * 20 : undefined,
    enabled: sort !== "Following" || !!uid,
  });
  const rows = q.data?.pages.flat() ?? [];
  return (
    <TodayPage
      title="What should we unmask next?"
      sub="Find a question you care about. Add experience or support."
    >
      <Field
        label="Search investigation requests"
        value={search}
        onChange={setSearch}
      />
      <Chips
        options={[
          "All",
          ...new Set(
            (categories.data ?? [])
              .map((p) => p.category)
              .filter((x): x is string => !!x),
          ),
        ]}
        value={category}
        onChange={setCategory}
      />
      <Chips
        options={["Recent", "Most sparked", "Following"]}
        value={sort}
        onChange={setSort}
      />
      <Copy small>
        Most sparked uses combined financial support. 1 Thunder Spark = 100
        Sparks. Supporters count individual people.
      </Copy>
      {sort === "Following" && !uid ? (
        <>
          <Notice>
            Sign in to see requests from investigations, products and people you
            follow.
          </Notice>
          <Button label="Sign in" onPress={() => r.push("/(auth)/sign-in")} />
        </>
      ) : (
        <>
          <Busy
            loading={q.isLoading}
            error={q.error}
            retry={() => void q.refetch()}
          />
          {rows.map((i) => (
            <InvestigationCard key={i.id} item={i} />
          ))}
          {q.isSuccess && rows.length === 0 ? (
            <Notice>
              {search || category !== "All"
                ? "No requests match these filters."
                : "No requests here yet. Start a question you care about."}
            </Notice>
          ) : null}
          {q.hasNextPage ? (
            <Button
              quiet
              disabled={q.isFetchingNextPage}
              label={q.isFetchingNextPage ? "Loading…" : "Load more requests"}
              onPress={() => void q.fetchNextPage()}
            />
          ) : null}
        </>
      )}
      <Button
        label="＋ Request an Unmask"
        onPress={() => r.push("/investigation/request")}
      />
    </TodayPage>
  );
}
