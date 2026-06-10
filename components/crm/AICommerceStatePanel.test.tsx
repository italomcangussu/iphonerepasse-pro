import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AICommerceStatePanel from './AICommerceStatePanel';

describe('AICommerceStatePanel', () => {
  it('shows the deterministic trade-in gate and missing answers', () => {
    render(
      <AICommerceStatePanel
        loading={false}
        snapshot={{
          stateVersion: 4,
          commerceState: {
            has_trade_in: true,
            next_action: 'send_tradein_questionnaire',
            simulation_mode: 'comparison',
          },
          tradeInAssessment: {
            consentStatus: 'granted',
            capacity: '128GB',
            color: 'preto',
            scratches: false,
            liquidContact: false,
            sideMarks: null,
            partsSwapped: null,
            hasBoxCable: true,
            batteryPct: 86,
            appleWarranty: false,
          },
          quoteVersions: [{ id: 'quote-1' }, { id: 'quote-2' }],
          lastEvent: {
            action: 'send_tradein_questionnaire',
            outcome: 'waiting_customer',
            createdAt: '2026-06-10T12:00:00.000Z',
          },
        }}
      />,
    );

    expect(screen.getByText('Questionário de troca pendente')).toBeInTheDocument();
    expect(screen.getByText('Marcas laterais')).toBeInTheDocument();
    expect(screen.getByText('Peças trocadas')).toBeInTheDocument();
    expect(screen.getByText('Comparação')).toBeInTheDocument();
    expect(screen.getByText('2 versões')).toBeInTheDocument();
  });

  it('shows an empty operational state without implying a failure', () => {
    render(<AICommerceStatePanel loading={false} snapshot={null} />);

    expect(screen.getByText('Estado comercial ainda não iniciado')).toBeInTheDocument();
  });
});
