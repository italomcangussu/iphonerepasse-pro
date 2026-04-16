import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useData } from "../../services/dataContext";
import type { StoreLocation } from "../../types";

const STORAGE_KEY = "crm_plus_selected_store_id";

type CRMStoreContextValue = {
  stores: StoreLocation[];
  selectedStoreId: string;
  selectedStore: StoreLocation | null;
  setSelectedStoreId: (storeId: string) => void;
};

const CRMStoreContext = createContext<CRMStoreContextValue | undefined>(undefined);

export const CRMStoreProvider = ({ children }: { children: ReactNode }) => {
  const { stores } = useData();
  const [selectedStoreId, setSelectedStoreIdState] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(STORAGE_KEY) || "";
  });

  useEffect(() => {
    if (stores.length === 0) {
      if (selectedStoreId) setSelectedStoreIdState("");
      return;
    }

    const hasSelectedStore = stores.some((store) => store.id === selectedStoreId);
    if (!selectedStoreId || !hasSelectedStore) {
      setSelectedStoreIdState(stores[0].id);
    }
  }, [selectedStoreId, stores]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!selectedStoreId) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, selectedStoreId);
  }, [selectedStoreId]);

  const selectedStore = useMemo(
    () => stores.find((store) => store.id === selectedStoreId) || null,
    [stores, selectedStoreId],
  );

  const setSelectedStoreId = useCallback((storeId: string) => {
    setSelectedStoreIdState(storeId);
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
