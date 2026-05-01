import { createContext, createElement, useCallback, useContext, useMemo, type ReactNode, type FC } from "react";
import { useData } from "../../services/dataContext";
import type { StoreLocation } from "../../types";

type CRMStoreContextValue = {
  stores: StoreLocation[];
  selectedStoreId: string;
  selectedStore: StoreLocation | null;
  setSelectedStoreId: (storeId: string) => void;
};

const CRMStoreContext = createContext<CRMStoreContextValue | undefined>(undefined);

export const CRMStoreProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { stores } = useData();

  const fallbackStore = useMemo(
    () => [...stores].sort((a, b) => (
      a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id, "pt-BR")
    ))[0] || null,
    [stores],
  );

  const selectedStore = useMemo(
    () => fallbackStore,
    [fallbackStore],
  );

  const selectedStoreId = selectedStore?.id || "";

  const setSelectedStoreId = useCallback((_storeId: string) => {
    // Kept for backward compatibility with older consumers. CRM Plus is unified now.
  }, []);

  const value = useMemo(
    () => ({
      stores,
      selectedStoreId,
      selectedStore,
      setSelectedStoreId,
    }),
    [selectedStore, selectedStoreId, setSelectedStoreId, stores],
  );

  return createElement(CRMStoreContext.Provider, { value }, children);
};

export function useCRMStore() {
  const ctx = useContext(CRMStoreContext);
  if (!ctx) {
    throw new Error("useCRMStore must be used within CRMStoreProvider.");
  }
  return ctx;
}
