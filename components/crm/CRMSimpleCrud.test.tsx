import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CRMSimpleCrud from './CRMSimpleCrud';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('../../services/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock('../ui/ToastProvider', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    confirm: vi.fn(),
    dismiss: vi.fn(),
    clear: vi.fn(),
  }),
}));

vi.mock('./useCRMStore', () => ({
  useCRMStore: () => ({ selectedStoreId: 'store-1' }),
}));

describe('CRMSimpleCrud', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [{ id: 'row-1', name: 'Script WhatsApp', description: 'Atendimento inicial' }],
          error: null,
        }),
      }),
    });
  });

  it('opens row actions from desktop right-click and reuses edit flow', async () => {
    const user = userEvent.setup();
    render(
      <CRMSimpleCrud
        table="crm_test"
        title="Scripts"
        description="Cadastro de scripts"
        fields={[
          { key: 'name', label: 'Nome', required: true },
          { key: 'description', label: 'Descrição' },
        ]}
        columns={[
          { key: 'name', label: 'Nome' },
          { key: 'description', label: 'Descrição' },
        ]}
        defaultValues={{ name: '', description: '' }}
        requireStore={false}
      />,
    );

    const rowLabels = await screen.findAllByText('Script WhatsApp');
    const row = rowLabels.map((label) => label.closest('tr')).find(Boolean);
    expect(row).not.toBeNull();

    fireEvent.contextMenu(row!, { clientX: 200, clientY: 240 });

    expect(screen.getByRole('menu', { name: /Ações de Script WhatsApp/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Remover' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Script WhatsApp')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Atualizar/i })).toBeInTheDocument();
  });
});
