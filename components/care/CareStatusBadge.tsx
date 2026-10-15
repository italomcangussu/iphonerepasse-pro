import React from 'react';
import { CARE_TONE_CLASS, type CareTone } from '../../lib/care/careLabels';

const CareStatusBadge: React.FC<{ tone: CareTone; label: string; title?: string }> = ({ tone, label, title }) => (
  <span
    title={title}
    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${CARE_TONE_CLASS[tone]}`}
  >
    {label}
  </span>
);

export default CareStatusBadge;
