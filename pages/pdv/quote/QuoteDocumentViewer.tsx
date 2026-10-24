import React, { useMemo, useRef } from 'react';
import { Download, Printer, Share2 } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import { useToast } from '../../../components/ui/ToastProvider';
import type { BusinessProfile } from '../../../types';
import { useReceiptLogo } from '../../../utils/receiptLogo';
import { buildQuoteDocumentHtml, quoteDocumentFileName } from './quoteDocument';
import { savedQuoteToDocumentData } from './quoteDocumentData';
import { downloadQuoteHtml, printQuoteFrame, shareQuoteHtml } from './quoteDelivery';
import { formatQuoteNumber, type SavedQuote } from './quoteModel';

interface QuoteDocumentViewerProps {
  quote: SavedQuote | null;
  business: BusinessProfile;
  onClose: () => void;
}

export function QuoteDocumentViewer({ quote, business, onClose }: QuoteDocumentViewerProps) {
  const toast = useToast();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const logo = useReceiptLogo(business.logoUrl);

  const html = useMemo(
    () => (quote ? buildQuoteDocumentHtml(savedQuoteToDocumentData(quote, business, logo?.dataUrl ?? null)) : ''),
    [quote, business, logo],
  );

  if (!quote) return null;
  const fileName = quoteDocumentFileName(quote.quoteNumber);
  const title = `Orçamento ${formatQuoteNumber(quote.quoteNumber)}`;

  const share = async () => {
    try {
      const result = await shareQuoteHtml(html, fileName, title);
      if (result === 'downloaded') toast.success('Orçamento baixado. Envie o arquivo pelo WhatsApp ou e-mail.');
    } catch {
      toast.error('Não foi possível compartilhar agora. Use “Baixar” e envie o arquivo.');
    }
  };

  const print = () => {
    if (!printQuoteFrame(frameRef.current)) toast.error('A pré-visualização ainda está carregando. Tente de novo em instantes.');
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      size="xl"
      footer={(
        <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:justify-end">
          <button type="button" onClick={() => downloadQuoteHtml(html, fileName)} className="ios-button-secondary inline-flex items-center justify-center gap-2">
            <Download size={18} aria-hidden="true" />Baixar
          </button>
          <button type="button" onClick={print} className="ios-button-secondary inline-flex items-center justify-center gap-2">
            <Printer size={18} aria-hidden="true" />PDF
          </button>
          <button type="button" onClick={() => void share()} className="ios-button-primary inline-flex items-center justify-center gap-2">
            <Share2 size={18} aria-hidden="true" />Enviar
          </button>
        </div>
      )}
    >
      <iframe
        ref={frameRef}
        title={`Pré-visualização do ${title}`}
        srcDoc={html}
        className="h-[min(70dvh,900px)] w-full rounded-2xl border-0 bg-slate-100"
      />
      <p className="mt-2 text-xs app-text-muted">“PDF” abre a impressão do sistema: escolha “Salvar como PDF” para gerar o arquivo.</p>
    </Modal>
  );
}
