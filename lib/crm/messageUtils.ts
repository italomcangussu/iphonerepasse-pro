// Utilities for parsing CRM message payloads (UAZAPI, Instagram).
// Ported from warrantyguard-hdi — adapted to iphonerepasse-pro types.

export interface MetaCampaignPreviewData {
  campaignKey: string;
  campaignName: string;
  sourceID: string | null;
  sourceApp: string;
  title: string | null;
  body: string | null;
  mediaURL: string | null;
  sourceURL: string | null;
  thumbnailURL: string | null;
  ctwaClid: string | null;
  openUrl: string | null;
}

interface ResolveMetaCampaignPreviewInput {
  webhookPayload?: Record<string, unknown> | null;
  fallbackCampaignName?: string | null;
}

// ─── low-level helpers ───────────────────────────────────────────────────────

const withProtocol = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return `https://${trimmed}`;
};

export const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const toNullableText = (value: unknown): string | null => {
  const trimmed = String(value || '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

const looksLikeBase64Image = (value: string): boolean => {
  if (!value || value.length < 128) return false;
  return /^[A-Za-z0-9+/_=-]+$/.test(value);
};

export const readAliasValue = (record: Record<string, unknown> | null, keys: string[]): unknown => {
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
};

const normalizeText = (value: unknown): string =>
  String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const normalizeTextToken = (value: unknown): string =>
  normalizeText(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

const isTrueLike = (value: unknown): boolean => {
  if (value === true || value === 1) return true;
  const normalized = normalizeTextToken(value);
  return normalized === 'true' || normalized === '1';
};

// ─── Meta campaign detection ──────────────────────────────────────────────────

const normalizeMetaOriginToken = (value: unknown): string => {
  const normalized = normalizeTextToken(value);
  if (!normalized) return '';
  const parts = new Set(normalized.split('_').filter(Boolean));
  const hasAds = parts.has('ad') || parts.has('ads') || parts.has('advertisement') || parts.has('anuncio') || parts.has('anuncios');
  if (hasAds && (parts.has('fb') || parts.has('facebook') || parts.has('meta'))) return 'fb_ads';
  if (hasAds && parts.has('ctwa')) return 'ctwa_ad';
  return normalized;
};

const normalizeMetaSourceTypeToken = (value: unknown): string => {
  const normalized = normalizeTextToken(value);
  if (!normalized) return '';
  const parts = new Set(normalized.split('_').filter(Boolean));
  if (parts.has('ad') || parts.has('ads') || parts.has('advertisement') || parts.has('sponsored') || parts.has('anuncio')) return 'ad';
  return normalized;
};

const normalizeMetaSourceApp = (value: unknown): string => {
  const normalized = normalizeMetaOriginToken(value);
  if (normalized.includes('face') || new Set(normalized.split('_').filter(Boolean)).has('fb')) return 'facebook';
  return 'instagram';
};

const isMetaCampaignContext = (contextInfo: Record<string, unknown>, externalAdReply: Record<string, unknown> | null): boolean => {
  const conversionSource = normalizeMetaOriginToken(readAliasValue(contextInfo, ['conversionSource', 'conversion_source', 'entryPointConversionExternalSource', 'entry_point_conversion_external_source']));
  const entryPointSource = normalizeMetaOriginToken(readAliasValue(contextInfo, ['entryPointConversionSource', 'entry_point_conversion_source']));
  const sourceType = normalizeMetaSourceTypeToken(
    readAliasValue(externalAdReply, ['sourceType', 'source_type']) ?? readAliasValue(contextInfo, ['sourceType', 'source_type'])
  );
  const showAdAttribution = isTrueLike(
    readAliasValue(externalAdReply, ['showAdAttribution', 'show_ad_attribution']) ?? readAliasValue(contextInfo, ['showAdAttribution', 'show_ad_attribution'])
  );
  return conversionSource === 'fb_ads' || entryPointSource === 'ctwa_ad' || sourceType === 'ad' || showAdAttribution;
};

const toMetaThumbnailUrl = (value: unknown): string | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw.startsWith('data:image/')) return raw;
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('//')) return withProtocol(raw);
  const compact = raw.replace(/\s+/g, '');
  if (!looksLikeBase64Image(compact)) return null;
  return `data:image/jpeg;base64,${compact}`;
};

