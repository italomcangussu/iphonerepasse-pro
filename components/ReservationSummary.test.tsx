import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReservationSummary } from './ReservationSummary';
import type { Seller, StockReservation } from '../types';

const sellers: Seller[] = [
  { id: 'sel-1', name: 'Kauan Lean Lima da Silva', email: 'kauan@teste.com', authUserId: 'u-1', storeId: 'store-1', totalSales: 0 }
];

// Datas locais: o projeto não fixa TZ nos testes.
const localDay = (year: number, month: number, day: number, hour = 12) =>
  new Date(year, month - 1, day, hour, 0, 0);
const now = localDay(2026, 8, 25);

const makeReservation = (overrides: Partial<StockReservation> = {}): StockReservation => ({
  id: 'res-1',
  stockItemId: 'stk-1',
  customerName: 'FRANCISCO CLEBER DO NASCIMENTO FLORENCIO',
  customerPhone: '(88) 99703-7275',
  reservedAt: localDay(2026, 8, 21).toISOString(),
  expiresAt: localDay(2026, 8, 30).toISOString(),
  status: 'active',
  createdAt: localDay(2026, 8, 21).toISOString(),
  updatedAt: localDay(2026, 8, 21).toISOString(),
  ...overrides
});

describe('ReservationSummary', () => {
  it('renders nothing without a reservation', () => {
    const { container } = render(<ReservationSummary reservation={null} sellers={sellers} now={now} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows customer, seller and deposit', () => {
    render(
      <ReservationSummary
        reservation={makeReservation({ sellerId: 'sel-1', depositAmount: 250 })}
        sellers={sellers}
        now={now}
      />
    );

    expect(screen.getByText('FRANCISCO CLEBER DO NASCIMENTO FLORENCIO')).toBeInTheDocument();
    expect(screen.getByText('Kauan Lean Lima da Silva')).toBeInTheDocument();
    expect(screen.getByText(/Sinal R\$ 250,00/)).toBeInTheDocument();
  });

  it('states the deadline as a relative term instead of a raw date', () => {
    render(<ReservationSummary reservation={makeReservation()} sellers={sellers} now={now} />);

    expect(screen.getByText('Vence em 5 dias')).toBeInTheDocument();
    expect(screen.queryByText('30/08/2026')).toBeNull();
  });

  it('calls out a reservation that expires today', () => {
    render(
      <ReservationSummary
        reservation={makeReservation({ expiresAt: localDay(2026, 8, 25).toISOString() })}
        sellers={sellers}
        now={now}
      />
    );

    expect(screen.getByText('Vence hoje')).toBeInTheDocument();
  });

  it('calls out an overdue reservation', () => {
    render(
      <ReservationSummary
        reservation={makeReservation({ expiresAt: localDay(2026, 8, 22).toISOString() })}
        sellers={sellers}
        now={now}
      />
    );

    expect(screen.getByText('Vencida há 3 dias')).toBeInTheDocument();
  });

  it('does not dress "sem sinal" in the success colour used for a paid deposit', () => {
    render(
      <ReservationSummary
        reservation={makeReservation({ depositAmount: null })}
        sellers={sellers}
        now={now}
      />
    );

    const semSinal = screen.getByText('Sem sinal');
    expect(semSinal.className).not.toContain('ios-badge-green');
  });

  it('handles a reservation with no expiry date', () => {
    render(
      <ReservationSummary
        reservation={makeReservation({ expiresAt: null })}
        sellers={sellers}
        now={now}
      />
    );

    expect(screen.getByText('Sem validade')).toBeInTheDocument();
  });
});
