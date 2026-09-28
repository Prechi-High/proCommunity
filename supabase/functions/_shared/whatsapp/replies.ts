import { appDeepLink, publicUrl } from "../core/env.ts";
import type { ProductCandidate } from "../core/intelligence.ts";
import { STATUS_LABEL } from "../research/sections.ts";
import type { ResearchCard, ResearchCardView } from "../research/types.ts";
import { clip, type WhatsAppClient } from "./client.ts";
import { Action } from "./intent.ts";
import type { UserSafeError } from "./types.ts";

/** Every user-facing WhatsApp message. Handlers pick a reply; they never compose copy inline. */

export const cardLink = (cardId: string) => `${appDeepLink()}/research/${cardId}`;
export const connectLink = () => `${publicUrl()}/settings/whatsapp`;

export const reply = {
  welcome: (c: WhatsAppClient, to: string) =>
    c.sendCtaUrl(
      to,
      "Welcome to Sourced.\n\nTo keep your research organised across WhatsApp and Sourced, connect this WhatsApp number to your Sourced account.\n\nIn the app: You → WhatsApp → Connect.",
      "Connect Sourced",
      connectLink(),
    ),

  linked: (c: WhatsAppClient, to: string) =>
    c.sendButtons(to, "Sourced connected ✓\n\nYour WhatsApp is now linked to your Sourced account.\n\nSend me a product photo or a product name to start structured research.", [
      { id: Action.start, title: "Start Research" },
      { id: Action.list, title: "My Research" },
    ]),

  linkFailed: (c: WhatsAppClient, to: string, reason: "invalid" | "expired" | "used") =>
    c.sendCtaUrl(
      to,
      reason === "expired"
        ? "That connection link has expired. Open Sourced and tap Connect WhatsApp again — links last about 12 minutes."
        : "That connection link isn't valid any more. Open Sourced and tap Connect WhatsApp to get a fresh one.",
      "Open Sourced",
      connectLink(),
    ),

  disconnected: (c: WhatsAppClient, to: string) =>
    c.sendText(to, "WhatsApp disconnected.\n\nYour Research Cards stay safe in your Sourced account. You can reconnect any time from the app."),

  help: (c: WhatsAppClient, to: string) =>
    c.sendButtons(
      to,
      "Here's what I can do:\n\n• Send a product photo — I'll identify it and research it\n• Send a product name — e.g. “Ninja air fryer AF101”\n• Ask about your current research — “does it have fragrance?”\n• “compare with …” to add a comparison\n• “my research” to see past Research Cards",
      [
        { id: Action.start, title: "Start Research" },
        { id: Action.list, title: "My Research" },
      ],
    ),

  askForProduct: (c: WhatsAppClient, to: string) =>
    c.sendText(to, "Send me a photo of the product (front label works best), or type its name — brand and model if you know them."),

  researching: (c: WhatsAppClient, to: string, what: string) =>
    c.sendText(to, `Researching ${clip(what, 80)}…\n\nI'm pulling together product details, owner experiences and sources. I'll message you here when your Research Card is ready.`),

  identifying: (c: WhatsAppClient, to: string) => c.sendText(to, "Got your photo. Identifying the product…"),

  recent: (c: WhatsAppClient, to: string, card: ResearchCard, productId: string) =>
    c.sendButtons(to, `You researched ${clip(card.title ?? "this product", 80)} recently (Research Card ${card.public_reference}).`, [
      { id: Action.open(card.id), title: "Open Existing" },
      { id: Action.again(productId), title: "Research Again" },
    ]),

  ambiguous: (c: WhatsAppClient, to: string, candidates: ProductCandidate[]) =>
    c.sendList(
      to,
      "I found a few possible matches. Which one is this?",
      "Choose product",
      [{ title: "Possible matches", rows: candidates.slice(0, 5).map((p, i) => ({ id: Action.pick(i), title: p.name, description: [p.brand, p.category].filter(Boolean).join(" · ") })) }],
      { footer: "Not listed? Send a clearer photo or type the name." },
    ),

  completed: (c: WhatsAppClient, to: string, card: ResearchCard, verdict: string) =>
    c.sendButtons(
      to,
      [
        card.status === "partial" ? "Research ready — some sections unavailable" : "Research complete ✓",
        "",
        card.title ?? "",
        `Research Card ${card.public_reference}`,
        "",
        verdict ? clip(verdict, 280) : "I've organised the product details, community evidence and sources into one card.",
      ].join("\n"),
      [
        { id: Action.open(card.id), title: "Open Research" },
        { id: Action.compare(card.id), title: "Compare" },
        { id: Action.save(card.id), title: "Save" },
      ],
    ),

  overview: (c: WhatsAppClient, to: string, view: ResearchCardView) => {
    const summary = view.sections.find((s) => s.section_key === "summary")?.content as { verdict?: string; summary?: string } | undefined;
    const confidence = view.sections.find((s) => s.section_key === "confidence")?.content as { score?: number | null; drivers?: string[] } | undefined;
    const lines = [
      `${view.card.title ?? "Research"} · ${view.card.public_reference}`,
      STATUS_LABEL[view.card.status],
      "",
      clip(summary?.verdict || summary?.summary || "", 420),
      confidence?.score != null ? `\nOwner score ${confidence.score}/100 — ${(confidence.drivers ?? []).slice(0, 2).join("; ") || "based on limited evidence"}.` : "",
    ].filter((l) => l !== undefined);
    return c.sendCtaUrl(to, lines.join("\n").trim(), "Open full card", cardLink(view.card.id));
  },

  list: (c: WhatsAppClient, to: string, cards: ResearchCard[], heading: string) =>
    cards.length
      ? c.sendList(to, heading, "View research", [
          {
            title: "Research Cards",
            rows: cards.slice(0, 10).map((card) => ({
              id: Action.open(card.id),
              title: card.title ?? card.public_reference,
              description: `${card.public_reference} · ${STATUS_LABEL[card.status]} · ${new Date(card.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
            })),
          },
        ])
      : c.sendText(to, "You don't have any Research Cards yet. Send a product photo or name to start one."),

  askCompareTarget: (c: WhatsAppClient, to: string, title: string) =>
    c.sendText(to, `Which product should I compare with ${clip(title, 60)}? Send its name.`),

  comparing: (c: WhatsAppClient, to: string, target: string) => c.sendText(to, `Comparing with ${clip(target, 80)}… I'll add it to your Research Card.`),

  comparison: (c: WhatsAppClient, to: string, card: ResearchCard, snap: Record<string, unknown>) => {
    const a = (snap.a ?? {}) as Record<string, unknown>;
    const b = (snap.b ?? {}) as Record<string, unknown>;
    const v = (snap.verdict ?? null) as { text?: string } | null;
    const row = (x: Record<string, unknown>) =>
      `*${String(x.name ?? "")}*${x.score != null ? ` — owner score ${x.score}/100` : ""}\n+ ${((x.praise as string[]) ?? [])[0] ?? "No clear praise yet"}\n− ${((x.complaints as string[]) ?? [])[0] ?? "No recurring complaints found"}`;
    return c.sendButtons(to, [`Comparison added to ${card.public_reference}`, "", row(a), "", row(b), v?.text ? `\n${clip(v.text, 300)}` : ""].join("\n"), [
      { id: Action.open(card.id), title: "Open Research" },
      { id: Action.share(card.id), title: "Share" },
    ]);
  },

  thinking: (c: WhatsAppClient, to: string) => c.sendText(to, "Checking what owners and sources say…"),

  answer: (c: WhatsAppClient, to: string, card: ResearchCard, answer: { text?: string; enough?: boolean; basedOn?: number }) =>
    c.sendButtons(
      to,
      [clip(answer.text ?? "", 800), "", answer.enough === false ? "Evidence on this is thin — treat it as a lead, not a fact." : answer.basedOn ? `Based on ${answer.basedOn} owner and source mentions.` : "", `Saved to ${card.public_reference}.`]
        .filter(Boolean)
        .join("\n"),
      [
        { id: Action.open(card.id), title: "Open Research" },
        { id: Action.compare(card.id), title: "Compare" },
      ],
    ),

  saved: (c: WhatsAppClient, to: string, name: string) => c.sendText(to, `Saved ✓ ${clip(name, 80)} is in your Saved list in the Sourced app.`),

  satchelUnavailable: (c: WhatsAppClient, to: string) =>
    c.sendText(to, "Satchel isn't available yet. I can save the product to your Saved list instead — reply “save”."),

  shared: (c: WhatsAppClient, to: string, url: string) =>
    c.sendText(to, `Here's a shareable version of this research (no personal details included):\n\n${url}\n\nYou can turn sharing off any time in the Sourced app.`, { previewUrl: true }),

  stores: (c: WhatsAppClient, to: string, card: ResearchCard, offers: Array<{ seller?: string; price?: { display?: string } | null; link?: string | null }>) =>
    offers.length
      ? c.sendText(
          to,
          [`Where to buy ${card.title ?? ""}`, "", ...offers.slice(0, 4).map((o) => `• ${o.seller ?? "Store"}${o.price?.display ? ` — ${o.price.display}` : ""}${o.link ? `\n  ${o.link}` : ""}`), "", "Prices change often — check before paying."].join("\n"),
        )
      : c.sendText(to, "No store listings were found for this product yet."),

  sensitiveImage: (c: WhatsAppClient, to: string) =>
    c.sendCtaUrl(
      to,
      "This looks like a skin or face photo.\n\nSourced needs your separate consent before using personal skin images for analysis, so I haven't analysed it. For product research, send a photo of the product itself.",
      "Open Sourced",
      publicUrl(),
    ),

  error: (c: WhatsAppClient, to: string, code: UserSafeError) => {
    const copy: Record<UserSafeError, string> = {
      PRODUCT_NOT_IDENTIFIED: "I couldn't identify the product confidently from this.\n\nTry another photo showing the front label or product name, or type the name.",
      PRODUCT_AMBIGUOUS: "I found several possible products. Send the exact name or a clearer photo of the label.",
      RESEARCH_FAILED: "Research couldn't be completed this time. Please try again in a little while.",
      MEDIA_UNAVAILABLE: "I couldn't open that image. Please send the photo again.",
      ACCOUNT_NOT_LINKED: "Connect your Sourced account first — in the app go to You → WhatsApp → Connect.",
      RESEARCH_NOT_FOUND: "I couldn't find that Research Card in your account.",
      PERMISSION_DENIED: "That isn't available for your account.",
      RATE_LIMITED: "You've started a lot of research in a short time. Please wait a bit and try again.",
      TEMPORARY_ERROR: "Something went wrong on our side. Please try again shortly.",
    };
    return code === "PRODUCT_NOT_IDENTIFIED"
      ? c.sendButtons(to, copy[code], [{ id: Action.start, title: "Try Again" }])
      : c.sendText(to, copy[code]);
  },
};
