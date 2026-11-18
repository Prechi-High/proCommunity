/**
 * Burn Unmask watermark + product/occasion context into exported frames.
 */
import { brandAssets } from "@/constants/brand";
import { displayOccasion, productCount, type MomentContext } from "@/lib/moment/types";
import { momentConfig, type MomentKind } from "@/lib/moment/kinds";

export type BrandOverlayInput = {
  kind?: MomentKind | null;
  context?: MomentContext;
};

let logoEl: HTMLImageElement | null = null;
let logoFailed = false;

function assetUri(mod: number | { uri?: string } | string): string {
  if (typeof mod === "string") return mod;
  if (typeof mod === "number") {
    // Metro numeric asset module — resolve via Image.resolveAssetSource when available
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

function productLine(context?: MomentContext): string {
  if (!context) return "";
  const named = (context.products ?? [])
    .map((p) => (p.brand ? `${p.brand} ${p.name}` : p.name).trim())
    .filter(Boolean)
    .slice(0, 3);
  if (named.length) return named.join(" · ");
  if (context.productName?.trim()) return context.productName.trim();
  const n = productCount(context);
  return n > 0 ? `${n} product${n === 1 ? "" : "s"}` : "";
}

/** Draw Unmask mark + context strip (bottom). Safe no-op if canvas missing. */
export async function drawUnmaskBrandOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  input: BrandOverlayInput = {},
): Promise<void> {
  if (!w || !h) return;
  const pad = Math.max(10, Math.round(Math.min(w, h) * 0.028));
  const logo = await loadLogo();
  const logoSize = Math.max(28, Math.round(Math.min(w, h) * 0.08));

  // Soft bottom gradient so text stays readable on any scene
  const grad = ctx.createLinearGradient(0, h * 0.72, 0, h);
  grad.addColorStop(0, "rgba(10,6,16,0)");
  grad.addColorStop(0.45, "rgba(10,6,16,0.35)");
  grad.addColorStop(1, "rgba(10,6,16,0.72)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);

  if (logo) {
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.drawImage(logo, pad, pad, logoSize, logoSize);
    ctx.restore();
    ctx.font = `600 ${Math.max(11, Math.round(logoSize * 0.32))}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,248,244,0.95)";
    ctx.fillText("Unmask", pad + logoSize + 8, pad + logoSize * 0.62);
  } else {
    ctx.font = `700 ${Math.max(14, Math.round(Math.min(w, h) * 0.045))}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,248,244,0.95)";
    ctx.fillText("Unmask", pad, pad + 18);
  }

  const kindTitle = input.kind ? momentConfig(input.kind).title : "";
  const occasion = displayOccasion(input.context ?? {});
  const products = productLine(input.context);
  const lines = [
    [kindTitle, occasion].filter(Boolean).join(" · "),
    products,
  ].filter(Boolean);

  if (!lines.length) return;

  const fontSize = Math.max(12, Math.round(Math.min(w, h) * 0.032));
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,248,244,0.96)";
  let y = h - pad - (lines.length - 1) * (fontSize + 6);
  for (const line of lines) {
    const maxW = w - pad * 2;
    let text = line;
    while (ctx.measureText(text).width > maxW && text.length > 4) {
      text = `${text.slice(0, -2)}…`;
    }
    ctx.fillText(text, pad, y);
    y += fontSize + 6;
  }
}
