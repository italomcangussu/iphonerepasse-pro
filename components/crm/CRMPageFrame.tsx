import React, { useEffect } from "react";
import { usePageHeader } from "../../contexts/PageHeaderContext";

type CRMPageFrameProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

const CRMPageFrame: React.FC<CRMPageFrameProps> = ({ title, actions, children }) => {
  const { setHeader, clearHeader } = usePageHeader();

  useEffect(() => {
    setHeader({ title, actions: actions ?? null });
    return () => clearHeader();
  }, [title, actions, setHeader, clearHeader]);

  return <>{children}</>;
};

export default CRMPageFrame;

