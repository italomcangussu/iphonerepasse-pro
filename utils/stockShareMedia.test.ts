import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchMediaFiles, selectShareMediaUrls } from './stockShareMedia';

const item = { photos: ['https://cdn/p1.jpg'], videos: ['https://cdn/v1.mov'] };

describe('selectShareMediaUrls', () => {
  it('manda fotos antes dos vídeos', () => {
    expect(selectShareMediaUrls(item, { includePhotos: true, includeVideos: true }))
      .toEqual(['https://cdn/p1.jpg', 'https://cdn/v1.mov']);
  });

  it('respeita o que foi desmarcado e aparelho sem vídeos', () => {
    expect(selectShareMediaUrls(item, { includePhotos: false, includeVideos: true })).toEqual(['https://cdn/v1.mov']);
    expect(selectShareMediaUrls({ photos: [] }, { includePhotos: true, includeVideos: true })).toEqual([]);
  });
});

describe('fetchMediaFiles', () => {
  afterEach(() => vi.unstubAllGlobals());

  const respondWith = (type: string) => ({ ok: true, blob: async () => new Blob(['x'], { type }) });

  it('nomeia cada arquivo pelo aparelho, mantendo extensão e tipo', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(respondWith('image/jpeg'))
      .mockResolvedValueOnce(respondWith('video/quicktime')));

    const files = await fetchMediaFiles(['https://cdn/p1.jpg', 'https://cdn/v1.mov'], 'iphone-15');

    expect(files.map((file) => [file.name, file.type])).toEqual([
      ['iphone-15-1.jpg', 'image/jpeg'],
      ['iphone-15-2.mov', 'video/quicktime']
    ]);
  });

  it('deixa de fora a mídia que falhou e não baixa de novo o que está no cache', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce(respondWith('video/mp4'));
    vi.stubGlobal('fetch', fetchMock);
    const cache = new Map<string, File>();

    const first = await fetchMediaFiles(['https://cdn/quebrada.jpg', 'https://cdn/v1.mp4'], 'x', cache);
    const second = await fetchMediaFiles(['https://cdn/v1.mp4'], 'x', cache);

    expect(first.map((file) => file.name)).toEqual(['x-2.mp4']);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
