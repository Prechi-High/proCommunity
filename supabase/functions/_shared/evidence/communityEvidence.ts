type Json = Record<string, unknown>;
export type CommunityStore = { rows(path: string): Promise<Json[]> };
/** Service-role callers MUST enforce publication/privacy explicitly. Never use private shelves. */
export async function loadCommunityEvidence(store: CommunityStore | null, productId: string): Promise<Json[]> {
  if (!store) return [];
  const pid = encodeURIComponent(productId);
  const experiences = await store.rows(`clarity_experiences?select=id,user_id,author_name,body,context,skin_type,created_at&product_id=eq.${pid}&visibility=eq.public&order=created_at.desc&limit=500`);
  const rows: Json[] = experiences.map(r => ({ id: `community:experience:${r.id}`, sourceId: `experience:${r.id}`,
    platform: "community", provider: "community", author: r.author_name, authorId: r.user_id,
    text: r.body, contextText: r.context, skinType: r.skin_type, createdAt: r.created_at,
    url: `/product/${encodeURIComponent(productId)}`, title: "Unmask community experience" }));
  const journeys = await store.rows(`unmask_journeys?select=id&product_id=eq.${pid}&visibility=eq.public&limit=500`);
  if (journeys.length) {
    const ids = journeys.map(r => String(r.id)).filter(x => /^[a-f0-9-]+$/i.test(x));
    if (ids.length) {
      const updates = await store.rows(`unmask_experience_updates?select=id,user_id,author_name,changed,unchanged,reaction,created_at,journey_id&journey_id=in.(${ids.join(",")})&visibility=eq.public&moderation_status=eq.published&is_demo=eq.false&order=created_at.desc&limit=500`);
      for (const r of updates) rows.push({ id: `community:update:${r.id}`, sourceId: `update:${r.id}`, platform: "community", provider: "community",
        author: r.author_name, authorId: r.user_id, text: [r.changed, r.unchanged, r.reaction].filter(Boolean).join("\n"),
        conversationId: String(r.journey_id), createdAt: r.created_at,
        url: `/product/${encodeURIComponent(productId)}`, title: "Unmask product journey" });
    }
  }
  const threads = await store.rows(`community_threads?select=id,title,body,author_id,author_name,created_at,community_replies(id,body,author_id,author_name,created_at)&product_id=eq.${pid}&order=last_activity_at.desc&limit=100`);
  for (const t of threads) {
    rows.push({ id: `community:thread:${t.id}`, sourceId: `thread:${t.id}`, platform: "community", provider: "community",
      text: t.body, title: t.title, author: t.author_name, authorId: t.author_id, createdAt: t.created_at,
      conversationId: String(t.id), url: `/community/${t.id}` });
    for (const r of (Array.isArray(t.community_replies) ? t.community_replies : []) as Json[]) {
      rows.push({ id: `community:reply:${r.id}`, sourceId: `reply:${r.id}`, platform: "community", provider: "community",
        text: r.body, title: t.title, author: r.author_name, authorId: r.author_id, createdAt: r.created_at,
        parentId: `thread:${t.id}`, contextText: t.body, conversationId: String(t.id), url: `/community/${t.id}` });
    }
  }
  return rows;
}
