/** Discovery only: comments and canonical video metadata always use YouTube's API. */
export function youtubeVideoId(link) {
  try {
    const url = new URL(link);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") return /^[\w-]{11}$/.test(url.pathname.slice(1)) ? url.pathname.slice(1) : null;
    if (!["youtube.com", "m.youtube.com"].includes(host)) return null;
    const id = url.searchParams.get("v") || url.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})(?:\/|$)/)?.[1];
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}

export function isSearchLimit(error) {
  return /youtube_(?:rateLimitExceeded|quotaExceeded|dailyLimitExceeded|userRateLimitExceeded)|youtube_http_429/.test(String(error));
}

export async function discoverYoutubeCandidates({ name, dimensions, youtube, webSearch, cache }) {
  const queries = [{ q: name + " review", topic: "general" },
    { q: name + " experience results after use", topic: "experience" },
    ...dimensions.slice(0, 2).map(d => ({ q: name + " " + d.label + " review", topic: d.key }))];
  const results = [], failures = [], warnings = [];
  let limited = Boolean((await cache?.getJson("cache:parallel-research-v1:youtube-search-limited"))?.value);
  // Bound discovery concurrency. One exhausted route must never erase another route's results.
  let next = 0;
  const work = async () => {
    while (next < queries.length) {
      const query = queries[next++];
      const key = "cache:parallel-research-v1:youtube-discovery:" + encodeURIComponent(query.q.toLowerCase());
      const cached = await cache?.getJson(key);
      if (cached?.value?.items?.length) { results.push({ ...query, ...cached.value, cached: true }); continue; }
      let data;
      if (!limited) {
        try { data = await youtube("search", { part: "snippet", type: "video", maxResults: 50, q: query.q, relevanceLanguage: "en" }); }
        catch (error) {
          if (isSearchLimit(error)) {
            limited = true;
            await cache?.setJson("cache:parallel-research-v1:youtube-search-limited", { reason: "search_limit" }, 3600);
          }
          warnings.push({ query: query.q, provider: "youtube-search", error: String(error).slice(0, 400) });
        }
      }
      let source = "youtube-search";
      if (!data) {
        try {
          const external = await webSearch({ q: query.q + " site:youtube.com/watch", num: 10 });
          data = { items: (external.organic || []).flatMap(item => {
            const id = youtubeVideoId(item.link);
            return id ? [{ id: { videoId: id }, snippet: { title: item.title || "", description: item.snippet || "" } }] : [];
          }) };
          source = "serper-discovery";
        } catch (error) { failures.push({ query: query.q, error: String(error).slice(0, 400) }); continue; }
      }
      const result = { ...query, ...data, source };
      results.push(result);
      if (data.items?.length) await cache?.setJson(key, { items: data.items, source }, 86400);
    }
  };
  await Promise.all([work(), work()]);
  const videos = new Map();
  for (const result of results) for (const item of result.items || []) {
    const id = item.id?.videoId;
    if (!id || !/^[\w-]{11}$/.test(id)) continue;
    const previous = videos.get(id);
    videos.set(id, { id, title: item.snippet?.title || "", description: item.snippet?.description || "",
      matchedQueryTopics: [...new Set([...(previous?.matchedQueryTopics || []), result.topic])], videoRelevanceScore: 0.5 });
  }
  if (!videos.size && failures.length) throw Error("video_discovery_unavailable: " + failures.map(f => f.error).join("; "));
  if (!videos.size && limited) throw Error("youtube_search_limit_no_discovery_results");
  // Web search snippets are discovery hints, not authority for product identity.
  // Resolve every candidate to canonical metadata before the LLM sees it.
  const ids = [...videos.keys()], canonical = [];
  for (let i = 0; i < ids.length; i += 50) {
    const metadata = await youtube("videos", { part: "snippet,statistics", id: ids.slice(i, i + 50).join(",") });
    for (const item of metadata.items || []) {
      const candidate = videos.get(item.id);
      if (candidate && item.snippet) canonical.push({ ...candidate, title: item.snippet.title,
        description: item.snippet.description || "", commentCount: Number(item.statistics?.commentCount || 0) });
    }
  }
  return { videos: canonical, queries: queries.map(q => q.q), warnings, failures,
    routes: results.map(r => ({ query: r.q, source: r.source, cached: Boolean(r.cached) })) };
}
