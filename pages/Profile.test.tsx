import { render, screen, waitFor } from '@testing-library/react';
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
});
