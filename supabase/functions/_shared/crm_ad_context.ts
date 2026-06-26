// Shared (Deno) extraction of Meta/Instagram ad context from an inbound webhook body.
//
// When a customer clicks a Click-to-WhatsApp / Instagram ad, the first inbound message
// carries an `externalAdReply` (a.k.a. contextInfo / metaCampaign) with the creative the
// customer clicked: title, body, the ad image (mediaURL / thumbnail) and a source url.
// For a carousel, the clicked card's creative is the one delivered — so the image and
// text already describe the specific device the customer is interested in (e.g. iPhone 11).
//
// This mirrors the frontend parser in lib/crm/messageUtils.ts (resolveMetaCampaignPreviewData)
// but server-side, and additionally parses a deterministic `product_hint` (iPhone model +
// capacity) from the creative text so the AI agent can greet the customer about the exact
// device — the way a human specialist does ("você garantiu o iPhone 11 da oferta relâmpago").

export type AdContextSource =
  | "meta_ads"
  | "instagram_ads"
  | "click_to_whatsapp";

export interface AdProductHint {
  model: string | null; // canonical-ish label, e.g. "iPhone 11 Pro Max"
  capacity_gb: number | null; // 64 / 128 / 256 / 512 / 1024
  raw: string | null; // the matched substring it was parsed from
}

export interface AdContext {
  is_from_ad: true;
  source: AdContextSource;
  campaign_id: string | null;
  campaign_title: string | null;
  campaign_body: string | null;
  campaign_name: string | null;
  image_url: string | null;
  source_url: string | null;
  product_hint: AdProductHint | null;
}

// ── low-level helpers ────────────────────────────────────────────────────────

