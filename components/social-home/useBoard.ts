import { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";

import { listMoments, listPosts } from "@/lib/social/api";
import { boardMoments, boardPosts, railFromMoments, usingSamples } from "@/lib/social/model";
import { sampleMoments, samplePosts } from "@/lib/social/samples";

const SEEN = "unmask.moment.seen";

export function useSeenMoments() {
  const [seen, setSeen] = useState<Set<string>>(new Set());
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(SEEN)
      .then((raw) => {
        if (!alive || !raw) return;
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setSeen(new Set(parsed.filter((item) => typeof item === "string")));
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const mark = useCallback((id: string) => {
    setSeen((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      void AsyncStorage.setItem(SEEN, JSON.stringify([...next].slice(-400))).catch(() => undefined);
      return next;
    });
  }, []);
  return { seen, mark };
}

export function useSocialBoard() {
  const moments = useQuery({ queryKey: ["social-moments"], queryFn: listMoments, staleTime: 20_000 });
  const posts = useQuery({ queryKey: ["social-posts"], queryFn: listPosts, staleTime: 20_000 });
  const seenState = useSeenMoments();
  const imaginedMoments = useMemo(() => sampleMoments(), []);
  const imaginedPosts = useMemo(() => samplePosts(), []);
  const liveMoments = moments.data ?? [];
  const livePosts = posts.data ?? [];
  const momentRows = moments.isFetched ? boardMoments(liveMoments, imaginedMoments) : [];
  const postRows = posts.isFetched ? boardPosts(livePosts, imaginedPosts) : [];
  return {
    people: railFromMoments(momentRows),
    posts: postRows,
    storySamples: moments.isFetched && usingSamples(liveMoments.length),
    postSamples: posts.isFetched && usingSamples(livePosts.length),
    error: moments.isError || posts.isError,
    seen: seenState.seen,
    mark: seenState.mark,
  };
}
