import { render, waitFor } from '@testing-library/react';
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
          data: { success: true, lead: { id: args.p_lead_id, name: 'Joao', phone: '+5585888880000' } },
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
});
