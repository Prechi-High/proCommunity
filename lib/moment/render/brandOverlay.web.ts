/**
 * Burn Unmask card overlays into exported frames (TikTok-style permanent mark).
 * Matches UnmaskMomentCard: logo, moment badge, title, products, context chips.
 */
import { brandAssets } from "@/constants/brand";
import { momentConfig, type MomentKind } from "@/lib/moment/kinds";
import { defaultMomentTitle, displayOccasion, type MomentContext } from "@/lib/moment/types";

export type BrandOverlayInput = {
  kind?: MomentKind | null;
  context?: MomentContext;
  caption?: string;
  productStory?: boolean;
};

let logoEl: HTMLImageElement | null = null;
let logoFailed = false;
const productImageCache = new Map<string, HTMLImageElement | null>();

function assetUri(mod: number | { uri?: string } | string): string {
  if (typeof mod === "string") return mod;
  if (typeof mod === "number") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Image } = require("react-native");
      const resolved = Image.resolveAssetSource?.(mod);
      if (resolved?.uri) return resolved.uri;
    } catch {
      /* fall through */
    }
    return String(mod);
  }
  return mod.uri || "";
}

async function loadLogo(): Promise<HTMLImageElement | null> {
  if (logoFailed) return null;
  if (logoEl?.complete && logoEl.naturalWidth) return logoEl;
  const uri = assetUri(brandAssets.symbolWhite as never);
  if (!uri) {
    logoFailed = true;
    return null;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      logoEl = img;
      resolve(img);
    };
    img.onerror = () => {
      logoFailed = true;
      resolve(null);
    };
    img.src = uri;
  });
}

