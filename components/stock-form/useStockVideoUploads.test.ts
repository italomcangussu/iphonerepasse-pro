import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useStockVideoUploads } from './useStockVideoUploads';

const file = (name: string) => new File(['x'], name, { type: 'video/mp4' });

describe('useStockVideoUploads', () => {
  it('entrega cada URL enviada e conta as falhas', async () => {
    const uploadVideo = vi.fn()
      .mockResolvedValueOnce('https://cdn/a.mp4')
      .mockRejectedValueOnce(new Error('rede'))
      .mockResolvedValueOnce('https://cdn/c.mp4');
    const onUploaded = vi.fn();
    const { result } = renderHook(() => useStockVideoUploads({ uploadVideo, onUploaded }));

    let outcome;
    await act(async () => {
      outcome = await result.current.uploadVideos([file('a.mp4'), file('b.mp4'), file('c.mp4')]);
    });

    expect(outcome).toEqual({ uploadedUrls: ['https://cdn/a.mp4', 'https://cdn/c.mp4'], failedCount: 1 });
    expect(onUploaded.mock.calls.map(([url]) => url)).toEqual(['https://cdn/a.mp4', 'https://cdn/c.mp4']);
    expect(result.current.isUploadingVideos).toBe(false);
  });

  it('sinaliza envio em andamento até terminar', async () => {
    let finish: (url: string) => void = () => {};
    const uploadVideo = vi.fn(() => new Promise<string>((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useStockVideoUploads({ uploadVideo, onUploaded: vi.fn() }));

    let pending: Promise<unknown> = Promise.resolve();
    act(() => { pending = result.current.uploadVideos([file('a.mp4')]); });
    expect(result.current.pendingCount).toBe(1);

    await act(async () => { finish('https://cdn/a.mp4'); await pending; });
    expect(result.current.pendingCount).toBe(0);
  });
});
