import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useStockPhotoQueue } from './useStockPhotoQueue';

const file = (name: string) => new File(['image'], name, { type: 'image/jpeg' });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
};

describe('useStockPhotoQueue', () => {
  it('revokes preview URLs when queued photos are removed and cleared', () => {
    const revokeObjectUrl = vi.fn();
    const { result, unmount } = renderHook(() => useStockPhotoQueue({
      uploadedCount: 0,
      isMobile: false,
      createId: (prefix) => `${prefix}-${Math.random().toString(16).slice(2)}`,
      createObjectUrl: (queuedFile) => `blob:${queuedFile.name}`,
      revokeObjectUrl,
      uploadImage: vi.fn(),
      preparePhotoForUpload: vi.fn(async (queuedFile) => queuedFile)
    }));

    act(() => {
      result.current.addQueuedPhotos([file('one.jpg'), file('two.jpg')], 'gallery');
    });

    const [first, second] = result.current.localPhotoQueue;
    expect(first.previewUrl).toBe('blob:one.jpg');
    expect(first.isCover).toBe(true);

    act(() => {
      result.current.removeQueuedPhoto(first.id);
    });

    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:one.jpg');
    expect(result.current.localPhotoQueue).toEqual([
      expect.objectContaining({ id: second.id, isCover: true })
    ]);

    act(() => {
      result.current.clearLocalPhotoQueue();
    });

    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:two.jpg');
    unmount();
  });

  it('retries failed uploads and preserves the uploaded cover URL', async () => {
    const onUploadedPhotos = vi.fn();
    const uploadImage = vi.fn()
      .mockResolvedValueOnce('https://cdn/cover.jpg')
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce('https://cdn/retry.jpg');
    const { result } = renderHook(() => useStockPhotoQueue({
      uploadedCount: 0,
      isMobile: false,
      createId: (prefix) => `${prefix}-${Math.random().toString(16).slice(2)}`,
      createObjectUrl: (queuedFile) => `blob:${queuedFile.name}`,
      revokeObjectUrl: vi.fn(),
      uploadImage,
      preparePhotoForUpload: vi.fn(async (queuedFile) => queuedFile),
      onUploadedPhotos
    }));

    act(() => {
      result.current.addQueuedPhotos([file('cover.jpg'), file('retry.jpg')], 'gallery');
    });

    await act(async () => {
      expect(await result.current.uploadQueuedPhotos()).toEqual({ successCount: 1, failedCount: 1 });
    });

    expect(onUploadedPhotos).toHaveBeenCalledWith(['https://cdn/cover.jpg'], 'https://cdn/cover.jpg');
    expect(result.current.localPhotoQueue).toEqual([
      expect.objectContaining({ status: 'failed', error: 'network', isCover: true })
    ]);

    await act(async () => {
      expect(await result.current.uploadQueuedPhotos()).toEqual({ successCount: 1, failedCount: 0 });
    });

    expect(onUploadedPhotos).toHaveBeenLastCalledWith(['https://cdn/retry.jpg'], 'https://cdn/retry.jpg');
    expect(result.current.localPhotoQueue).toEqual([]);
  });

  it('replaces draft queues, moves photos and changes the cover', () => {
    const revokeObjectUrl = vi.fn();
    const createId = vi.fn((prefix: string) => `${prefix}-new`);
    const draftFile = file('draft.jpg');
    const { result } = renderHook(() => useStockPhotoQueue({
      uploadedCount: 1,
      isMobile: false,
      createId,
      createObjectUrl: (queuedFile) => `blob:${queuedFile.name}`,
      revokeObjectUrl,
      uploadImage: vi.fn(),
      preparePhotoForUpload: vi.fn(async (queuedFile) => queuedFile)
    }));

    act(() => {
      result.current.addQueuedPhotos([file('without-cover.jpg')], 'gallery');
    });
    expect(createId).toHaveBeenCalledWith('qphoto');
    expect(result.current.localPhotoQueue[0].isCover).toBe(true);

    act(() => {
      result.current.replaceLocalPhotoQueue([
        {
          id: 'draft-a',
          file: draftFile,
          previewUrl: 'blob:draft-a',
          source: 'gallery',
          status: 'pending',
          isCover: true
        },
        {
          id: 'draft-b',
          file: draftFile,
          previewUrl: 'blob:draft-b',
          source: 'gallery',
          status: 'pending',
          isCover: false
        }
      ]);
    });

    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:without-cover.jpg');
    expect(result.current.localPhotoQueue.map((item) => item.id)).toEqual(['draft-a', 'draft-b']);

    act(() => {
      result.current.moveQueuedPhoto('draft-a', 1);
    });
    expect(result.current.localPhotoQueue.map((item) => item.id)).toEqual(['draft-b', 'draft-a']);

    act(() => {
      result.current.setQueuedPhotoAsCover('draft-b');
    });
    expect(result.current.localPhotoQueue.map((item) => [item.id, item.isCover])).toEqual([
      ['draft-b', true],
      ['draft-a', false]
    ]);
  });

  it('returns zero counts when there are no pending uploads', async () => {
    const onUploadedPhotos = vi.fn();
    const uploadImage = vi.fn();
    const { result } = renderHook(() => useStockPhotoQueue({
      uploadedCount: 0,
      isMobile: false,
      createId: (prefix) => `${prefix}-1`,
      createObjectUrl: (queuedFile) => `blob:${queuedFile.name}`,
      revokeObjectUrl: vi.fn(),
      uploadImage,
      preparePhotoForUpload: vi.fn(async (queuedFile) => queuedFile),
      onUploadedPhotos
    }));

    await expect(result.current.uploadQueuedPhotos()).resolves.toEqual({ successCount: 0, failedCount: 0 });
    expect(uploadImage).not.toHaveBeenCalled();
    expect(onUploadedPhotos).not.toHaveBeenCalled();
    expect(result.current.isUploading).toBe(false);
  });

  it('passes mobile prepare options, upload bucket and fallback error text', async () => {
    const preparePhotoForUpload = vi.fn(async (queuedFile: File) => queuedFile);
    const uploadImage = vi.fn().mockRejectedValueOnce({});
    const { result } = renderHook(() => useStockPhotoQueue({
      uploadedCount: 0,
      isMobile: true,
      createId: (prefix) => `${prefix}-1`,
      createObjectUrl: (queuedFile) => `blob:${queuedFile.name}`,
      revokeObjectUrl: vi.fn(),
      uploadImage,
      preparePhotoForUpload
    }));

    act(() => {
      result.current.addQueuedPhotos([file('fallback.jpg')], 'gallery');
    });
    await act(async () => {
      expect(await result.current.uploadQueuedPhotos()).toEqual({ successCount: 0, failedCount: 1 });
    });

    expect(preparePhotoForUpload).toHaveBeenCalledWith(expect.any(File), { isMobile: true });
    expect(uploadImage).toHaveBeenCalledWith(expect.any(File), 'device-images');
    expect(result.current.localPhotoQueue).toEqual([
      expect.objectContaining({ status: 'failed', error: 'Falha no upload.' })
    ]);
  });

  it('exposes uploading state while an upload is in flight and works without upload callback', async () => {
    const upload = deferred<string>();
    const { result } = renderHook(() => useStockPhotoQueue({
      uploadedCount: 0,
      isMobile: false,
      createId: (prefix) => `${prefix}-1`,
      createObjectUrl: (queuedFile) => `blob:${queuedFile.name}`,
      revokeObjectUrl: vi.fn(),
      uploadImage: vi.fn(() => upload.promise),
      preparePhotoForUpload: vi.fn(async (queuedFile) => queuedFile)
    }));

    act(() => {
      result.current.addQueuedPhotos([file('slow.jpg')], 'gallery');
    });

    let uploadPromise!: Promise<{ successCount: number; failedCount: number }>;
    act(() => {
      uploadPromise = result.current.uploadQueuedPhotos();
    });
    await waitFor(() => expect(result.current.isUploading).toBe(true));

    upload.resolve('https://cdn/slow.jpg');
    await act(async () => {
      await expect(uploadPromise).resolves.toEqual({ successCount: 1, failedCount: 0 });
    });

    expect(result.current.isUploading).toBe(false);
    expect(result.current.localPhotoQueue).toEqual([]);
  });
});
