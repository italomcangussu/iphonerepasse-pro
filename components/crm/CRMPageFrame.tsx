import React from "react";

type CRMPageFrameProps = {
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

const CRMPageFrame: React.FC<CRMPageFrameProps> = ({ title, description, actions, children }) => {
  return (
    <div className="space-y-6">
      <header className="crm-page-header">
        <div>
          <h1 className="crm-page-title">{title}</h1>
          <p className="crm-page-subtitle">{description}</p>
        </div>
        {actions ? <div className="flex gap-2">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
};

export default CRMPageFrame;
