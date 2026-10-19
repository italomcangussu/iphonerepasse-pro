import type { CareCondition } from './careTypes';

export type CareSignSessionStatus = 'aberta' | 'aceita' | 'assinada' | 'expirada' | 'revogada' | 'bloqueada';

export interface CareSignView {
  session: {
    status: CareSignSessionStatus;
    viewed: boolean;
    linkExpiresAt: string;
    signedAt: string | null;
    otpPending: boolean;
    resendAvailableAt: string | null;
  };
  otp: { length: number; ttlMinutes: number; phoneMasked: string };
  acceptance: { version: string; text: string };
  document: { version: number; sha256: string; url: string | null; signedUrl: string | null };
  contract: {
    number: number;
    status: string;
    contractor: string;
    customer: { name: string; cpfMasked: string | null; phoneMasked: string };
    device: { model: string; capacity: string | null; color: string | null; imeiMasked: string | null; condition: CareCondition };
    values: {
      salePrice: number;
      firstAmount: number;
      recurringPercent: number;
      subsequentCount: number;
      recurringAmount: number;
      totalProgrammed: number;
      billingIntervalMonths: number;
      firstSubsequentDueMonths: number;
      deductibleModality: 'PERCENTUAL' | 'VALOR_FIXO';
      deductibleRate: number;
      deductibleAmount: number;
      termMonths: number;
    };
    bonuses: Array<{ name: string; quantity: number; description: string | null }>;
    servicesDescription: string | null;
    usageLimits: string | null;
    preventiveCheckupMonths: number | null;
    suspensionGraceDays: number;
  };
}
