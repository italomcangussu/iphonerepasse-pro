import React from "react";

type CRMPageFrameProps = {
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

const CRMPageFrame: React.FC<CRMPageFrameProps> = ({ title, description, actions, children }) => {
  return (
    <div className="space-y-8 py-4">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-2">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tightest text-slate-950 dark:text-white">{title}</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
      </header>
      <div className="relative">
        {children}
      </div>
    </div>
  );
};

export default CRMPageFrame;