async function loadProductImage(uri?: string): Promise<HTMLImageElement | null> {
  if (!uri) return null;
  if (productImageCache.has(uri)) return productImageCache.get(uri) ?? null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      productImageCache.set(uri, img);
      resolve(img);
    };
    img.onerror = () => {
      productImageCache.set(uri, null);
      resolve(null);
    };
    img.src = uri;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export async function drawUnmaskBrandOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  input: BrandOverlayInput = {},
): Promise<void> {
  if (!w || !h) return;
  const pad = Math.max(12, Math.round(Math.min(w, h) * 0.03));
  const kind = input.kind ?? null;
  const context = input.context ?? {};
  const config = kind ? momentConfig(kind) : null;
  const badge = input.productStory
    ? "PRODUCT STORY"
    : config
      ? `${config.title} ${config.emoji}`
      : "UNMASK";
  const title = (context.momentTitle?.trim() || defaultMomentTitle(kind, input.productStory, displayOccasion(context)))
    .replace(/[☀️🌙💋✨📖]/g, "")
    .trim();
  const products = context.products ?? [];
  const duration = context.usageDuration;
  const logo = await loadLogo();
  const logoSize = Math.max(26, Math.round(Math.min(w, h) * 0.07));

  // Bottom gradient for readability
  const grad = ctx.createLinearGradient(0, h * 0.45, 0, h);
  grad.addColorStop(0, "rgba(10,6,16,0)");
  grad.addColorStop(0.55, "rgba(10,6,16,0.35)");
  grad.addColorStop(1, "rgba(10,6,16,0.72)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, h * 0.45, w, h * 0.55);

  // Logo + wordmark
  if (logo) {
    ctx.drawImage(logo, pad, pad, logoSize, logoSize);
    ctx.font = `700 ${Math.max(14, Math.round(logoSize * 0.42))}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,248,244,0.96)";
    ctx.fillText("Unmask", pad + logoSize + 8, pad + logoSize * 0.68);
  } else {
    ctx.font = `700 ${Math.max(16, Math.round(Math.min(w, h) * 0.045))}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,248,244,0.96)";
    ctx.fillText("Unmask", pad, pad + 18);
  }

  // Moment badge
  const badgeY = pad + logoSize + 10;
  ctx.font = `600 ${Math.max(11, Math.round(Math.min(w, h) * 0.028))}px system-ui, sans-serif`;
  const badgeW = ctx.measureText(badge).width + 20;
  const badgeH = Math.max(22, Math.round(Math.min(w, h) * 0.045));
  ctx.fillStyle = "rgba(74,21,44,0.9)";
  roundRect(ctx, pad, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.fill();
  ctx.fillStyle = "#FFF8F4";
  ctx.fillText(badge, pad + 10, badgeY + badgeH * 0.68);

  // Duration pill top-right
  if (duration) {
    ctx.font = `600 ${Math.max(11, Math.round(Math.min(w, h) * 0.028))}px system-ui, sans-serif`;
    const dw = ctx.measureText(duration).width + 20;
    const dx = w - pad - dw;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    roundRect(ctx, dx, pad, dw, badgeH, badgeH / 2);
    ctx.fill();
    ctx.fillStyle = "#2D1B1B";
    ctx.fillText(duration, dx + 10, pad + badgeH * 0.68);
  }

  // Title mid-left
  const titleSize = Math.max(22, Math.round(Math.min(w, h) * 0.055));
  ctx.font = `700 ${titleSize}px system-ui, sans-serif`;
  ctx.fillStyle = "#FFF8F4";
  const titleY = h * 0.42;
  const maxTitleW = w - pad * 2;
  let drawn = title;
  while (ctx.measureText(drawn).width > maxTitleW && drawn.length > 4) {
    drawn = `${drawn.slice(0, -2)}…`;
  }
  ctx.fillText(drawn, pad, titleY);
  ctx.fillStyle = "#FF6B9D";
  ctx.font = `${Math.round(titleSize * 0.7)}px system-ui, sans-serif`;
  ctx.fillText("♡", pad, titleY + titleSize * 0.85);

  // Product strip
  const stripH = Math.max(48, Math.round(h * 0.1));
  const stripY = h - pad - stripH - (input.caption ? Math.round(h * 0.08) : 0);
  if (products.length) {
    const shown = products.slice(0, 3);
    const stripPad = 8;
    ctx.fillStyle = "rgba(20,8,16,0.55)";
    roundRect(ctx, pad, stripY, w - pad * 2, stripH, 14);
    ctx.fill();
    const cellW = (w - pad * 2 - stripPad * 2) / shown.length;
    for (let i = 0; i < shown.length; i += 1) {
      const p = shown[i];
      const cx = pad + stripPad + i * cellW;
      const thumb = await loadProductImage(p.image);
      const th = Math.max(24, stripH - 16);
      if (thumb) {
        ctx.save();
        roundRect(ctx, cx, stripY + (stripH - th) / 2, th, th, 8);
        ctx.clip();
        ctx.drawImage(thumb, cx, stripY + (stripH - th) / 2, th, th);
        ctx.restore();
      } else {
        ctx.fillStyle = "#F2D8D8";
        roundRect(ctx, cx, stripY + (stripH - th) / 2, th, th, 8);
        ctx.fill();
      }
      ctx.fillStyle = "#FFF8F4";
      ctx.font = `600 ${Math.max(10, Math.round(th * 0.38))}px system-ui, sans-serif`;
      let name = p.name;
      const nameMax = cellW - th - 12;
      while (ctx.measureText(name).width > nameMax && name.length > 4) name = `${name.slice(0, -2)}…`;
      ctx.fillText(name, cx + th + 6, stripY + stripH * 0.58);
    }
  }

  // Context chips under strip
  const chips = [context.skinType, context.usageFrequency, duration, displayOccasion(context) || config?.title]
    .filter(Boolean)
    .slice(0, 3) as string[];
  if (chips.length) {
    let chipX = pad;
    const chipY = Math.min(h - pad - 22, stripY + stripH + 8);
    ctx.font = `600 ${Math.max(10, Math.round(Math.min(w, h) * 0.025))}px system-ui, sans-serif`;
    for (const chip of chips) {
      const cw = ctx.measureText(chip).width + 16;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      roundRect(ctx, chipX, chipY, cw, 20, 10);
      ctx.fill();
      ctx.fillStyle = "#FFF8F4";
      ctx.fillText(chip, chipX + 8, chipY + 14);
      chipX += cw + 6;
    }
  }
}
