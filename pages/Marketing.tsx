import React, { useMemo, useState } from 'react';
import { Filter, Users, Mail, Phone } from 'lucide-react';
import { useData } from '../services/dataContext';
import { useSalesHistoryDemand } from '../hooks/useDataGroupDemand';

const Marketing: React.FC = () => {
  const { sales, customers } = useData();
  const salesHistoryLoading = useSalesHistoryDemand();

  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedModel, setSelectedModel] = useState<string>('all');

  // Extract unique types and models from sales history
  const { availableTypes, availableModels } = useMemo(() => {
    const types = new Set<string>();
    const models = new Set<string>();

    sales.forEach((sale) => {
      sale.items.forEach((item) => {
        if (item.type) types.add(item.type);
        if (item.model) {
          // If a type is selected, only add models of that type
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

  // Handle type change - reset model if type changes
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedType(e.target.value);
    setSelectedModel('all');
  };

  // Filter customers based on sales of the selected type/model
  const filteredCustomers = useMemo(() => {
    if (selectedType === 'all' && selectedModel === 'all') return [];

    const matchingCustomerIds = new Set<string>();

    sales.forEach((sale) => {
      const hasMatch = sale.items.some((item) => {
        const typeMatch = selectedType === 'all' || item.type === selectedType;
        const modelMatch = selectedModel === 'all' || item.model === selectedModel;
        return typeMatch && modelMatch;
      });

      if (hasMatch && sale.customerId) {
        matchingCustomerIds.add(sale.customerId);
      }
    });

    return customers.filter((c) => matchingCustomerIds.has(c.id));
  }, [sales, customers, selectedType, selectedModel]);

  return (
    <div className="space-y-4 md:space-y-6">
      {salesHistoryLoading && <p role="status" className="text-ios-subhead app-text-muted">Carregando historico de vendas...</p>}
      <section className="ios-card p-4 md:p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Relacionamento</p>
          <h1 className="text-ios-title-1 font-bold text-gray-900 dark:text-white mt-1">Marketing e Automações</h1>
          <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-1">
            Filtre clientes por aparelhos comprados para ações comerciais.
          </p>
        </div>
      </section>

      <section className="ios-card p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-2 text-gray-700 dark:text-surface-dark-700">
          <Filter size={16} />
          <p className="text-ios-subhead font-semibold">Filtros de Audiência</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <option value="all">Selecione um tipo...</option>
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
      </section>

      {(selectedType !== 'all' || selectedModel !== 'all') && (
        <section className="ios-card overflow-hidden">
          <div className="p-4 md:p-6 border-b border-gray-200 dark:border-surface-dark-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-ios-title-3 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users size={20} className="text-brand-500" />
                Clientes Encontrados ({filteredCustomers.length})
              </h2>
              <p className="text-sm text-gray-500 dark:text-surface-dark-500 mt-1">
                Compradores de {selectedModel !== 'all' ? selectedModel : selectedType}
              </p>
            </div>
            
            <button className="ios-button-primary opacity-50 cursor-not-allowed" title="Em breve">
              Criar Automação
            </button>
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
                    <th className="p-4 font-medium">Nome</th>
                    <th className="p-4 font-medium">Contato</th>
                    <th className="p-4 font-medium text-right">Total Gasto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-200">
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-surface-dark-200/50 transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {customer.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-surface-dark-500 mt-0.5">
                          CPF: {customer.cpf || 'Não informado'}
                        </div>
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
                          R$ {customer.totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <div className="text-xs text-gray-500 dark:text-surface-dark-500 mt-0.5">
                          {customer.purchases} compra(s)
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default Marketing;
