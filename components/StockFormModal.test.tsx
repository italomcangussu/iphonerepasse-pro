import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StockFormModal } from './StockFormModal';
import { Condition, DeviceType, StockStatus, WarrantyType, type StockItem } from '../types';

const useDataMock = vi.fn();
const uploadImageMock = vi.fn();
const removeImageMock = vi.fn();
const removeImagesMock = vi.fn();
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
  removeImage: (...args: unknown[]) => removeImageMock(...args),
  removeImages: (...args: unknown[]) => removeImagesMock(...args),
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

  it('opens the native photo picker only after the contextual action is confirmed', async () => {
    const user = userEvent.setup();

    render(
      <StockFormModal
        open
        initialData={baseItem}
        onClose={vi.fn()}
        draftContext="inventory"
      />
    );

    const galleryInput = document.querySelector('input[type="file"][multiple]') as HTMLInputElement;
    const clickSpy = vi.spyOn(galleryInput, 'click');

    await user.click(screen.getByRole('button', { name: 'Estado e Fotos' }));
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    await user.click(screen.getByRole('button', { name: /^Escolher arquivo/i }));

    expect(clickSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Escolher fotos' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Escolher fotos' }));

    expect(clickSpy).toHaveBeenCalledOnce();
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

  it('saves observations as empty when cleared while editing', async () => {
    const user = userEvent.setup();

    render(
      <StockFormModal
        open
        initialData={{ ...baseItem, notes: 'Trocar tela', observations: 'Trocar tela' }}
        onClose={vi.fn()}
        draftContext="inventory"
      />
    );

    await user.click(screen.getByRole('button', { name: /Próximo/i }));

    const observationsInput = screen.getByPlaceholderText(/trocar tela e voltar bateria/i);
    await user.clear(observationsInput);

    await user.click(screen.getByRole('button', { name: /Próximo/i }));
    await user.click(screen.getByRole('button', { name: /Salvar Alterações/i }));

    await waitFor(() => expect(updateStockItemMock).toHaveBeenCalledTimes(1));
    expect(updateStockItemMock).toHaveBeenCalledWith(
      'stk-1',
      expect.objectContaining({
        notes: '',
        observations: '',
      })
    );
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

  it('prevents duplicate inserts when the save action is clicked twice', async () => {
    const user = userEvent.setup();
    let resolveAdd: (() => void) | undefined;
    addStockItemMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveAdd = resolve;
        })
    );

    render(
      <StockFormModal
        open
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getAllByRole('combobox')[1]);
    await user.click(screen.getByRole('option', { name: 'iPhone 15' }));
    await user.click(screen.getByRole('button', { name: /Próximo/i }));
    await user.click(screen.getAllByRole('radio')[0]);
    await user.click(screen.getByRole('button', { name: /Próximo/i }));
    await user.type(screen.getByLabelText(/Preço de Venda/i), '420000');

    const saveButton = screen.getByRole('button', { name: /Concluir Cadastro/i });
    await user.dblClick(saveButton);

    await waitFor(() => expect(addStockItemMock).toHaveBeenCalledTimes(1));
    expect(saveButton).toBeDisabled();

    resolveAdd?.();
    await waitFor(() => expect(toastApi.success).toHaveBeenCalledWith('Aparelho cadastrado com sucesso!'));
  });

  it('asks toast confirmation and calls onDelete when confirmed', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);

    render(
      <StockFormModal
        open
        initialData={baseItem}
        onClose={vi.fn()}
        onDelete={onDelete}
        draftContext="inventory"
      />
    );

    await user.click(screen.getByRole('button', { name: /^Excluir$/i }));

    expect(toastApi.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'danger',
        confirmLabel: expect.stringMatching(/excluir/i),
      })
    );
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
  });
});
