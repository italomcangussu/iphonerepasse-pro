import { useEffect, useMemo, useState } from "react";
import { useData } from "../../services/dataContext";

const STORAGE_KEY = "crm_plus_selected_store_id";

export function useCRMStore() {
  const { stores } = useData();
  const [selectedStoreId, setSelectedStoreId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(STORAGE_KEY) || "";
  });

  useEffect(() => {
    if (!selectedStoreId && stores.length > 0) {
      setSelectedStoreId(stores[0].id);
    }
  }, [selectedStoreId, stores]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!selectedStoreId) return;
    window.localStorage.setItem(STORAGE_KEY, selectedStoreId);
  }, [selectedStoreId]);

  const selectedStore = useMemo(
    () => stores.find((store) => store.id === selectedStoreId) || null,
    [stores, selectedStoreId],
  );

  return {
    stores,
    selectedStoreId,
    selectedStore,
    setSelectedStoreId,
  };
}
