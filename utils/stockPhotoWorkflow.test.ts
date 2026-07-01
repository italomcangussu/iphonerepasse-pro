import { describe, expect, it, vi } from 'vitest';
import {
  clampFilesToPhotoLimit,
  ensureSingleCoverInQueue,
  isHeicFile,
  mergeUploadBatchOutcome,
  mergeUploadedPhotosWithCover,
  moveItemInArray,
  preparePhotoForUpload,
  resolveSaveBlockReason,
  setQueueCover,
  type LocalPhotoQueueItem,
} from './stockPhotoWorkflow';

vi.mock('heic2any', () => ({
  default: vi.fn(async () => new Blob([new Uint8Array(2048).fill(2)], { type: 'image/jpeg' })),
}));

const makeFile = (name: string, size = 1024, type = 'image/jpeg') => {
  const content = new Uint8Array(size).fill(1);
  return new File([content], name, { type });
};

const makeQueueItem = (id: string, cover = false): LocalPhotoQueueItem => ({
  id,
  file: makeFile(`${id}.jpg`),
  previewUrl: `blob:${id}`,
  source: 'gallery',
  status: 'pending',
  isCover: cover,
});

describe('stockPhotoWorkflow', () => {
  it('clamps incoming files to max photo limit', () => {
    const incoming = [makeFile('1.jpg'), makeFile('2.jpg'), makeFile('3.jpg')];

    const result = clampFilesToPhotoLimit({
      uploadedCount: 8,
      queuedCount: 1,
      incomingFiles: incoming,
    });

    expect(result.acceptedFiles).toHaveLength(1);
    expect(result.acceptedFiles[0].name).toBe('1.jpg');
    expect(result.overflowCount).toBe(2);
    expect(result.availableSlots).toBe(1);
  });

  it('reorders items and marks a single queue cover', () => {
    const queue = [makeQueueItem('a'), makeQueueItem('b'), makeQueueItem('c')];

    const reordered = setQueueCover(queue, 'c');

    expect(reordered[0].id).toBe('c');
    expect(reordered[0].isCover).toBe(true);
    expect(reordered[1].isCover).toBe(false);
    expect(reordered[2].isCover).toBe(false);
  });

  it('keeps only one marked cover in queue', () => {
    const queue = [makeQueueItem('a', true), makeQueueItem('b', true), makeQueueItem('c', false)];
    const normalized = ensureSingleCoverInQueue(queue);

    expect(normalized.filter((item) => item.isCover)).toHaveLength(1);
    expect(normalized[0].isCover).toBe(true);
  });

  it('merges upload results preserving failed items for retry', () => {
    const queue = [makeQueueItem('a'), makeQueueItem('b'), makeQueueItem('c')];

    const result = mergeUploadBatchOutcome(queue, [
      { id: 'a', status: 'fulfilled', url: 'https://cdn/a.jpg' },
      { id: 'b', status: 'rejected', error: 'timeout' },
    ]);

    expect(result.successCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.uploadedUrls).toEqual(['https://cdn/a.jpg']);
    expect(result.nextQueue).toHaveLength(2);
    expect(result.nextQueue[0].id).toBe('b');
    expect(result.nextQueue[0].status).toBe('failed');
    expect(result.nextQueue[1].id).toBe('c');
  });

  it('merges uploaded URLs with selected cover first', () => {
    const merged = mergeUploadedPhotosWithCover(
      ['https://cdn/existing-1.jpg', 'https://cdn/existing-2.jpg'],
      ['https://cdn/new-1.jpg', 'https://cdn/new-2.jpg'],
      'https://cdn/new-2.jpg'
    );

    expect(merged[0]).toBe('https://cdn/new-2.jpg');
    expect(merged).toEqual([
      'https://cdn/new-2.jpg',
      'https://cdn/existing-1.jpg',
      'https://cdn/existing-2.jpg',
      'https://cdn/new-1.jpg',
    ]);
  });

  it('resolves save blocking reason with priority', () => {
    expect(
      resolveSaveBlockReason({
        isUploading: true,
        hasPendingUploads: true,
        hasFailedUploads: true,
      })
    ).toBe('uploading');

    expect(
      resolveSaveBlockReason({
        isUploading: false,
        hasPendingUploads: true,
        hasFailedUploads: true,
      })
    ).toBe('pending_uploads');

    expect(
      resolveSaveBlockReason({
        isUploading: false,
        hasPendingUploads: false,
        hasFailedUploads: true,
      })
    ).toBe('failed_uploads');

    expect(
      resolveSaveBlockReason({
        isUploading: false,
        hasPendingUploads: false,
        hasFailedUploads: false,
      })
    ).toBe(null);
  });

  it('detects HEIC/HEIF by mime and by extension when type is empty', () => {
    expect(isHeicFile(makeFile('IMG_0001.HEIC', 1024, 'image/heic'))).toBe(true);
    expect(isHeicFile(makeFile('IMG_0002.heif', 1024, 'image/heif'))).toBe(true);
    // iOS às vezes entrega o arquivo sem mime: cai para a extensão do nome.
    expect(isHeicFile(makeFile('IMG_0003.HEIC', 1024, ''))).toBe(true);
    expect(isHeicFile(makeFile('photo.jpg', 1024, 'image/jpeg'))).toBe(false);
    expect(isHeicFile(makeFile('photo.png', 1024, ''))).toBe(false);
  });

  it('converts HEIC to JPEG before upload (even on desktop)', async () => {
    const heic = makeFile('IMG_0001.HEIC', 1024, 'image/heic');

    const result = await preparePhotoForUpload(heic, { isMobile: false });

    expect(result).not.toBe(heic);
    expect(result.type).toBe('image/jpeg');
    expect(result.name).toBe('IMG_0001.jpg');
  });

  it('keeps file unchanged when compression is not applicable', async () => {
    const file = makeFile('photo.jpg', 2_000_000);

    const desktopResult = await preparePhotoForUpload(file, { isMobile: false });
    expect(desktopResult).toBe(file);

    const tinyFile = makeFile('tiny.jpg', 1200);
    const tinyResult = await preparePhotoForUpload(tinyFile, { isMobile: true });
    expect(tinyResult).toBe(tinyFile);
  });

  it('falls back to original when canvas context is unavailable', async () => {
    const file = makeFile('large.jpg', 2_000_000);
    const originalCreateElement = document.createElement.bind(document);

    const canvas = originalCreateElement('canvas') as HTMLCanvasElement;
    vi.spyOn(canvas, 'getContext').mockReturnValue(null);

    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string) => {
        if (tagName.toLowerCase() === 'canvas') {
          return canvas;
        }
        return originalCreateElement(tagName);
      });

    const result = await preparePhotoForUpload(file, { isMobile: true });
    expect(result).toBe(file);

    createElementSpy.mockRestore();
  });

  it('moves queue items by index safely', () => {
    const moved = moveItemInArray(['a', 'b', 'c'], 0, 2);
    expect(moved).toEqual(['b', 'c', 'a']);

    const unchanged = moveItemInArray(['a', 'b'], 5, 0);
    expect(unchanged).toEqual(['a', 'b']);
  });
});
