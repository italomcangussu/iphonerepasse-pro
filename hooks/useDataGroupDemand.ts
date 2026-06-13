import { useEffect } from 'react';
import { useData } from '../services/dataContext';

export const useSalesHistoryDemand = (): boolean => {
  const { salesHistoryLoading = false, ensureSalesHistoryLoaded } = useData();

  useEffect(() => {
    void ensureSalesHistoryLoaded?.();
  }, [ensureSalesHistoryLoaded]);

  return salesHistoryLoading;
};

export const useFinanceDemand = (): boolean => {
  const { financeLoading = false, ensureFinanceLoaded } = useData();

  useEffect(() => {
    void ensureFinanceLoaded?.();
  }, [ensureFinanceLoaded]);

  return financeLoading;
};
