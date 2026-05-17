import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SaleCompleteEditModal from './SaleCompleteEditModal';
import { Condition, DeviceType, StockStatus, WarrantyType } from '../types';

vi.mock('../services/dataContext', () => ({
  useData: () => ({
    customers: [{ id: 'cust-1', name: 'Cliente Teste' }],
    sellers: [{ id: 'seller-1', name: 'Vendedor Teste', storeId: 'store-1' }],
    stock: []
  })
}));

describe('SaleCompleteEditModal', () => {
  it('saves a trade-in-covered sale with no financial payment methods', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <SaleCompleteEditModal
        open
        onClose={vi.fn()}
        onSave={onSave}
        sale={{
          id: 'sale-zero-edit-1',
          customerId: 'cust-1',
          sellerId: 'seller-1',
          storeId: 'store-1',
          items: [{
            id: 'stock-zero-edit-1',
            type: DeviceType.IPHONE,
            model: 'iPhone 15',
            color: 'Preto',
            capacity: '128 GB',
            imei: 'imei-zero-edit-1',
            condition: Condition.USED,
            status: StockStatus.SOLD,
            storeId: 'store-1',
            purchasePrice: 3000,
            sellPrice: 390,
            originalSellPrice: 390,
            maxDiscount: 0,
            warrantyType: WarrantyType.STORE,
            costs: [],
            photos: [],
            entryDate: '2026-05-13'
          }],
          tradeIns: [{
            id: 'sti-zero-edit-1',
            model: 'iPhone Trade',
            capacity: '128 GB',
            color: 'Preto',
            imei: 'trade-zero-edit',
            condition: Condition.USED,
            receivedValue: 390
          }],
          tradeInValue: 390,
          discount: 0,
          total: 0,
          paymentMethods: [],
          date: '2026-05-13T10:00:00.000Z',
          warrantyExpiresAt: null
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Salvar Alterações' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toEqual(expect.objectContaining({
      total: 0,
      tradeInValue: 390,
      paymentMethods: []
    }));
  });
});
