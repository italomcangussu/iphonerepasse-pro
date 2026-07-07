import { describe, expect, it } from 'vitest';
import type { MessageBubbleMessage } from './MessageBubble';
import { buildMessagePresentation } from './messageClusters';

const message = (
  id: string,
  createdAt: string,
  overrides: Partial<MessageBubbleMessage> = {},
): MessageBubbleMessage => ({
  id,
  direction: 'inbound',
  sender_type: 'customer',
  content: id,
  created_at: createdAt,
  status: 'read',
  ...overrides,
});

describe('buildMessagePresentation', () => {
  it('clusters consecutive messages from the same sender within five minutes', () => {
    const result = buildMessagePresentation([
      message('one', '2026-07-07T10:00:00.000Z'),
      message('two', '2026-07-07T10:04:59.000Z'),
    ]);

    expect(result.map(({ position }) => position)).toEqual(['first', 'last']);
    expect(result.map(({ separateFromPrevious }) => separateFromPrevious)).toEqual([false, false]);
  });

  it('separates messages after five minutes or when direction changes', () => {
    const result = buildMessagePresentation([
      message('one', '2026-07-07T10:00:00.000Z'),
      message('two', '2026-07-07T10:05:01.000Z'),
      message('three', '2026-07-07T10:06:00.000Z', { direction: 'outbound', sender_type: 'human' }),
    ]);

    expect(result.map(({ position }) => position)).toEqual(['single', 'single', 'single']);
    expect(result.map(({ separateFromPrevious }) => separateFromPrevious)).toEqual([false, true, true]);
  });

  it('keeps different participants in a group conversation separate', () => {
    const result = buildMessagePresentation([
      message('maria', '2026-07-07T10:00:00.000Z', {
        webhook_payload: { message: { sender_pn: 'maria@s.whatsapp.net' } },
      }),
      message('joao', '2026-07-07T10:01:00.000Z', {
        webhook_payload: { message: { sender_pn: 'joao@s.whatsapp.net' } },
      }),
    ]);

    expect(result.map(({ position }) => position)).toEqual(['single', 'single']);
  });
});