const toText = (value: unknown): string | null => {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readAlias = (
  record: Record<string, unknown> | null,
  keys: string[],
): unknown => {
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const normalizeToken = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const isTrueLike = (value: unknown): boolean => {
  if (value === true || value === 1) return true;
  const normalized = normalizeToken(value);
  return normalized === "true" || normalized === "1";
};

function collectNested(
  value: unknown,
  depth = 7,
  seen = new Set<Record<string, unknown>>(),
): Record<string, unknown>[] {
  if (depth < 0) return [];
  const rec = asRecord(value);
  if (!rec || seen.has(rec)) return [];
  seen.add(rec);
  const items: Record<string, unknown>[] = [rec];
  for (const v of Object.values(rec)) {
    if (v && typeof v === "object") {
      items.push(...collectNested(v, depth - 1, seen));
    }
  }
  return items;
}

const isAdContext = (
  ctx: Record<string, unknown>,
  ext: Record<string, unknown> | null,
): boolean => {
  const sourceType = normalizeToken(
    readAlias(ext, ["sourceType", "source_type"]) ??
      readAlias(ctx, ["sourceType", "source_type"]),
  );
  const conversion = normalizeToken(
    readAlias(ctx, ["conversionSource", "conversion_source"]) ??
      readAlias(ctx, [
        "entryPointConversionSource",
        "entry_point_conversion_source",
      ]),
  );
  const showAttr = isTrueLike(
    readAlias(ext, ["showAdAttribution", "show_ad_attribution"]) ??
      readAlias(ctx, ["showAdAttribution", "show_ad_attribution"]),
  );
  const hasAdMarkers = sourceType.includes("ad") ||
    conversion.includes("ad") || conversion.includes("ctwa") ||
    conversion.includes("fb_ads");
  return hasAdMarkers || showAttr;
};

const resolveSource = (sourceApp: unknown): AdContextSource => {
  const normalized = normalizeToken(sourceApp);
  const parts = new Set(normalized.split("_").filter(Boolean));
  if (normalized.includes("ctwa")) return "click_to_whatsapp";
  if (
    normalized.includes("face") || parts.has("fb") || normalized.includes("meta")
  ) {
    return "meta_ads";
  }
  return "instagram_ads";
};

// ── product hint parser ──────────────────────────────────────────────────────

const CAPACITY_RE =
  /(\d{2,4})\s*(gb|gigas?|gigabytes?)\b|(\d)\s*(tb|teras?|terabytes?)\b/i;

export function parseCapacityGb(text: string | null | undefined): number | null {
  const raw = String(text ?? "");
  if (!raw) return null;
  const match = raw.match(CAPACITY_RE);
  if (!match) return null;
  if (match[1]) {
    const gb = Number(match[1]);
    return Number.isFinite(gb) && gb > 0 ? gb : null;
  }
  if (match[3]) {
    const tb = Number(match[3]);
    return Number.isFinite(tb) && tb > 0 ? tb * 1024 : null;
  }
  return null;
}

// Matches "iPhone 11", "iPhone 13 Pro Max", "iphone 12 mini", "iPhone SE",
// "iPhone XR/XS", tolerating extra words/spacing. Returns the matched label.
const MODEL_RE =
  /\biphone\s*(se|xr|xs(?:\s*max)?|x|\d{1,2})\s*(pro\s*max|pro|plus|mini)?/i;

const titleCaseModel = (numberPart: string, variant: string | null): string => {
  const np = numberPart.toUpperCase() === "SE"
    ? "SE"
    : /^[a-z]+$/i.test(numberPart)
    ? numberPart.toUpperCase() // XR / XS / X
    : numberPart;
  const variantLabel = variant
    ? " " + variant
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
    : "";
  return `iPhone ${np}${variantLabel}`;
};

export function parseProductHint(
  ...texts: Array<string | null | undefined>
): AdProductHint | null {
  const haystack = texts.filter(Boolean).join(" • ").trim();
  if (!haystack) return null;
  const modelMatch = haystack.match(MODEL_RE);
  if (!modelMatch) return null;
  const model = titleCaseModel(modelMatch[1], modelMatch[2] ?? null);
  // Prefer a capacity that appears near the model; fall back to anywhere in text.
  const after = haystack.slice(modelMatch.index ?? 0);
  const capacity = parseCapacityGb(after) ?? parseCapacityGb(haystack);
  return {
    model,
    capacity_gb: capacity,
    raw: modelMatch[0].replace(/\s+/g, " ").trim(),
  };
}

// ── public entry point ───────────────────────────────────────────────────────

export function extractAdContext(payload: unknown): AdContext | null {
  // Direct metaCampaign shape (already-normalized webhook variants).
  const top = asRecord(payload);
  const direct = asRecord(readAlias(top, ["metaCampaign", "meta_campaign"]));
  if (direct) {
    const title = toText(readAlias(direct, ["title"]));
    const body = toText(readAlias(direct, ["body"]));
    const campaignName = toText(
      readAlias(direct, ["campaignName", "campaign_name"]),
    );
    return finalize({
      source: resolveSource(readAlias(direct, ["sourceApp", "source_app"])),
      campaign_id: toText(
        readAlias(direct, ["sourceID", "sourceId", "source_id"]),
      ),
      campaign_title: title,
      campaign_body: body,
      campaign_name: campaignName,
      image_url: toText(
        readAlias(direct, ["mediaURL", "mediaUrl", "media_url"]) ??
          readAlias(direct, ["thumbnailURL", "thumbnailUrl", "thumbnail_url"]),
      ),
      source_url: toText(
        readAlias(direct, ["sourceURL", "sourceUrl", "source_url"]),
      ),
    });
  }

  for (const rec of collectNested(payload, 7)) {
    const ctx = asRecord(readAlias(rec, ["contextInfo", "context_info"])) ?? rec;
    const ext = asRecord(readAlias(ctx, ["externalAdReply", "external_ad_reply"]));
    const scope = ext ?? ctx;
    if (!isAdContext(ctx, ext)) continue;

    const title = toText(readAlias(scope, ["title"]) ?? readAlias(ctx, ["title"]));
    const body = toText(readAlias(scope, ["body"]) ?? readAlias(ctx, ["body"]));
    const campaignName = toText(
      readAlias(scope, ["campaignName", "campaign_name"]) ??
        readAlias(ctx, ["campaignName", "campaign_name"]),
    );
    const hasAnySignal = title || body ||
      readAlias(scope, ["sourceID", "sourceId", "source_id"]) !== undefined ||
      readAlias(scope, ["mediaURL", "mediaUrl", "media_url"]) !== undefined;
    if (!hasAnySignal) continue;

    return finalize({
      source: resolveSource(
        readAlias(scope, ["sourceApp", "source_app"]) ??
          readAlias(ctx, [
            "entryPointConversionApp",
            "entry_point_conversion_app",
          ]),
      ),
      campaign_id: toText(
        readAlias(scope, ["sourceID", "sourceId", "source_id"]) ??
          readAlias(ctx, ["sourceID", "sourceId", "source_id"]),
      ),
      campaign_title: title,
      campaign_body: body,
      campaign_name: campaignName,
      image_url: toText(
        readAlias(scope, ["mediaURL", "mediaUrl", "media_url"]) ??
          readAlias(scope, ["thumbnailURL", "thumbnailUrl", "thumbnail_url"]) ??
          readAlias(ctx, ["mediaURL", "mediaUrl", "media_url"]),
      ),
      source_url: toText(
        readAlias(scope, ["sourceURL", "sourceUrl", "source_url"]) ??
          readAlias(ctx, ["sourceURL", "sourceUrl", "source_url"]),
      ),
    });
  }
  return null;
}

function finalize(
  base: Omit<AdContext, "is_from_ad" | "product_hint">,
): AdContext {
  return {
    is_from_ad: true,
    ...base,
    product_hint: parseProductHint(
      base.campaign_title,
      base.campaign_body,
      base.campaign_name,
    ),
  };
}
