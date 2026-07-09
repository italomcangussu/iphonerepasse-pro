import { render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CRMLeads from './CRMLeads';

const supabaseRpcMock = vi.fn();
const supabaseFromMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('../services/dataContext', () => ({
  useData: () => ({
    stores: [{ id: 'store-1', name: 'Fortaleza' }],
  }),
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    rpc: (...args: any[]) => supabaseRpcMock(...args),
    from: (...args: any[]) => supabaseFromMock(...args),
  },
}));

vi.mock('../components/ui/ToastProvider', () => ({
  useToast: () => ({
    error: toastErrorMock,
    success: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('../components/crm/CRMPageFrame', () => ({
  default: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <>
      <h1>{title}</h1>
      {children}
    </>
  ),
}));

const makeStagesChain = () => {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
  return chain;
};

describe('CRMLeads deep links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    });

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === 'crm_funnel_stages') return makeStagesChain();
      return makeStagesChain();
    });

    supabaseRpcMock.mockImplementation((fn: string, args: Record<string, unknown>) => {
      if (fn === 'search_leads') {
        return Promise.resolve({
          data: {
            items: [
              { id: 'lead-1', store_id: 'store-1', name: 'Maria', phone: '+5585999990000' },
              { id: 'lead-2', store_id: 'store-1', name: 'Joao', phone: '+5585888880000' },
            ],
          },
          error: null,
        });
      }

      if (fn === 'get_lead_full_data') {
        return Promise.resolve({
          data: {
            success: true,
            lead: { id: args.p_lead_id, name: 'Joao', phone: '+5585888880000' },
            traceability: {
              customer_link: {
                customer_id: 'cust-1',
                customer_name: 'Joao Cliente',
                source: 'explicit_customer_id',
                confidence: 'direct',
              },
              ads: {
                is_ad_lead: true,
                source: 'meta_ads',
                campaign_title: 'Campanha iPhone 15',
                source_app: 'facebook',
                sample_source_url: 'https://facebook.example/ad',
              },
              sales: {
                direct: [
                  {
                    id: 'sale-1',
                    sale_number: 42,
                    total: 5390,
                    date: '2026-07-01T12:00:00.000Z',
                  },
                ],
                inferred_by_customer: [],
                direct_revenue: 5390,
                inferred_revenue: 0,
                purchase_count: 1,
                last_sale: {
                  id: 'sale-1',
                  sale_number: 42,
                  total: 5390,
                  date: '2026-07-01T12:00:00.000Z',
                },
              },
            },
          },
          error: null,
        });
      }

      return Promise.resolve({ data: null, error: null });
    });
  });

  it('loads the lead from the route param instead of defaulting to the first lead', async () => {
    render(<CRMLeads initialLeadId="lead-2" />);

    await waitFor(() => {
      expect(supabaseRpcMock).toHaveBeenCalledWith('get_lead_full_data', {
        p_lead_id: 'lead-2',
      });
    });
  });

  it('renders Ads-to-sale traceability for the selected lead', async () => {
    render(<CRMLeads initialLeadId="lead-2" />);

    expect(await screen.findByText('Rastreabilidade')).toBeInTheDocument();
    expect(screen.getByText('Campanha iPhone 15')).toBeInTheDocument();
    expect(screen.getByText('Venda atribuida diretamente')).toBeInTheDocument();
    expect(screen.getByText(/#42/)).toBeInTheDocument();
    expect(screen.getAllByText(/R\$ 5\.390/).length).toBeGreaterThan(0);
  });
});
