import React, { useMemo, useState } from 'react';
import { Filter, Users, Mail, Phone, Search, Copy, Check, Send, Sparkles, DollarSign } from 'lucide-react';
import { useData } from '../../services/dataContext';
import { getCpfOrCnpjLabel } from '../../utils/inputMasks';
import { computeCampaignPlan, CampaignSegment } from '../../lib/marketing/campaigns';
import { SEGMENT_META, SEGMENT_COLOR, formatBRL } from '../../lib/marketing/campaignInsights';
import { buildWhatsAppLink } from '../../lib/marketing/scriptLibrary';
import { computeAudienceStats, matchesMinimumRecency } from '../../lib/marketing/audience';

const AudienceTab: React.FC = () => {
  const { sales, customers, stock } = useData();

  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [selectedSegment, setSelectedSegment] = useState<string>('all');
  const [recencyFilter, setRecencyFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedContacts, setCopiedContacts] = useState<boolean>(false);

  // Calcula o plano RFM para obter a segmentação dos clientes
  const plan = useMemo(
    () => computeCampaignPlan(sales, customers, stock, { periodDays: null }),
    [sales, customers, stock]
  );

  // Mapeamento id -> cliente RFM
  const rfmMap = useMemo(() => {
    const map = new Map<string, (typeof plan.customers)[0]>();
    plan.customers.forEach((c) => {
      map.set(c.customerId, c);
    });
    return map;
  }, [plan]);

  const { availableTypes, availableModels } = useMemo(() => {
    const types = new Set<string>();
    const models = new Set<string>();

    sales.forEach((sale) => {
      sale.items.forEach((item) => {
        if (item.type) types.add(item.type);
        if (item.model) {
          if (selectedType === 'all' || item.type === selectedType) {
            models.add(item.model);
          }
        }
      });
    });

    return {
      availableTypes: Array.from(types).sort(),
      availableModels: Array.from(models).sort(),
    };
  }, [sales, selectedType]);

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedType(e.target.value);
    setSelectedModel('all');
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      // 1. Filtro por tipo / modelo comprado
      if (selectedType !== 'all' || selectedModel !== 'all') {
        const hasMatchingSale = sales.some(
          (sale) =>
            sale.customerId === customer.id &&
            sale.items.some((item) => {
              const typeMatch = selectedType === 'all' || item.type === selectedType;
              const modelMatch = selectedModel === 'all' || item.model === selectedModel;
              return typeMatch && modelMatch;
            })
        );
        if (!hasMatchingSale) return false;
      }

      const rfm = rfmMap.get(customer.id);

      // 2. Filtro por segmento RFM
      if (selectedSegment !== 'all') {
        if (!rfm || rfm.segment !== selectedSegment) return false;
      }

      // 3. Filtro por recência sem comprar
      if (recencyFilter !== 'all') {
        const minDays = parseInt(recencyFilter, 10);
        if (!matchesMinimumRecency(rfm, minDays)) return false;
      }

      // 4. Busca por texto (nome, telefone, e-mail, CPF)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (customer.name || '').toLowerCase().includes(q);
        const phoneMatch = (customer.phone || '').includes(q);
        const emailMatch = (customer.email || '').toLowerCase().includes(q);
        const cpfMatch = (customer.cpf || '').includes(q);

        if (!nameMatch && !phoneMatch && !emailMatch && !cpfMatch) return false;
      }

      return true;
    });
  }, [customers, sales, selectedType, selectedModel, selectedSegment, recencyFilter, searchQuery, rfmMap]);

  // Estatísticas resumo da audiência filtrada
  const stats = useMemo(() => computeAudienceStats(filteredCustomers), [filteredCustomers]);

  const handleCopyContacts = () => {
    const contactsList = filteredCustomers
      .map((c) => `${c.name}: ${c.phone || 'Sem telefone'}`)
      .join('\n');
    navigator.clipboard.writeText(contactsList);
    setCopiedContacts(true);
    setTimeout(() => setCopiedContacts(false), 2000);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Filtros da Audiência */}
      <section className="ios-card p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-2 text-gray-700 dark:text-surface-dark-700">
          <Filter size={16} />
          <p className="text-ios-subhead font-semibold">Filtros de Audiência Inteligente</p>
        </div>

        {/* Linha 1: Busca e Seleção de Aparelho */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="min-w-0">
            <label htmlFor="marketing-search-filter" className="ios-label">
              Buscar Cliente
            </label>
            <div className="relative">
              <input
                id="marketing-search-filter"
                type="text"
                className="ios-input pl-9"
                placeholder="Nome, telefone, e-mail ou CPF..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          <div className="min-w-0">
            <label htmlFor="marketing-type-filter" className="ios-label">
              Tipo de Aparelho
            </label>
            <select
              id="marketing-type-filter"
              className="ios-input"
              value={selectedType}
              onChange={handleTypeChange}
            >
              <option value="all">Todos os tipos...</option>
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label htmlFor="marketing-model-filter" className="ios-label">
              Modelo do Aparelho
            </label>
            <select
              id="marketing-model-filter"
              className="ios-input"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={selectedType === 'all'}
            >
              <option value="all">Todos os modelos...</option>
              {availableModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Linha 2: Filtros RFM e Recência */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 dark:border-surface-dark-200 pt-3">
          <div className="min-w-0">
            <label htmlFor="marketing-segment-filter" className="ios-label">
              Segmento de Cliente (RFM)
            </label>
            <select
              id="marketing-segment-filter"
              className="ios-input"
              value={selectedSegment}
              onChange={(e) => setSelectedSegment(e.target.value)}
            >
              <option value="all">Todos os segmentos...</option>
              {Object.entries(SEGMENT_META).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.emoji} {meta.label} ({meta.action})
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label htmlFor="marketing-recency-filter" className="ios-label">
              Tempo Sem Comprar
            </label>
            <select
              id="marketing-recency-filter"
              className="ios-input"
              value={recencyFilter}
              onChange={(e) => setRecencyFilter(e.target.value)}
            >
              <option value="all">Qualquer período...</option>
              <option value="60">Mais de 60 dias</option>
              <option value="90">Mais de 90 dias</option>
              <option value="180">Mais de 180 dias</option>
              <option value="365">Mais de 1 ano</option>
            </select>
          </div>
        </div>
      </section>

      {/* KPI Cards da Audiência Selecionada */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="ios-card p-4 flex flex-col justify-between">
          <span className="text-ios-caption-1 text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <Users size={14} className="text-brand-500" /> Clientes Filtrados
          </span>
          <span className="text-ios-title-2 font-bold text-gray-900 dark:text-white mt-1">
            {stats.count}
          </span>
        </div>

        <div className="ios-card p-4 flex flex-col justify-between">
          <span className="text-ios-caption-1 text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <DollarSign size={14} className="text-green-500" /> Receita Total Acumulada
          </span>
          <span className="text-ios-title-2 font-bold text-gray-900 dark:text-white mt-1">
            {formatBRL(stats.totalSpent)}
          </span>
        </div>

        <div className="ios-card p-4 flex flex-col justify-between">
          <span className="text-ios-caption-1 text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-500" /> Ticket Médio por Compra
          </span>
          <span className="text-ios-title-2 font-bold text-gray-900 dark:text-white mt-1">
            {formatBRL(stats.avgTicket)}
          </span>
        </div>
      </div>

      {/* Tabela de Resultados */}
      <section className="ios-card overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-200 dark:border-surface-dark-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-ios-title-3 font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users size={20} className="text-brand-500" />
              Lista de Clientes ({filteredCustomers.length})
            </h2>
            <p className="text-sm text-gray-500 dark:text-surface-dark-500 mt-1">
              {filteredCustomers.length} cliente(s) correspondente(s) aos critérios selecionados.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyContacts}
              disabled={filteredCustomers.length === 0}
              className={`ios-button-secondary text-ios-footnote flex items-center gap-1.5 ${
                filteredCustomers.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {copiedContacts ? (
                <>
                  <Check size={14} className="text-green-600 dark:text-green-400" />
                  <span>Lista Copiada!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copiar Contatos</span>
                </>
              )}
            </button>
          </div>
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-ios-body text-gray-600 dark:text-surface-dark-600">
              Nenhum cliente encontrado para os filtros selecionados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-ios-footnote text-gray-500 border-b border-gray-200 dark:border-surface-dark-200 bg-gray-50 dark:bg-surface-dark-200">
                  <th className="p-4 font-medium">Nome & CPF</th>
                  <th className="p-4 font-medium">Segmento RFM</th>
                  <th className="p-4 font-medium">Contato</th>
                  <th className="p-4 font-medium text-right">Total Gasto</th>
                  <th className="p-4 font-medium text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-200">
                {filteredCustomers.map((customer) => {
                  const rfm = rfmMap.get(customer.id);
                  const meta = rfm ? SEGMENT_META[rfm.segment as CampaignSegment] : null;
                  const waLink = customer.phone
                    ? buildWhatsAppLink(
                        customer.phone,
                        `Olá ${customer.name}, tudo bem? Temos novidades para você no iPhoneRepasse Pro!`
                      )
                    : '';

                  return (
                    <tr
                      key={customer.id}
                      className="hover:bg-gray-50 dark:hover:bg-surface-dark-200/50 transition-colors"
                    >
                      <td className="p-4">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {customer.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-surface-dark-500 mt-0.5">
                          {getCpfOrCnpjLabel(customer.cpf)}: {customer.cpf || 'Não informado'}
                        </div>
                      </td>
                      <td className="p-4">
                        {meta ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: `${SEGMENT_COLOR[rfm!.segment as CampaignSegment]}15`,
                              color: SEGMENT_COLOR[rfm!.segment as CampaignSegment],
                            }}
                          >
                            <span>{meta.emoji}</span>
                            <span>{meta.label}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-4 space-y-1">
                        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-surface-dark-700">
                          <Phone size={14} className="text-gray-400" />
                          {customer.phone || 'Não informado'}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-surface-dark-700">
                          <Mail size={14} className="text-gray-400" />
                          {customer.email || 'Não informado'}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {formatBRL(customer.totalSpent)}
                        </span>
                        <div className="text-xs text-gray-500 dark:text-surface-dark-500 mt-0.5">
                          {customer.purchases} compra(s)
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        {waLink ? (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ios-button-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1"
                          >
                            <Send size={12} />
                            <span>WhatsApp</span>
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">Sem telefone</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default AudienceTab;
