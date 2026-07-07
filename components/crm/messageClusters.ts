import type { MessageBubbleMessage } from './MessageBubble';

export type MessageClusterPosition = 'single' | 'first' | 'middle' | 'last';

export type MessagePresentation = {
  message: MessageBubbleMessage;
  position: MessageClusterPosition;
  separateFromPrevious: boolean;
};

export const MESSAGE_CLUSTER_MAX_GAP_MS = 5 * 60 * 1000;

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const pickText = (...values: unknown[]): string => {
  for (const value of values) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text) return text;
  }
  return '';
};

const getProviderParticipant = (message: MessageBubbleMessage): string => {
  const payload = asRecord(message.webhook_payload);
  const data = asRecord(payload.data);
  const rootMessage = asRecord(payload.message);
  const dataMessage = asRecord(data.message);

  return pickText(
    payload.sender_pn,
    payload.participant,
    payload.author,
    payload.id,
    data.sender_pn,
    data.participant,
    data.author,
    data.id,
    rootMessage.sender_pn,
    rootMessage.participant,
    rootMessage.author,
    rootMessage.id,
    dataMessage.sender_pn,
    dataMessage.participant,
    dataMessage.author,
    dataMessage.id,
  );
};

const getSenderKey = (message: MessageBubbleMessage): string => [
  message.direction,
  message.sender_type,
  message.sender_user_id || '',
  message.sender_display_name || '',
  getProviderParticipant(message),
].join('|');

const getTimestamp = (message: MessageBubbleMessage): number => {
  const value = new Date(message.sent_at || message.created_at).getTime();
  return Number.isFinite(value) ? value : Number.NaN;
};

const getLocalDayKey = (message: MessageBubbleMessage): string => {
  const date = new Date(message.sent_at || message.created_at);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const messagesConnect = (
  left: MessageBubbleMessage,
  right: MessageBubbleMessage,
  maxGapMs: number,
): boolean => {
  const delta = getTimestamp(right) - getTimestamp(left);
  const leftDay = getLocalDayKey(left);

  return getSenderKey(left) === getSenderKey(right)
    && leftDay !== ''
    && leftDay === getLocalDayKey(right)
    && delta >= 0
    && delta <= maxGapMs;
};

export const buildMessagePresentation = (
  messages: MessageBubbleMessage[],
  maxGapMs = MESSAGE_CLUSTER_MAX_GAP_MS,
): MessagePresentation[] => messages.map((message, index) => {
  const connectsPrevious = index > 0 && messagesConnect(messages[index - 1], message, maxGapMs);
  const connectsNext = index < messages.length - 1 && messagesConnect(message, messages[index + 1], maxGapMs);
  const position: MessageClusterPosition = connectsPrevious
    ? (connectsNext ? 'middle' : 'last')
    : (connectsNext ? 'first' : 'single');

  return {
    message,
    position,
    separateFromPrevious: index > 0 && !connectsPrevious,
  };
});
