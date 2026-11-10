import React from 'react';
import { itemDetail, itemLabel } from '../../lib/companies';
import type { TransferableItem } from '../../services/tenants';

type ItemsChecklistProps = {
  items: TransferableItem[];
  selected: Set<string>;
  onToggle: (itemId: string) => void;
  onToggleAll: () => void;
};

const selectionText = (selectedCount: number, total: number) =>
  selectedCount > 0 ? `${selectedCount} de ${total} selecionados` : `Selecionar todos (${total})`;

export default function ItemsChecklist({ items, selected, onToggle, onToggleAll }: ItemsChecklistProps) {
  const allSelected = selected.size === items.length;
  return (
    <div className="rounded-ios-lg border border-gray-200 dark:border-surface-dark-300">
      <label className="flex min-h-12 cursor-pointer items-center gap-3 border-b border-gray-100 px-3 dark:border-surface-dark-300">
        <input type="checkbox" checked={allSelected} onChange={onToggleAll} className="h-5 w-5 accent-brand-500" />
        <span className="text-ios-subhead font-semibold text-gray-900 dark:text-white">{selectionText(selected.size, items.length)}</span>
      </label>
      <ul className="max-h-[50vh] divide-y divide-gray-100 overflow-y-auto dark:divide-surface-dark-300">
        {items.map((item) => (
          <li key={item.id}>
            <label className="flex min-h-[60px] cursor-pointer items-center gap-3 px-3 py-2">
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => onToggle(item.id)}
                className="h-5 w-5 shrink-0 accent-brand-500"
              />
              <span className="min-w-0">
                <span className="block truncate text-ios-subhead font-semibold text-gray-900 dark:text-white">{itemLabel(item)}</span>
                <span className="block truncate text-ios-caption text-gray-500 dark:text-surface-dark-500">{itemDetail(item)}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
