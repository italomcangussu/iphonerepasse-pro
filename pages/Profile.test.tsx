import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Profile from './Profile';
import type { BusinessProfile } from '../types';

const useDataMock = vi.fn();
const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  confirm: vi.fn(),
  dismiss: vi.fn(),
  clear: vi.fn(),
};

vi.mock('../services/dataContext', () => ({
  useData: () => useDataMock(),
}));

vi.mock('../components/ui/ToastProvider', () => ({
  useToast: () => toastMock,
}));

vi.mock('../services/storage', () => ({
  uploadImage: vi.fn(),
}));

vi.mock('../components/BrandLogo', () => ({
  default: () => <div aria-label="Logo padrao" />,
}));

const businessProfile: BusinessProfile = {
  name: 'Loja Teste',
  cnpj: '',
  phone: '',
  email: '',
  address: '',
  instagram: '',
  logoUrl: '',
  businessHours: {
    mon: { open: '09:00', close: '22:00' },
    tue: { open: '09:00', close: '22:00' },
    wed: { open: '09:00', close: '22:00' },
    thu: { open: '09:00', close: '22:00' },
    fri: { open: '09:00', close: '22:00' },
    sat: { open: '09:00', close: '22:00' },
    sun: { open: '14:00', close: '20:00' },
  },
  specialBusinessHours: {
    '2026-04-03': {
      closed: true,
      label: 'Páscoa',
    },
  },
};

describe('Profile save button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDataMock.mockReturnValue({
      businessProfile,
      updateBusinessProfile: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('does not show success when backend save fails', async () => {
    const user = userEvent.setup();
    const updateBusinessProfile = vi.fn().mockRejectedValue(new Error('upsert failed'));
    useDataMock.mockReturnValue({
      businessProfile,
      updateBusinessProfile,
    });

    render(<Profile />);

    await user.click(screen.getByRole('button', { name: /Salvar Alterações/i }));

    await waitFor(() => expect(updateBusinessProfile).toHaveBeenCalledWith(businessProfile));
    expect(toastMock.error).toHaveBeenCalledWith('upsert failed');
    expect(screen.queryByText('Alterações salvas com sucesso!')).not.toBeInTheDocument();
  });

  it('saves weekly and special business hours with the store profile', async () => {
    const user = userEvent.setup();
    const updateBusinessProfile = vi.fn().mockResolvedValue(undefined);
    useDataMock.mockReturnValue({
      businessProfile,
      updateBusinessProfile,
    });

    render(<Profile />);

    expect(screen.getByRole('heading', { name: /Horários de funcionamento/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Segunda abertura/i)).toHaveValue('09:00');
    expect(screen.getByLabelText(/Domingo fechamento/i)).toHaveValue('20:00');
    expect(screen.getByDisplayValue('Páscoa')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Sábado fechamento/i), { target: { value: '21:00' } });
    await user.click(screen.getByRole('button', { name: /Salvar Alterações/i }));

    await waitFor(() => expect(updateBusinessProfile).toHaveBeenCalledWith(expect.objectContaining({
      businessHours: expect.objectContaining({
        mon: { open: '09:00', close: '22:00' },
        sat: { open: '09:00', close: '21:00' },
        sun: { open: '14:00', close: '20:00' },
      }),
      specialBusinessHours: {
        '2026-04-03': {
          closed: true,
          label: 'Páscoa',
        },
      },
    })));
  });
});
