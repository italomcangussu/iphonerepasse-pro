import React from 'react';
import { splitObservations } from '../utils/observations';

interface ObservationsListProps {
  /** Texto cru vindo de `observations`/`notes`. Nada é renderizado se vazio. */
  raw?: string | null;
  /** Rótulo acima da lista. `null` omite. */
  label?: string | null;
  className?: string;
  /**
   * Renderiza com `span` em vez de `div`/`p`. Necessário quando o bloco vive
   * dentro de um `<span>` (ex.: a descrição das linhas de lista do PDV), onde
   * um `<div>` seria aninhamento inválido.
   */
  inline?: boolean;
}

/**
 * Lista de observações de um aparelho, uma por linha com bullet.
 *
 * Extraído de 6 cópias divergentes (Inventory ×2, PDV ×2, PDVHistory ×2) que já
 * discordavam entre si em leading, margem e presença do rótulo.
 */
export const ObservationsList: React.FC<ObservationsListProps> = ({
  raw,
  label = 'Obs:',
  className = '',
  inline = false
}) => {
  const observations = splitObservations(raw);
  if (observations.length === 0) return null;

  const Wrapper = inline ? 'span' : 'div';
  const Item = inline ? 'span' : 'p';
  const wrapperClass = [
    inline ? 'block' : '',
    'text-xs text-amber-700 dark:text-amber-400 space-y-0.5',
    className
  ].filter(Boolean).join(' ');

  return (
    <Wrapper className={wrapperClass}>
      {label && <Item className={`font-medium${inline ? ' block' : ''}`}>{label}</Item>}
      {observations.map((observation, index) => (
        <Item key={index} className={`leading-snug break-words${inline ? ' block' : ''}`}>
          • {observation}
        </Item>
      ))}
    </Wrapper>
  );
};
