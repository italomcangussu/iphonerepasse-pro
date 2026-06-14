import { describe, it, expect, vi, beforeEach } from 'vitest';

const { removeMock, fromMock } = vi.hoisted(() => {
  const removeMock = vi.fn();
  const fromMock = vi.fn(() => ({ remove: removeMock }));
  return { removeMock, fromMock };
});

vi.mock('./supabase', () => ({
  supabase: { storage: { from: fromMock } },
}));

import { resolveStoragePath, removeImages } from './storage';

const BUCKET_URL =
  'https://ref.supabase.co/storage/v1/object/public/device-images/';

describe('resolveStoragePath', () => {
  it('extrai o nome do objeto de uma URL pública', () => {
    expect(resolveStoragePath(`${BUCKET_URL}img-123.jpg`, 'device-images')).toBe(
      'img-123.jpg'
    );
  });

  it('ignora query string da URL', () => {
    expect(
      resolveStoragePath(`${BUCKET_URL}img-123.jpg?token=abc`, 'device-images')
    ).toBe('img-123.jpg');
  });

  it('decodifica caminhos com prefixo (ex.: store-photos/)', () => {
    expect(
      resolveStoragePath(`${BUCKET_URL}store-photos/loja%20a.jpg`, 'device-images')
    ).toBe('store-photos/loja a.jpg');
  });

  it('aceita caminho relativo com prefixo do bucket', () => {
    expect(resolveStoragePath('device-images/img-9.jpg', 'device-images')).toBe(
      'img-9.jpg'
    );
  });

  it('aceita apenas o nome do objeto', () => {
    expect(resolveStoragePath('img-9.jpg', 'device-images')).toBe('img-9.jpg');
  });

  it('retorna null para URL de outro bucket', () => {
    expect(
      resolveStoragePath(
        'https://ref.supabase.co/storage/v1/object/public/logos/x.png',
        'device-images'
      )
    ).toBeNull();
  });

  it('retorna null para entrada vazia', () => {
    expect(resolveStoragePath('', 'device-images')).toBeNull();
  });
});

describe('removeImages', () => {
  beforeEach(() => {
    removeMock.mockReset();
    fromMock.mockClear();
    removeMock.mockResolvedValue({ error: null });
  });

  it('remove os caminhos resolvidos, sem duplicatas nem nulos', async () => {
    await removeImages(
      [
        `${BUCKET_URL}img-1.jpg`,
        `${BUCKET_URL}img-1.jpg`, // duplicada
        'https://ref.supabase.co/storage/v1/object/public/logos/x.png', // outro bucket
        '',
      ],
      'device-images'
    );

    expect(fromMock).toHaveBeenCalledWith('device-images');
    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(removeMock).toHaveBeenCalledWith(['img-1.jpg']);
  });

  it('não chama a Storage API quando não há caminhos válidos', async () => {
    await removeImages(['', '   '], 'device-images');
    expect(removeMock).not.toHaveBeenCalled();
  });

  it('não lança quando a remoção falha (best-effort)', async () => {
    removeMock.mockResolvedValue({ error: { message: 'boom' } });
    await expect(
      removeImages([`${BUCKET_URL}img-2.jpg`], 'device-images')
    ).resolves.toBeUndefined();
  });
});
