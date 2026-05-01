import { describe, expect, it } from 'vitest';
import {
  UAZ_WEBHOOK_DEFAULT_EVENTS,
  buildUazWebhookRequest,
  buildUazSendMessageRequest,
  buildUazBaseUrl,
  buildUazMessageActionRequest,
  extractInboundMessageId,
  extractInboundPhone,
  extractInboundText,
  extractUazMedia,
  extractUazMessageStatus,
  isEchoFromApi,
  isUazMessageUpdateEvent,
  isUazFromMe,
  parseUazProviderMessageId,
  resolveAdminToken,
  resolveInstanceToken,
  resolveWebhookUrl,
} from '../supabase/functions/_shared/uazapi';

describe('uazapi adapter', () => {
  it('builds base URL from subdomain', () => {
    expect(buildUazBaseUrl('api')).toBe('https://api.uazapi.com');
    expect(buildUazBaseUrl('my-subdomain')).toBe('https://my-subdomain.uazapi.com');
  });

  it('resolves instance token with legacy fallback', () => {
    expect(resolveInstanceToken({ uaz_instance_token: 'new-token', api_key: 'legacy' })).toBe('new-token');
    expect(resolveInstanceToken({ uaz_instance_token: '', api_key: 'legacy' })).toBe('legacy');
    expect(resolveInstanceToken({})).toBeNull();
  });

  it('resolves admin token', () => {
    expect(resolveAdminToken({ uaz_admin_token: 'admin-token' })).toBe('admin-token');
    expect(resolveAdminToken({ uaz_admin_token: '' })).toBeNull();
  });

  it('builds webhook URL with channel and secret', () => {
    const url = resolveWebhookUrl('abc-123', 'secret', 'https://demo.functions.supabase.co');
    expect(url).toContain('/crm-uaz-webhook-receiver');
    expect(url).toContain('channel_id=abc-123');
    expect(url).toContain('webhook_secret=secret');
  });

  it('subscribes to inbound messages and both update event spellings', () => {
    expect(UAZ_WEBHOOK_DEFAULT_EVENTS).toEqual(
      expect.arrayContaining(['messages', 'messages_update', 'messages_updates', 'connection']),
    );
    expect(isUazMessageUpdateEvent('messages_update')).toBe(true);
    expect(isUazMessageUpdateEvent('messages_updates')).toBe(true);
    expect(isUazMessageUpdateEvent('messages.update')).toBe(true);
    expect(isUazMessageUpdateEvent('message.update')).toBe(true);
    expect(isUazMessageUpdateEvent('messages')).toBe(false);
  });

  it('builds an enabled webhook payload for inbound CRM events', () => {
    expect(buildUazWebhookRequest('https://demo.functions.supabase.co/crm-uaz-webhook-receiver')).toEqual({
      enabled: true,
      url: 'https://demo.functions.supabase.co/crm-uaz-webhook-receiver',
      events: ['messages', 'messages_update', 'messages_updates', 'connection'],
      excludeMessages: ['wasSentByApi'],
      addUrlEvents: false,
      addUrlTypesMessages: false,
    });
  });

  it('parses provider message id from common response shapes', () => {
    expect(parseUazProviderMessageId({ id: 'msg-1' })).toBe('msg-1');
    expect(parseUazProviderMessageId({ key: { id: 'msg-2' } })).toBe('msg-2');
    expect(parseUazProviderMessageId({ response: { key: { id: 'msg-3' } } })).toBe('msg-3');
  });

  it('detects echo payloads sent by API', () => {
    expect(isEchoFromApi({ wasSentByApi: true })).toBe(true);
    expect(isEchoFromApi({ data: { fromMe: true } })).toBe(true);
    expect(isEchoFromApi({ data: { fromMe: false } })).toBe(false);
  });

  it('extracts inbound fields with fallback', () => {
    const payload = {
      data: {
        remoteJid: '5511999999999@s.whatsapp.net',
        id: 'provider-id-1',
        message: {
          conversation: 'Oi!',
        },
      },
    };

    expect(extractInboundPhone(payload)).toBe('+5511999999999');
    expect(extractInboundText(payload)).toBe('Oi!');
    expect(extractInboundMessageId(payload)).toBe('provider-id-1');
  });

  it('maps message actions to official UAZAPI endpoints', () => {
    expect(
      buildUazMessageActionRequest({
        action: 'delete',
        messageId: 'm1',
      }),
    ).toEqual({ endpoint: '/message/delete', body: { id: 'm1' } });

    expect(
      buildUazMessageActionRequest({
        action: 'edit',
        messageId: 'm2',
        payload: { text: 'novo texto' },
      }),
    ).toEqual({ endpoint: '/message/edit', body: { id: 'm2', text: 'novo texto' } });

    expect(
      buildUazMessageActionRequest({
        action: 'pin',
        messageId: 'm3',
        payload: { pin: true, duration: 3600 },
      }),
    ).toEqual({ endpoint: '/message/pin', body: { id: 'm3', pin: true, duration: 3600 } });

    expect(
      buildUazMessageActionRequest({
        action: 'react',
        messageId: 'm4',
        payload: { text: '👍' },
        fallbackNumber: '+55 (11) 99999-9999',
      }),
    ).toEqual({ endpoint: '/message/react', body: { id: 'm4', text: '👍', number: '5511999999999' } });
  });

  it('validates invalid action payloads', () => {
    expect(() =>
      buildUazMessageActionRequest({
        action: 'edit',
        messageId: 'm5',
        payload: {},
      })
    ).toThrow('text obrigatório para ação edit.');
  });

  it('builds official send text and media payloads', () => {
    expect(
      buildUazSendMessageRequest({
        number: '+55 (11) 99999-9999',
        content: 'Oi',
        replyToProviderMessageId: 'reply-1',
      }),
    ).toEqual({
      endpoint: '/send/text',
      body: {
        number: '5511999999999',
        text: 'Oi',
        replyid: 'reply-1',
      },
    });

    expect(
      buildUazSendMessageRequest({
        number: '5511999999999',
        content: 'Contrato',
        mediaUrl: 'https://cdn.example.com/contrato.pdf',
        mediaType: 'application/pdf',
        mediaFilename: 'contrato.pdf',
      }),
    ).toEqual({
      endpoint: '/send/media',
      body: {
        number: '5511999999999',
        type: 'document',
        file: 'https://cdn.example.com/contrato.pdf',
        text: 'Contrato',
        mimetype: 'application/pdf',
        docName: 'contrato.pdf',
      },
    });
  });

  it('extracts UAZ media, status and fromMe fields from webhook payloads', () => {
    const payload = {
      event: 'messages',
      data: {
        key: { id: 'msg-10', remoteJid: '5511888888888@s.whatsapp.net', fromMe: true },
        message: {
          imageMessage: {
            url: 'https://cdn.example.com/image.jpg',
            mimetype: 'image/jpeg',
            caption: 'Foto do aparelho',
          },
        },
      },
    };

    expect(isUazFromMe(payload)).toBe(true);
    expect(extractInboundPhone(payload)).toBe('+5511888888888');
    expect(extractInboundMessageId(payload)).toBe('msg-10');
    expect(extractInboundText(payload)).toBe('Foto do aparelho');
    expect(extractUazMedia(payload)).toEqual({
      mediaUrl: 'https://cdn.example.com/image.jpg',
      mediaType: 'image/jpeg',
      mediaFilename: null,
    });

    expect(extractUazMessageStatus({ event: 'messages_update', data: { id: 'msg-10', ack: 3 } })).toBe('read');
    expect(extractUazMessageStatus({ event: 'messages_update', data: { status: 'delivered' } })).toBe('delivered');
  });
});
