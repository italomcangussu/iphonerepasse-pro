import React from 'react';
import { Battery, Box, Calendar, Edit, Send, Smartphone, Store, Tag, Wrench } from 'lucide-react';
import Modal from './ui/Modal';
import { StockItem, StockStatus } from '../types';

interface StockDetailsModalProps {
  open: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onSendToSale?: () => void;
  isSendingToSale?: boolean;
  item?: StockItem;
  storeName?: string;
}

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const StockDetailsModal: React.FC<StockDetailsModalProps> = ({
  open,
  onClose,
  onEdit,
  onSendToSale,
  isSendingToSale = false,
  item,
  storeName
}) => {
  if (!item) return null;

  const repairCosts = item.costs?.reduce((acc, cost) => acc + cost.amount, 0) || 0;
  const totalCost = item.purchasePrice + repairCosts;
  const profit = item.sellPrice - totalCost;
  const entryDate = item.entryDate ? new Date(item.entryDate).toLocaleDateString('pt-BR') : '-';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Detalhes do Aparelho"
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="ios-button-secondary">
            Fechar
          </button>
          {item.status === StockStatus.PREPARATION && onSendToSale && (
            <button
              type="button"
              onClick={onSendToSale}
              className="ios-button-primary flex items-center gap-2"
              disabled={isSendingToSale}
            >
              <Send size={16} />
              {isSendingToSale ? 'Enviando...' : 'Enviar para venda'}
            </button>
          )}
          {onEdit && (
            <button type="button" onClick={onEdit} className="ios-button-primary flex items-center gap-2">
              <Edit size={16} />
              Editar
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
          <div className="rounded-ios-xl bg-gray-100 dark:bg-surface-dark-200 border border-gray-200 dark:border-surface-dark-300 overflow-hidden h-[220px]">
            {item.photos && item.photos.length > 0 ? (
              <img src={item.photos[0]} alt={item.model} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-surface-dark-500">
                <Smartphone size={42} />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{item.model}</h3>
              <p className="text-sm text-gray-500 dark:text-surface-dark-500">
                {[item.capacity, item.color].filter(Boolean).join(' · ') || 'Sem detalhes'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="ios-badge-blue">{item.condition}</span>
              <span className={item.status === 'Em Preparação' ? 'ios-badge-orange' : 'ios-badge-green'}>{item.status}</span>
              <span className={item.hasBox ? 'ios-badge-blue' : 'ios-badge bg-gray-200 text-gray-700 dark:bg-surface-dark-300 dark:text-surface-dark-600'}>
                <Box size={12} className="mr-1" /> {item.hasBox ? 'Com caixa' : 'Sem caixa'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="ios-card p-3">
                <p className="text-xs text-gray-500 dark:text-surface-dark-500 mb-1">IMEI</p>
                <p className="font-mono text-gray-800 dark:text-surface-dark-700 break-all">{item.imei || '-'}</p>
              </div>
              <div className="ios-card p-3">
                <p className="text-xs text-gray-500 dark:text-surface-dark-500 mb-1">Loja</p>
                <p className="font-medium text-gray-800 dark:text-surface-dark-700 flex items-center gap-1">
                  <Store size={14} />
                  {storeName || '-'}
                </p>
              </div>
              <div className="ios-card p-3">
                <p className="text-xs text-gray-500 dark:text-surface-dark-500 mb-1">Entrada</p>
                <p className="font-medium text-gray-800 dark:text-surface-dark-700 flex items-center gap-1">
                  <Calendar size={14} />
                  {entryDate}
                </p>
              </div>
              <div className="ios-card p-3">
                <p className="text-xs text-gray-500 dark:text-surface-dark-500 mb-1">Bateria</p>
                <p className="font-medium text-gray-800 dark:text-surface-dark-700 flex items-center gap-1">
                  <Battery size={14} />
                  {item.batteryHealth ? `${item.batteryHealth}%` : '-'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="ios-card p-4">
            <p className="text-xs text-gray-500 dark:text-surface-dark-500 mb-1">Custo Base</p>
            <p className="font-bold text-gray-900 dark:text-white">{formatCurrency(item.purchasePrice)}</p>
          </div>
          <div className="ios-card p-4">
            <p className="text-xs text-gray-500 dark:text-surface-dark-500 mb-1">Custos Extras</p>
            <p className="font-bold text-gray-900 dark:text-white">{formatCurrency(repairCosts)}</p>
          </div>
          <div className="ios-card p-4">
            <p className="text-xs text-gray-500 dark:text-surface-dark-500 mb-1">Custo Total</p>
            <p className="font-bold text-gray-900 dark:text-white">{formatCurrency(totalCost)}</p>
          </div>
          <div className="ios-card p-4">
            <p className="text-xs text-gray-500 dark:text-surface-dark-500 mb-1">Venda</p>
            <p className="font-bold text-gray-900 dark:text-white">{formatCurrency(item.sellPrice)}</p>
          </div>
          <div className="ios-card p-4 md:col-span-2">
            <p className="text-xs text-gray-500 dark:text-surface-dark-500 mb-1">Lucro Estimado</p>
            <p className={`font-bold ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatCurrency(profit)}
            </p>
          </div>
        </div>

        <div className="ios-card p-4">
          <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
            <Tag size={16} />
            Observacoes
          </p>
          <p className="text-sm text-gray-700 dark:text-surface-dark-700 whitespace-pre-wrap">
            {item.observations || item.notes || 'Sem observacoes.'}
          </p>
        </div>

        <div className="ios-card p-4">
          <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
            <Wrench size={16} />
            Historico de Custos
          </p>
          {(item.costs || []).length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-surface-dark-500">Nenhum custo adicional registrado.</p>
          ) : (
            <div className="space-y-2">
              {item.costs.map((cost) => (
                <div
                  key={cost.id}
                  className="flex items-center justify-between rounded-ios border border-gray-200 dark:border-surface-dark-300 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-surface-dark-700">{cost.description}</p>
                    <p className="text-xs text-gray-500 dark:text-surface-dark-500">
                      {new Date(cost.date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(cost.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
