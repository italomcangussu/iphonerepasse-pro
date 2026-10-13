import React from 'react';

interface HeroHeaderProps {
  title: string;
  subtitle?: string;
  /** Ação à esquerda do título (voltar) e à direita (notificações, menu). */
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Conteúdo que sobe por cima da borda inferior do bloco (primeiro cartão). */
  children?: React.ReactNode;
}

/** Topo das telas de celular: faixa da marca com o primeiro cartão sobreposto. */
const HeroHeader: React.FC<HeroHeaderProps> = ({ title, subtitle, leading, trailing, children }) => (
  <>
    <header className="ios-hero">
      <div className="flex items-center gap-3">
        {leading}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-ios-headline font-bold">{title}</h1>
          {subtitle && <p className="truncate text-ios-footnote opacity-85">{subtitle}</p>}
        </div>
        {trailing}
      </div>
    </header>
    {children && <div className="ios-hero-overlap px-4">{children}</div>}
  </>
);

export default HeroHeader;
