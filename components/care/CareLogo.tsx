import React from 'react';

// Identidade oficial Repasse Care+ (docs/REPASSE_CARE_CONTEXTO_DE_NEGOCIO.md): versão clara e escura, sem redesenho.
const CareLogo: React.FC<{ className?: string }> = ({ className = 'h-10 w-auto' }) => (
  <>
    <img src="/brand/repasse-care-light.svg" alt="Repasse Care+ by iPhone Repasse" className={`${className} dark:hidden`} />
    <img src="/brand/repasse-care-dark.svg" alt="Repasse Care+ by iPhone Repasse" className={`${className} hidden dark:block`} />
  </>
);

export default CareLogo;
