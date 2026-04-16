import React from "react";
import type { StoreLocation } from "../../types";

type CRMStoreFilterProps = {
  stores: StoreLocation[];
  selectedStoreId: string;
  onStoreChange: (storeId: string) => void;
};

const CRMStoreFilter: React.FC<CRMStoreFilterProps> = ({ stores, selectedStoreId, onStoreChange }) => {
  return (
    <div className="crm-card p-4">
      <label className="crm-field-label">Loja</label>
      <select
        className="crm-input"
        value={selectedStoreId}
        onChange={(event) => onStoreChange(event.target.value)}
      >
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default CRMStoreFilter;