const resolveMetaThumbnailUrl = (...candidates: unknown[]): string | null => {
  let bestHttpUrl: string | null = null;
  let bestHttpScore = -1;
  let firstDataUri: string | null = null;
  for (const candidate of candidates) {
    const resolved = toMetaThumbnailUrl(candidate);
    if (!resolved) continue;
    if (resolved.startsWith('data:image/')) { if (!firstDataUri) firstDataUri = resolved; continue; }
    let score = 0;
    if (resolved.includes('?')) score += 3;
    if (resolved.includes('&')) score += 1;
    if (resolved.includes('oh=') || resolved.includes('oe=')) score += 4;
    if (resolved.includes('_nc_')) score += 2;
    score += Math.min(resolved.length / 1024, 2);
    if (score > bestHttpScore) { bestHttpScore = score; bestHttpUrl = resolved; }
  }
  return bestHttpUrl || firstDataUri;
};

const normalizeMetaCampaignKey = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '') || 'meta_campaign';

const extractMetaCampaignKeyFromUrl = (value: unknown): string => {
  const rawUrl = String(value || '').trim();
  if (!rawUrl) return '';
  try {
    const parsed = new URL(withProtocol(rawUrl));
    const ignored = new Set(['p', 'reel', 'ads', 'ad', 'campaign', 'anuncio', 'anuncios']);
    const segments = parsed.pathname.split('/').map((s) => decodeURIComponent(s).trim()).filter(Boolean);
    for (let i = segments.length - 1; i >= 0; i--) {
      const s = segments[i];
      if (!s || ignored.has(s.toLowerCase())) continue;
      const n = normalizeMetaCampaignKey(s);
      if (n) return n;
    }
    return normalizeMetaCampaignKey(parsed.hostname.split('.')[0] || '');
  } catch { return ''; }
};

const collectNestedRecords = (value: unknown, maxDepth = 5, visited = new Set<Record<string, unknown>>()): Record<string, unknown>[] => {
  if (maxDepth < 0) return [];
  const record = asRecord(value);
  if (!record || visited.has(record)) return [];
  visited.add(record);
  const items: Record<string, unknown>[] = [record];
  if (maxDepth === 0) return items;
  for (const nested of Object.values(record)) {
    if (!nested || typeof nested !== 'object') continue;
    items.push(...collectNestedRecords(nested, maxDepth - 1, visited));
  }
  return items;
};

const buildMetaCampaignPreviewData = (args: {
  campaignKey: string; sourceID: string | null; sourceApp: string; title: string | null; body: string | null;
  mediaURL: string | null; sourceURL: string | null; thumbnailURL: string | null; ctwaClid: string | null;
  campaignNameFallback: string | null; payloadCampaignName?: string | null;
}): MetaCampaignPreviewData => {
  const { campaignKey, sourceID, sourceApp, title, body, mediaURL, sourceURL, thumbnailURL, ctwaClid, campaignNameFallback, payloadCampaignName } = args;
  const campaignName = payloadCampaignName || campaignNameFallback || sourceID || campaignKey;
  const openUrl = mediaURL || sourceURL;
  return { campaignKey, campaignName, sourceID, sourceApp, title, body, mediaURL, sourceURL, thumbnailURL, ctwaClid, openUrl: openUrl ? withProtocol(openUrl) : null };
};

