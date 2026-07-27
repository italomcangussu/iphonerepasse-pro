import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCRIPTS,
  SCRIPT_CATEGORIES,
  formatScriptTemplate,
  buildWhatsAppLink,
} from './scriptLibrary';

describe('scriptLibrary', () => {
  it('contém categorias e scripts padrão válidos', () => {
    expect(DEFAULT_SCRIPTS.length).toBeGreaterThan(0);
    expect(Object.keys(SCRIPT_CATEGORIES)).toContain('trade_in');
    
    DEFAULT_SCRIPTS.forEach((script) => {
      expect(script.id).toBeTruthy();
      expect(script.title).toBeTruthy();
      expect(script.template).toContain('{nome}');
    });
  });

  it('formatScriptTemplate substitui as variáveis informadas', () => {
    const template = 'Olá {nome}, seu {modelo} é top!';
    const formatted = formatScriptTemplate(template, {
      nome: 'Carlos',
      modelo: 'iPhone 13',
    });

    expect(formatted).toBe('Olá Carlos, seu iPhone 13 é top!');
  });

  it('formatScriptTemplate mantém o placeholder quando a variável não é passada', () => {
    const template = 'Olá {nome}, tudo bem com seu {modelo}?';
    const formatted = formatScriptTemplate(template, {
      nome: 'Ana',
    });

    expect(formatted).toBe('Olá Ana, tudo bem com seu {modelo}?');
  });

  it('buildWhatsAppLink cria o link wa.me corretamente', () => {
    const link = buildWhatsAppLink('(85) 99999-8888', 'Olá mundo!');
    expect(link).toContain('https://wa.me/5585999998888');
    expect(link).toContain('text=Ol%C3%A1%20mundo!');
  });

  it('buildWhatsAppLink lida com telefone que já tem 55', () => {
    const link = buildWhatsAppLink('5585999998888', 'Teste');
    expect(link).toContain('https://wa.me/5585999998888');
  });

  it('buildWhatsAppLink retorna string vazia se o telefone for inválido', () => {
    expect(buildWhatsAppLink('', 'Teste')).toBe('');
  });
});
