import React, { useMemo, useState } from 'react';
import { Download, FileText, Share2 } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import { useToast } from '../../../components/ui/ToastProvider';
import type { BusinessProfile } from '../../../types';
import { useReceiptLogo } from '../../../utils/receiptLogo';
import { buildQuoteDocumentHtml, quoteDocumentFileName, quotePdfFileName } from './quoteDocument';
import { savedQuoteToDocumentData } from './quoteDocumentData';
import { deliverQuotePdf, downloadQuoteHtml } from './quoteDelivery';
import { buildQuotePdfBlob } from './quotePdf';
import { formatQuoteNumber, type SavedQuote } from './quoteModel';

interface QuoteDocumentViewerProps {
  quote: SavedQuote | null;
  business: BusinessProfile;
  onClose: () => void;
}

export function QuoteDocumentViewer({ quote, business, onClose }: QuoteDocumentViewerProps) {
  const toast = useToast();
  const [pdfAction, setPdfAction] = useState<'save' | 'send' | null>(null);
  const logo = useReceiptLogo(business.logoUrl);

  const html = useMemo(
    () => (quote ? buildQuoteDocumentHtml(savedQuoteToDocumentData(quote, business, logo?.dataUrl ?? null)) : ''),
    [quote, business, logo],
  );

  if (!quote) return null;
  const fileName = quoteDocumentFileName(quote.quoteNumber);
  const title = `Orçamento ${formatQuoteNumber(quote.quoteNumber)}`;

  // "PDF" e "Enviar" entregam o mesmo arquivo; muda só a mensagem quando o aparelho baixa em vez de compartilhar.
  const deliverPdf = async (action: 'save' | 'send') => {
    if (pdfAction) return;
    setPdfAction(action);
    try {
      const pdf = await buildQuotePdfBlob(html);
      const result = await deliverQuotePdf(pdf, quotePdfFileName(quote.quoteNumber), title);
      if (result === 'downloaded') {
        toast.success(action === 'send' ? 'PDF baixado. Envie o arquivo pelo WhatsApp ou e-mail.' : 'PDF do orçamento baixado.');
      }
    } catch {
      toast.error('Não foi possível gerar o PDF agora. Tente de novo; se continuar, use “Baixar” e envie o arquivo.');
    } finally {
      setPdfAction(null);
    }
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
          <button type="button" onClick={() => void deliverPdf('save')} disabled={pdfAction !== null} className="ios-button-secondary inline-flex items-center justify-center gap-2">
            <FileText size={18} aria-hidden="true" />{pdfAction === 'save' ? 'Gerando…' : 'PDF'}
          </button>
          <button type="button" onClick={() => void deliverPdf('send')} disabled={pdfAction !== null} className="ios-button-primary inline-flex items-center justify-center gap-2">
            <Share2 size={18} aria-hidden="true" />{pdfAction === 'send' ? 'Gerando…' : 'Enviar'}
          </button>
        </div>
      )}
    >
      <iframe
        title={`Pré-visualização do ${title}`}
        srcDoc={html}
        className="h-[min(70dvh,900px)] w-full rounded-2xl border-0 bg-slate-100"
      />
      <p className="mt-2 text-xs app-text-muted">“PDF” e “Enviar” geram o arquivo em PDF. “Baixar” salva a página do orçamento (.html).</p>
    </Modal>
  );
}
