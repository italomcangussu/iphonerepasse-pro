import React, { useEffect } from "react";

const LEGACY_APP_URL = "https://app.iphonerepasse.com.br";

const LegacyRedirectPage: React.FC = () => {
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.location.assign(LEGACY_APP_URL);
  }, []);

  return (
    <div className="crm-card p-6">
      <p className="text-sm text-slate-600">Redirecionando para o aplicativo principal...</p>
    </div>
  );
};

export default LegacyRedirectPage;
