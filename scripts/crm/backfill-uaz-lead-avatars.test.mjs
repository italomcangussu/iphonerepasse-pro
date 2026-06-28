import test from 'node:test';
import assert from 'node:assert/strict';
import {
  discoverAvatarBackfillCandidates,
  runAvatarBackfill,
} from './backfill-uaz-lead-avatars.mjs';

const localConversations = [
  {
    talk_id: '5585000000001@s.whatsapp.net',
    channel_id: 'channel-1',
    crm_leads: { id: 'lead-1', avatar_url: null },
  },
  {
    talk_id: '5585000000002@s.whatsapp.net',
    channel_id: 'channel-1',
    crm_leads: { id: 'lead-2', avatar_url: 'https://crm/avatar.webp' },
  },
  {
    talk_id: '5585000000003@s.whatsapp.net',
    channel_id: 'channel-1',
    crm_leads: { id: 'lead-3', avatar_url: null },
  },
];

const remoteChats = new Map([
  ['channel-1', [
    { wa_chatid: '5585000000001@s.whatsapp.net', imagePreview: 'https://pps/one.jpg' },
    { wa_chatid: '5585000000002@s.whatsapp.net', image: 'https://pps/two.jpg' },
    { wa_chatid: '5585000000003@s.whatsapp.net', image: '' },
  ]],
]);

test('discovers only UAZ-visible avatars missing locally', async () => {
  const candidates = await discoverAvatarBackfillCandidates({
    fetchLocalConversations: async () => localConversations,
    fetchRemoteChats: async (channelId) => remoteChats.get(channelId) || [],
  });
  assert.deepEqual(candidates, [{ leadId: 'lead-1', channelId: 'channel-1' }]);
});

test('dry run never invokes refresh while apply invokes candidates', async () => {
  const refreshCalls = [];
  const deps = {
    fetchLocalConversations: async () => localConversations,
    fetchRemoteChats: async (channelId) => remoteChats.get(channelId) || [],
    refreshLead: async (candidate) => {
      refreshCalls.push(candidate);
      return { status: 'synced' };
    },
  };

  const dry = await runAvatarBackfill({ apply: false, concurrency: 3 }, deps);
  assert.equal(dry.candidates, 1);
  assert.equal(dry.attempted, 0);
  assert.equal(refreshCalls.length, 0);

  const applied = await runAvatarBackfill({ apply: true, concurrency: 3 }, deps);
  assert.equal(applied.attempted, 1);
  assert.deepEqual(applied.statuses, { synced: 1 });
  assert.equal(refreshCalls.length, 1);
});
