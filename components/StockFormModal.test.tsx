import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StockFormModal } from './StockFormModal';
import { Condition, DeviceType, StockStatus, WarrantyType, type StockItem } from '../types';

const useDataMock = vi.fn();
const uploadImageMock = vi.fn();
const updateStockItemMock = vi.fn();
const addStockItemMock = vi.fn();

const toastApi = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  confirm: vi.fn().mockResolvedValue(true),
  dismiss: vi.fn(),
  clear: vi.fn(),
};

vi.mock('../services/dataContext', () => ({
  useData: () => useDataMock(),
}));

vi.mock('../components/ui/ToastProvider', () => ({
  useToast: () => toastApi,
}));

vi.mock('../services/storage', () => ({
  uploadImage: (...args: unknown[]) => uploadImageMock(...args),
}));

const baseItem: StockItem = {
  id: 'stk-1',
  type: DeviceType.IPHONE,
  model: 'iPhone 15',
  color: 'Preto',
  hasBox: false,
  capacity: '128 GB',
  imei: '111111111111111',
  condition: Condition.USED,
  status: StockStatus.AVAILABLE,
  batteryHealth: 90,
  storeId: 'store-1',
  purchasePrice: 3000,
  sellPrice: 4200,
  maxDiscount: 0,
  warrantyType: WarrantyType.STORE,
  warrantyEnd: '',
  origin: '',
  notes: '',
  observations: '',
  costs: [],
  photos: [],
  entryDate: '2026-04-17T00:00:00.000Z',
};

describe('StockFormModal photo queue workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useDataMock.mockReturnValue({
      addStockItem: addStockItemMock,
      updateStockItem: updateStockItemMock,
      stores: [{ id: 'store-1', name: 'Matriz', city: 'Fortaleza' }],
      addCostHistory: vi.fn(),
      getCostHistoryByModel: vi.fn(() => []),
      addCostToItem: vi.fn(),
      partsInventory: [],
      addPartCostToItem: vi.fn(),
      deviceCatalog: [],
      addDeviceCatalogItem: vi.fn(),
    });
  });

  it('auto-uploads on save and blocks completion when upload fails', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    uploadImageMock.mockRejectedValueOnce(new Error('network'));

    render(
      <StockFormModal
        open
        initialData={baseItem}
        onClose={onClose}
        draftContext="inventory"
      />
    );

    const galleryInput = document.querySelector('input[type="file"][multiple]') as HTMLInputElement | null;
    expect(galleryInput).not.toBeNull();
    const file = new File([new Uint8Array(1024)], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(galleryInput as HTMLInputElement, { target: { files: [file] } });

    await user.click(screen.getByRole('button', { name: /Próximo/i }));
    await user.click(screen.getByRole('button', { name: /Próximo/i }));
    await user.click(screen.getByRole('button', { name: /Salvar Alterações/i }));

    await waitFor(() => expect(uploadImageMock).toHaveBeenCalledTimes(1));

    expect(updateStockItemMock).not.toHaveBeenCalled();
    expect(toastApi.info).toHaveBeenCalledWith('Resolva as fotos com falha para concluir o cadastro.');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('uploads queued photos manually and moves them to uploaded gallery', async () => {
    const user = userEvent.setup();
    uploadImageMock.mockResolvedValueOnce('https://cdn.test/photo-1.jpg');

    render(
      <StockFormModal
        open
        initialData={baseItem}
        onClose={vi.fn()}
        draftContext="inventory"
      />
    );

    const galleryInput = document.querySelector('input[type="file"][multiple]') as HTMLInputElement | null;
    expect(galleryInput).not.toBeNull();
    const file = new File([new Uint8Array(1024)], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(galleryInput as HTMLInputElement, { target: { files: [file] } });

    await user.click(screen.getByRole('button', { name: /Próximo/i }));

    await user.click(screen.getByRole('button', { name: /Enviar fotos \(1\)/i }));

    await waitFor(() => expect(uploadImageMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText('Fila local')).not.toBeInTheDocument());
    expect(screen.getByAltText('Foto enviada 1')).toBeInTheDocument();
  });

  it('formats acquisition cost as BRL and replaces the initial zero when typing', async () => {
    const user = userEvent.setup();

    render(
      <StockFormModal
        open
        onClose={vi.fn()}
        draftContext="inventory"
      />
    );

    await user.click(screen.getByRole('button', { name: /Próximo/i }));
    await user.click(screen.getByRole('button', { name: /Próximo/i }));

    const acquisitionCostInput = screen.getByLabelText(/Custo de Aquisição/i);
    expect(acquisitionCostInput).toHaveValue('R$ 0,00');

    await user.type(acquisitionCostInput, '1');

    expect(acquisitionCostInput).toHaveValue('R$ 0,01');
  });
});
