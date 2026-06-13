import { afterEach, describe, expect, it } from 'vitest';
import { getDefaultPushTopics, namespacedPushKey, PUSH_TOPIC_CATALOG, resolvePushProduct } from './pushProduct';

const originalLocation = window.location;

function setLocation(overrides: Partial<Pick<Location, 'hostname' | 'hash'>>) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, hostname: 'localhost', hash: '', ...overrides },
  });
}

describe('pushProduct', () => {
  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  describe('resolvePushProduct', () => {
    it('resolves to erp on the main host with no special hash', () => {
      setLocation({ hostname: 'localhost', hash: '' });
      expect(resolvePushProduct()).toBe('erp');
    });

    it('resolves to crmplus on the dedicated CRM host', () => {
      setLocation({ hostname: 'crm.iphonerepasse.com.br', hash: '' });
      expect(resolvePushProduct()).toBe('crmplus');
    });

    it('resolves to crmplus on the legacy #/crmplus hash route', () => {
      setLocation({ hostname: 'localhost', hash: '#/crmplus/conversations/1' });
      expect(resolvePushProduct()).toBe('crmplus');
    });
  });

  describe('getDefaultPushTopics', () => {
    it('returns the erp topic catalog', () => {
      expect(getDefaultPushTopics('erp')).toEqual(PUSH_TOPIC_CATALOG.erp);
    });

    it('returns the crmplus topic catalog', () => {
      expect(getDefaultPushTopics('crmplus')).toEqual(PUSH_TOPIC_CATALOG.crmplus);
    });
  });

  describe('namespacedPushKey', () => {
    it('appends the product as a namespace suffix', () => {
      expect(namespacedPushKey('push.sub.endpoint', 'erp')).toBe('push.sub.endpoint:erp');
      expect(namespacedPushKey('push.sub.endpoint', 'crmplus')).toBe('push.sub.endpoint:crmplus');
    });
  });
});
