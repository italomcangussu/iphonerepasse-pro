// Primitivas de segurança da assinatura Repasse Care+.
// Regra: token de acesso e OTP nunca são persistidos nem registrados em texto claro.

const encoder = new TextEncoder();

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === "string" ? encoder.encode(data) : data;
  return toHex(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Token de acesso ao link: 32 bytes aleatórios em base64url (não carrega dado pessoal).
export function generateAccessToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const isWellFormedAccessToken = (token: string): boolean => /^[A-Za-z0-9_-]{43}$/.test(token);

// Código de exatamente 6 dígitos, sem viés de módulo (amostragem por rejeição).
export function generateOtp(): string {
  const limit = 4_294_000_000; // maior múltiplo de 1_000_000 abaixo de 2^32
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return String(buf[0] % 1_000_000).padStart(6, "0");
}

export const isSixDigitCode = (code: string): boolean => /^\d{6}$/.test(code);

export interface OtpBinding {
  sessionId: string;
  documentSha256: string;
  code: string;
}

// O verificador amarra o código à sessão e à versão exata do documento.
export const otpVerifier = (secret: string, b: OtpBinding): Promise<string> =>
  hmacSha256Hex(secret, `care-otp:${b.sessionId}:${b.documentSha256}:${b.code}`);

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `${"*".repeat(Math.max(digits.length - 4, 0))}${digits.slice(-4)}`;
}

// IP real do cliente: o gateway do Supabase acrescenta o IP de origem como primeiro item de x-forwarded-for.
export function resolveClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || headers.get("cf-connecting-ip") || headers.get("x-real-ip") || "";
  return /^[0-9a-fA-F:.]{3,45}$/.test(candidate) ? candidate : null;
}

export function sanitizeUserAgent(value: string | null): string | null {
  const ua = (value ?? "").replace(/[\u0000-\u001f]/g, " ").trim();
  return ua ? ua.slice(0, 512) : null;
}

export interface GeoEvidence {
  permission: "concedida" | "nao_compartilhada" | "indisponivel" | "nao_solicitada";
  lat?: number;
  lon?: number;
  accuracy?: number;
  capturedAt?: string;
}

const DECLINED: ReadonlySet<string> = new Set(["nao_compartilhada", "indisponivel"]);

const isValidCoordinate = (lat: number, lon: number): boolean =>
  Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

const roundTo = (value: number, decimals: number): number => Math.round(value * 10 ** decimals) / 10 ** decimals;

const optionalAccuracy = (raw: unknown): number | undefined => {
  const accuracy = Number(raw);
  return Number.isFinite(accuracy) && accuracy >= 0 ? roundTo(accuracy, 2) : undefined;
};

const optionalIsoDate = (raw: unknown): string | undefined =>
  typeof raw === "string" && !Number.isNaN(Date.parse(raw)) ? new Date(raw).toISOString() : undefined;

// Aceita coordenadas só quando o navegador as entregou com permissão; nunca inventa.
export function normalizeGeo(raw: unknown): GeoEvidence {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const permission = String(input.permission ?? "");
  if (DECLINED.has(permission)) return { permission: permission as GeoEvidence["permission"] };
  const lat = Number(input.lat);
  const lon = Number(input.lon);
  if (permission !== "concedida" || !isValidCoordinate(lat, lon)) return { permission: "nao_solicitada" };
  return {
    permission: "concedida",
    lat: roundTo(lat, 6),
    lon: roundTo(lon, 6),
    accuracy: optionalAccuracy(input.accuracy),
    capturedAt: optionalIsoDate(input.capturedAt),
  };
}

export const geoEventColumns = (geo: GeoEvidence) => ({
  geo_permission: geo.permission,
  geo_lat: geo.permission === "concedida" ? geo.lat ?? null : null,
  geo_lon: geo.permission === "concedida" ? geo.lon ?? null : null,
  geo_accuracy_m: geo.permission === "concedida" ? geo.accuracy ?? null : null,
  geo_captured_at: geo.permission === "concedida" ? geo.capturedAt ?? null : null,
});