export function resolveMetaCampaignPreviewData(input: ResolveMetaCampaignPreviewInput): MetaCampaignPreviewData | null {
  const payloadRecord = asRecord(input.webhookPayload);
  if (!payloadRecord) return null;
  const campaignNameFallback = toNullableText(input.fallbackCampaignName);

  const directMetaCampaign = asRecord(readAliasValue(payloadRecord, ['metaCampaign', 'meta_campaign']));
  if (directMetaCampaign) {
    const flag = readAliasValue(directMetaCampaign, ['isMetaCampaign', 'is_meta_campaign']);
    const isMetaCampaign = flag === undefined ? true : !(flag === false || normalizeTextToken(flag) === 'false' || normalizeTextToken(flag) === '0');
    if (isMetaCampaign) {
      const sourceID = toNullableText(readAliasValue(directMetaCampaign, ['sourceID', 'sourceId', 'source_id']));
      const mediaURL = toNullableText(readAliasValue(directMetaCampaign, ['mediaURL', 'mediaUrl', 'media_url']));
      const sourceURL = toNullableText(readAliasValue(directMetaCampaign, ['sourceURL', 'sourceUrl', 'source_url']));
      const campaignKey = toNullableText(readAliasValue(directMetaCampaign, ['campaignKey', 'campaign_key'])) || sourceID || extractMetaCampaignKeyFromUrl(sourceURL) || extractMetaCampaignKeyFromUrl(mediaURL) || 'meta_campaign';
      return buildMetaCampaignPreviewData({
        campaignKey, sourceID,
        sourceApp: normalizeMetaSourceApp(readAliasValue(directMetaCampaign, ['sourceApp', 'source_app'])),
        title: toNullableText(readAliasValue(directMetaCampaign, ['title'])),
        body: toNullableText(readAliasValue(directMetaCampaign, ['body'])),
        mediaURL, sourceURL,
        thumbnailURL: resolveMetaThumbnailUrl(readAliasValue(directMetaCampaign, ['thumbnailURL', 'thumbnailUrl', 'thumbnail_url']), readAliasValue(directMetaCampaign, ['thumbnail'])),
        ctwaClid: toNullableText(readAliasValue(directMetaCampaign, ['ctwaClid', 'ctwa_clid'])),
        campaignNameFallback,
        payloadCampaignName: toNullableText(readAliasValue(directMetaCampaign, ['campaignName', 'campaign_name'])),
      });
    }
  }

  const records = collectNestedRecords(payloadRecord, 7);
  const seenContexts = new Set<Record<string, unknown>>();

  for (const record of records) {
    const possibleContextCandidates: Array<Record<string, unknown> | null> = [
      asRecord(readAliasValue(record, ['contextInfo', 'context_info'])),
      (
        readAliasValue(record, ['conversionSource', 'conversion_source']) !== undefined ||
        readAliasValue(record, ['entryPointConversionSource', 'entry_point_conversion_source']) !== undefined ||
        readAliasValue(record, ['sourceType', 'source_type']) !== undefined ||
        readAliasValue(record, ['showAdAttribution', 'show_ad_attribution']) !== undefined ||
        readAliasValue(record, ['externalAdReply', 'external_ad_reply']) !== undefined
      ) ? record : null,
    ];

    for (const ctx of possibleContextCandidates) {
      if (!ctx || seenContexts.has(ctx)) continue;
      seenContexts.add(ctx);

      const shouldUseCtxAsExternalAdReply = (
        readAliasValue(ctx, ['sourceType', 'source_type']) !== undefined &&
        (readAliasValue(ctx, ['mediaURL', 'mediaUrl', 'media_url']) !== undefined || readAliasValue(ctx, ['sourceID', 'sourceId', 'source_id']) !== undefined)
      );
      const externalAdReply = asRecord(readAliasValue(ctx, ['externalAdReply', 'external_ad_reply'])) || (shouldUseCtxAsExternalAdReply ? ctx : null);

      if (!isMetaCampaignContext(ctx, externalAdReply)) continue;

      const sourceID = toNullableText(readAliasValue(externalAdReply, ['sourceID', 'sourceId', 'source_id']) ?? readAliasValue(ctx, ['sourceID', 'sourceId', 'source_id']));
      const mediaURL = toNullableText(readAliasValue(externalAdReply, ['mediaURL', 'mediaUrl', 'media_url']) ?? readAliasValue(ctx, ['mediaURL', 'mediaUrl', 'media_url']));
      const sourceURL = toNullableText(readAliasValue(externalAdReply, ['sourceURL', 'sourceUrl', 'source_url']) ?? readAliasValue(ctx, ['sourceURL', 'sourceUrl', 'source_url']));
      const campaignKey = sourceID || extractMetaCampaignKeyFromUrl(sourceURL) || extractMetaCampaignKeyFromUrl(mediaURL) || 'meta_campaign';
      const sourceApp = normalizeMetaSourceApp(readAliasValue(externalAdReply, ['sourceApp', 'source_app']) ?? readAliasValue(ctx, ['entryPointConversionApp', 'entry_point_conversion_app']) ?? readAliasValue(ctx, ['sourceApp', 'source_app']));

      return buildMetaCampaignPreviewData({
        campaignKey, sourceID, sourceApp,
        title: toNullableText(readAliasValue(externalAdReply, ['title']) ?? readAliasValue(ctx, ['title'])),
        body: toNullableText(readAliasValue(externalAdReply, ['body']) ?? readAliasValue(ctx, ['body'])),
        mediaURL, sourceURL,
        thumbnailURL: resolveMetaThumbnailUrl(
          readAliasValue(externalAdReply, ['thumbnailURL', 'thumbnailUrl', 'thumbnail_url']),
          readAliasValue(externalAdReply, ['thumbnail']),
          readAliasValue(ctx, ['thumbnailURL', 'thumbnailUrl', 'thumbnail_url']),
          readAliasValue(ctx, ['thumbnail'])
        ),
        ctwaClid: toNullableText(readAliasValue(externalAdReply, ['ctwaClid', 'ctwa_clid']) ?? readAliasValue(ctx, ['ctwaClid', 'ctwa_clid'])),
        campaignNameFallback,
        payloadCampaignName: toNullableText(readAliasValue(externalAdReply, ['campaignName', 'campaign_name']) ?? readAliasValue(ctx, ['campaignName', 'campaign_name'])),
      });
    }
  }
  return null;
}
