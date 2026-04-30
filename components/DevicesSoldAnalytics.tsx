import React, { useState, useMemo } from 'react';
import { useData } from '../services/dataContext';
import { Condition } from '../types';
import { Smartphone, Filter } from 'lucide-react';
import { m, useReducedMotion } from 'framer-motion';

const DevicesSoldAnalytics: React.FC = () => {
  const { sales } = useData();
  const reducedMotion = useReducedMotion();
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('30d');

  const uniqueModels = useMemo(() => {
    const models = new Set<string>();
    sales.forEach(sale => {
      sale.items.forEach(item => {
        if (item.model) models.add(item.model);
      });
    });
    return Array.from(models).sort();
  }, [sales]);

  const filteredCount = useMemo(() => {
    const now = new Date();
    let cutoff = new Date(0);
    
    if (selectedPeriod === '7d') {
      cutoff = new Date();
      cutoff.setDate(now.getDate() - 7);
    } else if (selectedPeriod === '30d') {
      cutoff = new Date();
      cutoff.setDate(now.getDate() - 30);
    } else if (selectedPeriod === '90d') {
      cutoff = new Date();
      cutoff.setDate(now.getDate() - 90);
    }

    let count = 0;
    sales.forEach(sale => {
      const saleDate = new Date(sale.date);
      if (saleDate >= cutoff) {
        sale.items.forEach(item => {
          const matchModel = selectedModel === 'all' || item.model === selectedModel;
          const matchCondition = selectedCondition === 'all' || item.condition === selectedCondition;
          if (matchModel && matchCondition) {
            count++;
          }
        });
      }
    });
    return count;
  }, [sales, selectedModel, selectedCondition, selectedPeriod]);

  return (
    <div className="ios-card p-4 md:p-6 min-w-0">
      <div className="flex items-center gap-2 mb-4 md:mb-6">
        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
          <Smartphone size={20} />
        </div>
        <h3 className="text-ios-title-3 font-bold app-text-primary">Aparelhos Vendidos</h3>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <label className="block text-ios-caption app-text-secondary font-medium mb-1.5">
            Período
          </label>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="w-full ios-input bg-surface-50 dark:bg-surface-dark-200"
          >
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
            <option value="all">Todo o período</option>
          </select>
        </div>

        <div className="flex-1 min-w-0">
          <label className="block text-ios-caption app-text-secondary font-medium mb-1.5">
            Condição
          </label>
          <select
            value={selectedCondition}
            onChange={(e) => setSelectedCondition(e.target.value)}
            className="w-full ios-input bg-surface-50 dark:bg-surface-dark-200"
          >
            <option value="all">Todas</option>
            <option value={Condition.NEW}>Novos</option>
            <option value={Condition.USED}>Seminovos</option>
          </select>
        </div>

        <div className="flex-1 min-w-0">
          <label className="block text-ios-caption app-text-secondary font-medium mb-1.5">
            Modelo
          </label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full ios-input bg-surface-50 dark:bg-surface-dark-200"
          >
            <option value="all">Todos os modelos</option>
            {uniqueModels.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>
      </div>

      <m.div
        key={filteredCount}
        initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-brand-50 dark:bg-brand-900/20 rounded-ios-lg p-6 text-center border border-brand-100 dark:border-brand-800/50"
      >
        <span className="block text-5xl font-extrabold text-brand-600 dark:text-brand-400 tabular-nums tracking-tight">
          {filteredCount}
        </span>
        <span className="block mt-2 text-ios-subhead font-medium text-brand-700 dark:text-brand-300">
          {filteredCount === 1 ? 'Aparelho vendido' : 'Aparelhos vendidos'}
        </span>
      </m.div>
    </div>
  );
};

export default DevicesSoldAnalytics;
