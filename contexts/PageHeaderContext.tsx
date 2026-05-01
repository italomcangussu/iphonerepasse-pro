import React, { createContext, useContext, useState, useCallback } from 'react';

interface PageHeaderState {
  title: string;
  actions: React.ReactNode;
}

interface PageHeaderContextValue {
  header: PageHeaderState;
  setHeader: (state: PageHeaderState) => void;
  clearHeader: () => void;
}

const DEFAULT: PageHeaderState = { title: '', actions: null };

const PageHeaderContext = createContext<PageHeaderContextValue>({
  header: DEFAULT,
  setHeader: () => {},
  clearHeader: () => {},
});

export const PageHeaderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [header, setHeaderState] = useState<PageHeaderState>(DEFAULT);

  const setHeader = useCallback((state: PageHeaderState) => setHeaderState(state), []);
  const clearHeader = useCallback(() => setHeaderState(DEFAULT), []);

  return (
    <PageHeaderContext.Provider value={{ header, setHeader, clearHeader }}>
      {children}
    </PageHeaderContext.Provider>
  );
};

export const usePageHeader = () => useContext(PageHeaderContext);
