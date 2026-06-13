import React, { useMemo, useState } from 'react';
import { useDisclosure } from '../hooks/useDisclosure';
import { Edit, Package, Plus, Trash2 } from 'lucide-react';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/ToastProvider';
import { useAsyncHandler } from '../hooks/useAsyncHandler';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../services/dataContext';
import type { PartStockItem } from '../types';
import { formatCurrencyBRL } from '../utils/inputMasks';
import { useFinanceDemand } from '../hooks/useDataGroupDemand';

const PartsStock: React.FC = () => {
  const { partsInventory, addPart, updatePart, removePart } = useData();
  useFinanceDemand();
  const { role } = useAuth();
  const toast = useToast();
  const run = useAsyncHandler();

  const { isOpen: isModalOpen, open: openModal, close: closeModal } = useDisclosure();
  const [editingPart, setEditingPart] = useState<PartStockItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    quantity: '',
    unitCost: ''
  });

  const summary = useMemo(() => {
    const totalItems = partsInventory.length;
    const totalUnits = partsInventory.reduce((acc, item) => acc + item.quantity, 0);
    const totalValue = partsInventory.reduce((acc, item) => acc + item.quantity * item.unitCost, 0);
    return { totalItems, totalUnits, totalValue };
  }, [partsInventory]);

  const openNewModal = () => {
    setEditingPart(null);
    setForm({ name: '', quantity: '', unitCost: '' });
    openModal();
  };

  const openEditModal = (part: PartStockItem) => {
    setEditingPart(part);
    setForm({
      name: part.name,
      quantity: String(part.quantity),
      unitCost: String(part.unitCost)
    });
    openModal();
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const quantity = Number(form.quantity);
    const unitCost = Number(form.unitCost);

    if (!name) {
      toast.error('Informe o nome da peça.');
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      toast.error('Informe uma quantidade válida.');
      return;
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      toast.error('Informe um custo unitário válido.');
      return;
    }

    await run(async () => {
      if (editingPart) {
        await updatePart(editingPart.id, { name, quantity, unitCost });
        toast.success('Peça atualizada com sucesso.');
      } else {
        await addPart({ name, quantity, unitCost });
        toast.success('Peça adicionada com sucesso.');
      }
      closeModal();
    }, { errorMsg: 'Não foi possível salvar a peça.', setLoading: setIsSaving });
  };

  const handleDelete = async (part: PartStockItem) => {
    if (role !== 'admin') {
      toast.error('Somente administrador pode excluir peças.');
      return;
    }

    await run(async () => {
      await removePart(part.id);
      toast.success('Peça removida.');
    }, 'Não foi possível remover a peça.');
  };

  return (
    <div className="space-y-5 md:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h2 className="text-[28px] md:text-ios-large font-bold text-gray-900 dark:text-white tracking-tight">Estoque de Peças</h2>
          <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-0.5">Controle de peças usadas em aparelhos em preparação</p>
        </div>
        <button onClick={openNewModal} className="ios-button-primary flex items-center gap-2 w-full md:w-auto justify-center">
          <Plus size={18} />
          Adicionar Peça
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="ios-card p-4">
          <p className="text-ios-caption uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">Itens</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.totalItems}</p>
        </div>
        <div className="ios-card p-4">
          <p className="text-ios-caption uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">Quantidade Total</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.totalUnits}</p>
        </div>
        <div className="ios-card p-4">
          <p className="text-ios-caption uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">Valor em Estoque</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrencyBRL(summary.totalValue)}</p>
        </div>
      </div>

      <div className="ios-card overflow-hidden">
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-[38%]" />
            <col className="w-[12%]" />
            <col className="w-[18%]" />
            <col className="w-[16%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead className="bg-gray-50 dark:bg-surface-dark-200 text-xs uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Peça</th>
              <th className="text-right px-4 py-3 font-semibold">Qtd</th>
              <th className="text-right px-4 py-3 font-semibold">Custo Unit.</th>
              <th className="text-right px-4 py-3 font-semibold">Total</th>
              <th className="text-right px-4 py-3 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-300">
            {partsInventory.map((part) => (
              <tr key={part.id} className="hover:bg-gray-50/80 dark:hover:bg-surface-dark-200/60 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Package size={16} className="text-brand-500 shrink-0" />
                    <span className="font-semibold text-gray-900 dark:text-white wrap-break-word">{part.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-surface-dark-700">{part.quantity}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-surface-dark-700">
                  {formatCurrencyBRL(part.unitCost)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                  {formatCurrencyBRL(part.quantity * part.unitCost)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(part)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-ios border border-brand-200 dark:border-brand-800 text-xs font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/20"
                    >
                      <Edit size={14} />
                      Editar
                    </button>
                    {role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => handleDelete(part)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-ios border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                        Excluir
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {partsInventory.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500 dark:text-surface-dark-500">
                  Nenhuma peça cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={isModalOpen}
        onClose={() => {
          if (isSaving) return;
          closeModal();
        }}
        title={editingPart ? 'Editar Peça' : 'Adicionar Peça'}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" className="ios-button-secondary" onClick={() => closeModal()} disabled={isSaving}>
              Cancelar
            </button>
            <button type="button" className="ios-button-primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Salvando...' : editingPart ? 'Salvar Alterações' : 'Adicionar Peça'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="ios-label">Nome da peça</label>
            <input
              type="text"
              className="ios-input"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: BATERIA 14PM DECODE"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="ios-label">Quantidade</label>
              <input
                type="number"
                className="ios-input"
                min={0}
                step={1}
                onFocus={(e) => e.target.select()}
                value={form.quantity}
                onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className="ios-label">Custo unitário (R$)</label>
              <input
                type="number"
                className="ios-input"
                min={0}
                step="0.01"
                onFocus={(e) => e.target.select()}
                value={form.unitCost}
                onChange={(e) => setForm((prev) => ({ ...prev, unitCost: e.target.value }))}
                placeholder="0,00"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PartsStock;
