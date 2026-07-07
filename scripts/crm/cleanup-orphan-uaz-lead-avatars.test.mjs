import test from 'node:test';
import assert from 'node:assert/strict';
import {
  discoverOrphanLeadAvatars,
  normalizeStoredAvatarPath,
  runOrphanLeadAvatarCleanup,
} from './cleanup-orphan-uaz-lead-avatars.mjs';

test('normalizes current and legacy public avatar URLs without accepting other media', () => {
  assert.equal(
    normalizeStoredAvatarPath('https://project.supabase.co/storage/v1/object/public/crm-media/avatars/store-1/lead-a.webp?v=2'),
    'avatars/store-1/lead-a.webp',
  );
  assert.equal(
    normalizeStoredAvatarPath('https://project.supabase.co/storage/v1/object/public/crm-media/avatars/store-1/%252B5585.webp?v=1'),
    'avatars/store-1/%2B5585.webp',
  );
  assert.equal(
    normalizeStoredAvatarPath('avatars/store-1/%2B5585.webp'),
    'avatars/store-1/%2B5585.webp',
  );
  assert.equal(normalizeStoredAvatarPath('messages/store-1/private.jpg'), null);
});

test('discovers only avatar objects that no lead references', () => {
  const orphans = discoverOrphanLeadAvatars({
    objects: [
      { name: 'avatars/store-1/current.webp' },
      { name: 'avatars/store-1/legacy.webp' },
      { name: 'avatars/store-1/%2B5585.webp' },
      { name: 'avatars/store-1/orphan.webp' },
      { name: 'messages/store-1/message.jpg' },
    ],
    leads: [
      { avatar_storage_path: 'avatars/store-1/current.webp', avatar_url: null },
      {
        avatar_storage_path: null,
        avatar_url: 'https://project.supabase.co/storage/v1/object/public/crm-media/avatars/store-1/legacy.webp?v=1',
      },
      {
        avatar_storage_path: null,
        avatar_url: 'https://project.supabase.co/storage/v1/object/public/crm-media/avatars/store-1/%252B5585.webp?v=1',
      },
    ],
  });

  assert.deepEqual(orphans, ['avatars/store-1/orphan.webp']);
});

test('dry run reports orphans while apply deletes exactly the discovered paths', async () => {
  const removed = [];
  const deps = {
    fetchAvatarObjects: async () => [
      { name: 'avatars/store-1/current.webp' },
      { name: 'avatars/store-1/orphan.webp' },
    ],
    fetchLeadAvatarReferences: async () => [
      { avatar_storage_path: 'avatars/store-1/current.webp', avatar_url: null },
    ],
    removeObjects: async (paths) => removed.push(...paths),
  };

  assert.deepEqual(await runOrphanLeadAvatarCleanup({ apply: false }, deps), {
    mode: 'dry-run',
    scanned: 2,
    referenced: 1,
    orphaned: 1,
    deleted: 0,
    paths: ['avatars/store-1/orphan.webp'],
  });
  assert.deepEqual(removed, []);

  const applied = await runOrphanLeadAvatarCleanup({ apply: true }, deps);
  assert.equal(applied.deleted, 1);
  assert.deepEqual(removed, ['avatars/store-1/orphan.webp']);
});
