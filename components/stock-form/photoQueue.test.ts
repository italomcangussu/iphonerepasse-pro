import { describe, expect, it } from 'vitest';
import type { LocalPhotoQueueItem } from '../../utils/stockPhotoWorkflow';
import { getRemovedPreviewUrls, reducePhotoQueue } from './photoQueue';

const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });

const photo = (id: string, overrides: Partial<LocalPhotoQueueItem> = {}): LocalPhotoQueueItem => ({
  id,
  file,
  previewUrl: `blob:${id}`,
  source: 'gallery',
  status: 'pending',
  error: undefined,
  isCover: false,
  ...overrides
});

describe('stock form photo queue', () => {
  it('adds photos and keeps a single cover', () => {
    const queue = reducePhotoQueue([], {
      type: 'added',
      photos: [photo('a'), photo('b', { isCover: true })]
    });

    expect(queue.map((item) => item.id)).toEqual(['a', 'b']);
    expect(queue.filter((item) => item.isCover)).toHaveLength(1);
    expect(queue[1].isCover).toBe(true);
  });

  it('removes photos, reports preview URLs to revoke and promotes a cover', () => {
    const previous = [photo('a', { isCover: true }), photo('b')];
    const next = reducePhotoQueue(previous, { type: 'removed', id: 'a' });

    expect(next.map((item) => item.id)).toEqual(['b']);
    expect(next[0].isCover).toBe(true);
    expect(getRemovedPreviewUrls(previous, next)).toEqual(['blob:a']);
  });

  it('moves photos within boundaries and selects cover', () => {
    const queue = [photo('a', { isCover: true }), photo('b'), photo('c')];

    expect(reducePhotoQueue(queue, { type: 'moved', id: 'a', direction: -1 })).toEqual(queue);
    const moved = reducePhotoQueue(queue, { type: 'moved', id: 'b', direction: 1 });
    expect(moved.map((item) => item.id)).toEqual(['a', 'c', 'b']);

    const covered = reducePhotoQueue(moved, { type: 'cover-selected', id: 'b' });
    expect(covered.map((item) => [item.id, item.isCover])).toEqual([
      ['b', true],
      ['a', false],
      ['c', false]
    ]);
  });

  it('marks uploads, removes successes and keeps failures retryable', () => {
    const uploading = reducePhotoQueue([photo('a'), photo('b')], {
      type: 'upload-started',
      ids: ['a', 'b']
    });
    expect(uploading.every((item) => item.status === 'uploading')).toBe(true);

    const finished = reducePhotoQueue(uploading, {
      type: 'upload-finished',
      outcomes: [
        { id: 'a', status: 'fulfilled', url: 'https://cdn/a.jpg' },
        { id: 'b', status: 'rejected', error: 'network' }
      ]
    });

    expect(finished).toEqual([expect.objectContaining({
      id: 'b',
      status: 'failed',
      error: 'network',
      isCover: true
    })]);
  });
});
