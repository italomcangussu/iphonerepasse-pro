import { assert, assertEquals, assertMatch, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
import {
  acceptanceText,
  buildContractClauses,
  buildContractSummary,
  type CareContractTextData,
  contractTermMonths,
} from "./contract_text.ts";
import { renderContractPdf, renderSignedPdf } from "./contract_pdf.ts";
import {
  generateAccessToken,
  generateOtp,
  isSixDigitCode,
  isWellFormedAccessToken,
  maskPhone,
  normalizeGeo,
  otpVerifier,
  resolveClientIp,
  sha256Hex,
  timingSafeEqualHex,
} from "./security.ts";

const contract = (overrides: Partial<CareContractTextData["values"]> = {}): CareContractTextData => ({
  contractNumber: 42,
  documentVersion: 1,
  clausesVersion: "RC-2026.10-v1",
  issuedAt: new Date("2026-10-15T12:00:00Z"),
  contractor: { legalName: "iPhone Repasse LTDA", cnpj: "12345678000190", address: "Rua A, 1 — Fortaleza/CE" },
  customer: { name: "Maria Silva", cpf: "12345678901", phone: "85999990000" },
  device: { model: "iPhone 13", capacity: "128GB", color: "Azul", imei: "356789012345678", condition: "SEMINOVO" },
  sale: { number: 1234, date: "2026-10-15T11:00:00Z" },
  values: {
    salePrice: 2000,
    firstAmount: 199,
    recurringPercent: 4,
    subsequentCount: 12,
    recurringAmount: 80,
    subsequentTotal: 960,
    totalProgrammed: 1159,
    billingIntervalMonths: 1,
    firstSubsequentDueMonths: 1,
    deductibleModality: "PERCENTUAL",
    deductibleRate: 15,
    deductibleAmount: 300,
    ...overrides,
  },
  bonuses: [{ name: "Kit capa + película premium", quantity: 1, description: "Capa e película" }],
  servicesDescription: null,
  usageLimits: null,
});

const allText = (d: CareContractTextData): string =>
  [
    ...buildContractSummary(d).flatMap((g) => g.rows.flat()),
    ...buildContractClauses(d).flatMap((s) => [s.title, ...s.paragraphs]),
  ].join("\n");

Deno.test("OTP tem exatamente 6 dígitos e varia", () => {
  const codes = new Set(Array.from({ length: 200 }, generateOtp));
  for (const code of codes) assert(isSixDigitCode(code), code);
  assert(codes.size > 150);
  assert(!isSixDigitCode("12345") && !isSixDigitCode("1234567") && !isSixDigitCode("12a456"));
});

Deno.test("verificador do OTP amarra código, sessão e documento", async () => {
  const bind = (sessionId: string, documentSha256: string, code: string) => otpVerifier("s", { sessionId, documentSha256, code });
  const base = await bind("sess", "doc", "123456");
  assertEquals(base, await bind("sess", "doc", "123456"));
  assertNotEquals(base, await bind("sess", "doc", "123457"));
  assertNotEquals(base, await bind("outra", "doc", "123456"));
  assertNotEquals(base, await bind("sess", "doc-v2", "123456"));
  assert(!base.includes("123456"));
  assert(timingSafeEqualHex(base, base) && !timingSafeEqualHex(base, base.slice(1)));
});

Deno.test("token de acesso tem 256 bits em base64url, sem dado pessoal", () => {
  const token = generateAccessToken();
  assert(isWellFormedAccessToken(token));
  assertNotEquals(token, generateAccessToken());
  assert(!isWellFormedAccessToken("abc"));
});

Deno.test("geolocalização nunca é inventada", () => {
  assertEquals(normalizeGeo({ permission: "nao_compartilhada", lat: 1, lon: 2 }), { permission: "nao_compartilhada" });
  assertEquals(normalizeGeo({ permission: "concedida" }), { permission: "nao_solicitada" });
  assertEquals(normalizeGeo(null), { permission: "nao_solicitada" });
  assertEquals(normalizeGeo({ permission: "concedida", lat: 120, lon: 2 }).permission, "nao_solicitada");
  const granted = normalizeGeo({ permission: "concedida", lat: -3.7319, lon: -38.5267, accuracy: 12.345 });
  assertEquals(granted, { permission: "concedida", lat: -3.7319, lon: -38.5267, accuracy: 12.35, capturedAt: undefined });
});

Deno.test("IP vem do primeiro x-forwarded-for e é validado", () => {
  assertEquals(resolveClientIp(new Headers({ "x-forwarded-for": "200.1.2.3, 10.0.0.1" })), "200.1.2.3");
  assertEquals(resolveClientIp(new Headers({ "x-forwarded-for": "<script>" })), null);
  assertEquals(resolveClientIp(new Headers()), null);
  assertEquals(maskPhone("5585999990000"), "*********0000");
});

Deno.test("contrato deixa explícito 1 inicial + N seguintes e a base de cálculo", () => {
  const text = allText(contract());
  assertMatch(text, /1 inicial \+ 12 seguinte/);
  assertMatch(text, /12 × R\$\s?80,00 \(4% do preço efetivo\)/);
  assertMatch(text, /R\$\s?1\.159,00/);
  assertMatch(text, /15% do preço efetivo de venda do Aparelho, R\$\s?2\.000,00/);
  assertMatch(text, /Não há outra taxa de adesão além da 1ª parcela/);
});

Deno.test("contrato é de serviço, não de seguro", () => {
  const text = allText(contract());
  assertMatch(text, /NÃO constitui contrato de seguro/);
  assertMatch(text, /art\. 10, § 2º, da Medida Provisória nº 2\.200-2\/2001/);
  assertMatch(text, /não é assinatura qualificada no padrão ICP-Brasil/);
  assertMatch(text, /art\. 49 do CDC/);
  assertMatch(text, /domicílio do\(a\) CONTRATANTE/);
  // "seguro" só aparece para negar a natureza securitária.
  const mentions = text.match(/segur[oa]/gi) ?? [];
  const allowed = text.match(/contrato de seguro|garantia estendida securitária|sociedade seguradora|link seguro|página segura|segurança/gi) ?? [];
  assertEquals(mentions.length <= allowed.length, true);
});

Deno.test("franquia fixa e contrato sem bônus nem parcelas seguintes", () => {
  const text = allText({
    ...contract({ deductibleModality: "VALOR_FIXO", deductibleRate: 300, deductibleAmount: 300, subsequentCount: 0, subsequentTotal: 0, totalProgrammed: 199 }),
    bonuses: [],
  });
  assertMatch(text, /R\$\s?300,00 por atendimento executado \(valor fixo\)/);
  assertMatch(text, /não inclui benefício de adesão/);
  assertMatch(text, /Não há parcelas seguintes/);
});

Deno.test("vigência cobre o período da última parcela", () => {
  assertEquals(contractTermMonths(contract().values), 13);
  assertEquals(contractTermMonths(contract({ subsequentCount: 0 }).values), 1);
  assertEquals(contractTermMonths(contract({ firstSubsequentDueMonths: 0, billingIntervalMonths: 2, subsequentCount: 6 }).values), 12);
});

Deno.test("texto de aceite identifica contrato e versões", () => {
  assertEquals(
    acceptanceText(42, 2, "RC-2026.10-v1"),
    "Li e concordo com o contrato Repasse Care+ nº 42 (documento versão 2, cláusulas RC-2026.10-v1) e quero assinar eletronicamente.",
  );
});

Deno.test("PDF emitido e PDF assinado preservam o original e têm hashes próprios", async () => {
  const original = await renderContractPdf(contract());
  assertEquals(new TextDecoder().decode(original.slice(0, 5)), "%PDF-");
  const originalPages = (await PDFDocument.load(original)).getPageCount();
  assert(originalPages >= 3);

  const signed = await renderSignedPdf(original, {
    contractNumber: 42,
    documentVersion: 1,
    documentSha256: await sha256Hex(original),
    signerName: "Maria Silva",
    signerCpfMasked: "***.456.***-01",
    signerPhoneMasked: "*********0000",
    signedAtUtc: "2026-10-15T12:05:00.000Z",
    method: "OTP",
    events: [{
      occurredAt: "2026-10-15T12:05:00.000Z",
      type: "contrato_assinado",
      source: "assinante",
      ip: "200.1.2.3",
      userAgent: "Mozilla/5.0 (iPhone)",
      whatsappMessageId: null,
      geo: "não compartilhada pelo assinante",
      hash: "a".repeat(64),
    }],
    chainLastHash: "a".repeat(64),
  });
  assertEquals((await PDFDocument.load(signed)).getPageCount(), originalPages + 1);
  assertNotEquals(await sha256Hex(signed), await sha256Hex(original));
});
