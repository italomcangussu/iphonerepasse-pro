import type { Sale } from '../../types';
import type { CampaignSegment, CustomerRfm } from './campaigns';

export const RFM_BROADCAST_RECIPIENT_LIMIT = 500;

export interface RfmRecipientResolution {
  targetCustomers: number;
  linkedCustomers: number;
  unlinkedCustomers: number;
  omittedByLimit: number;
  leadIds: string[];
}

export interface ResolveRfmRecipientsInput {
  customers: CustomerRfm[];
  sales: Sale[];
  storeId: string;
  segment: CampaignSegment;
  limit?: number;
}

interface LinkedSale {
  leadId: string;
  dateTime: number;
  saleId: string;
}

function isMoreRecent(candidate: LinkedSale, current: LinkedSale): boolean {
  if (candidate.dateTime !== current.dateTime) return candidate.dateTime > current.dateTime;
  return candidate.saleId.localeCompare(current.saleId) > 0;
}

function cleanLeadId(value: string | null | undefined): string | null {
  const leadId = String(value || '').trim();
  return leadId || null;
}

/**
 * Converte um segmento RFM em uma audiência CRM imutável. O vínculo vem da
 * venda da mesma loja, que já é resolvido conservadoramente pelo banco.
 */
export function resolveRfmRecipients({
  customers,
  sales,
  storeId,
  segment,
  limit = RFM_BROADCAST_RECIPIENT_LIMIT,
}: ResolveRfmRecipientsInput): RfmRecipientResolution {
  const target = customers
    .filter((customer) => customer.segment === segment)
    .sort((a, b) => b.monetary - a.monetary || a.customerId.localeCompare(b.customerId));
  const targetIds = new Set(target.map((customer) => customer.customerId));
  const latestByCustomer = new Map<string, LinkedSale>();

  for (const sale of sales) {
    if (sale.storeId !== storeId || !targetIds.has(sale.customerId)) continue;
    const leadId = cleanLeadId(sale.crmLeadId);
    if (!leadId) continue;

    const candidate: LinkedSale = {
      leadId,
      dateTime: Number.isFinite(Date.parse(sale.date)) ? Date.parse(sale.date) : Number.NEGATIVE_INFINITY,
      saleId: sale.id,
    };
    const current = latestByCustomer.get(sale.customerId);
    if (!current || isMoreRecent(candidate, current)) {
      latestByCustomer.set(sale.customerId, candidate);
    }
  }

  const allLeadIds: string[] = [];
  const seenLeadIds = new Set<string>();
  let linkedCustomers = 0;
  for (const customer of target) {
    const linked = latestByCustomer.get(customer.customerId);
    if (!linked) continue;
    linkedCustomers += 1;
    if (seenLeadIds.has(linked.leadId)) continue;
    seenLeadIds.add(linked.leadId);
    allLeadIds.push(linked.leadId);
  }

  const safeLimit = Math.max(0, Math.floor(limit));
  return {
    targetCustomers: target.length,
    linkedCustomers,
    unlinkedCustomers: target.length - linkedCustomers,
    omittedByLimit: Math.max(0, allLeadIds.length - safeLimit),
    leadIds: allLeadIds.slice(0, safeLimit),
  };
}
