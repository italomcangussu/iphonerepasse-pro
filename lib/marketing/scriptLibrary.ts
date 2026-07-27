/**
 * Biblioteca de scripts de vendas e copywriting comercial para revenda de iPhones.
 *
 * Contém modelos de mensagens altamente conversivas direcionadas para diferentes
 * momentos da jornada do cliente (Trade-in upgrade, win-back, pós-venda, acessórios).
 */

export type ScriptCategory = 'trade_in' | 'win_back' | 'post_sale' | 'accessories' | 'new_stock';

export interface SalesScript {
  id: string;
  title: string;
  category: ScriptCategory;
  categoryLabel: string;
  emoji: string;
  recommendedSegment: string;
  template: string;
  description: string;
}

export const SCRIPT_CATEGORIES: Record<ScriptCategory, { label: string; emoji: string }> = {
  trade_in: { label: 'Upgrade & Trade-In', emoji: '🔄' },
  win_back: { label: 'Reativação (Win-Back)', emoji: '😴' },
  post_sale: { label: 'Pós-Venda & Avaliação', emoji: '⭐' },
  accessories: { label: 'Acessórios & Proteção', emoji: '🛡️' },
  new_stock: { label: 'Chegada de Estoque VIP', emoji: '🚀' },
};

export const DEFAULT_SCRIPTS: SalesScript[] = [
  {
    id: 'trade_in_upgrade',
    title: 'Oferta de Upgrade com Trade-In',
    category: 'trade_in',
    categoryLabel: SCRIPT_CATEGORIES.trade_in.label,
    emoji: '🔄',
    recommendedSegment: 'Leais & Campeões',
    description: 'Proposta de recebimento do aparelho antigo como entrada para um novo modelo.',
    template:
      'Olá {nome}! Tudo bem? Vi que você adquiriu o seu {modelo} conosco. ' +
      'Estamos com uma condição especial de avaliação super valorizada para seu aparelho na troca por um iPhone mais novo. ' +
      'Podemos simular a diferença sem compromisso?',
  },
  {
    id: 'win_back_reactivation',
    title: 'Reativação de Cliente Dormente',
    category: 'win_back',
    categoryLabel: SCRIPT_CATEGORIES.win_back.label,
    emoji: '😴',
    recommendedSegment: 'Sumidos & Em Risco',
    description: 'Mensagem com gatilho de benefício exclusivo para recuperar clientes que não compram há tempo.',
    template:
      'Oi {nome}, sentimos sua falta por aqui! Como está o seu {modelo}? ' +
      'Preparamos um cupom especial de cashback exclusivo para sua próxima compra ou para atualizar seu aparelho esta semana. ' +
      'Diz pra mim se quer dar uma olhada nas novidades!',
  },
  {
    id: 'post_sale_review',
    title: 'Pós-Venda & Avaliação de Satisfação',
    category: 'post_sale',
    categoryLabel: SCRIPT_CATEGORIES.post_sale.label,
    emoji: '⭐',
    recommendedSegment: 'Novos & Campeões',
    description: 'Checagem de satisfação alguns dias após a compra e convite para avaliação no Google.',
    template:
      'Olá {nome}, passando para saber como está sendo sua experiência com o seu {modelo}! ' +
      'Está tudo funcionando 100%? Se puder nos dar esse feedback, ficaremos muito felizes. ' +
      'Sua opinião é super importante para nós!',
  },
  {
    id: 'accessories_protection',
    title: 'Kit Proteção & Bateria',
    category: 'accessories',
    categoryLabel: SCRIPT_CATEGORIES.accessories.label,
    emoji: '🛡️',
    recommendedSegment: 'Todos os Clientes',
    description: 'Oferta de capinhas premium, película de spigen/cerâmica e revisão de saúde da bateria.',
    template:
      'Fala {nome}! Chegaram capas de alta proteção e películas de cobertura total sob medida para o {modelo}. ' +
      'Também estamos fazendo revisão gratuita de bateria este mês. Quer garantir o seu kit com preço promocional de cliente?',
  },
  {
    id: 'new_stock_vip',
    title: 'Aviso de Lançamento / Estoque VIP',
    category: 'new_stock',
    categoryLabel: SCRIPT_CATEGORIES.new_stock.label,
    emoji: '🚀',
    recommendedSegment: 'Campeões & Leais',
    description: 'Aviso antecipado de aparelhos selecionados com bateria 100% ou na garantia antes de ir pro feed.',
    template:
      'Oi {nome}! Chegaram alguns aparelhos impecáveis (bateria alta, seminovos selecionados) e lembrei de você antes de postar no catálogo geral. ' +
      'Estou te mandando em primeira mão. Quer dar uma olhada nos modelos disponíveis hoje?',
  },
];

/**
 * Substitui variáveis do tipo `{nome}`, `{modelo}` por valores reais no template.
 */
export function formatScriptTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(placeholder, value || `{${key}}`);
  }
  return result;
}

/**
 * Normaliza o número de telefone e gera um link para o WhatsApp Direct (`wa.me`).
 */
export function buildWhatsAppLink(phone: string, text: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const cleanPhone = digits.startsWith('55') ? digits : `55${digits}`;
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}
