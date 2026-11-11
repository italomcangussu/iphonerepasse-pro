/**
 * Saídas do documento do orçamento no navegador: baixar o .html, compartilhar e entregar o PDF.
 * O PDF é gerado no aparelho (`quotePdf.ts`); nada aqui depende do diálogo de impressão.
 */
export type QuoteShareResult = 'shared' | 'downloaded' | 'cancelled';

const isAbortError = (error: unknown) => (error as { name?: string } | null)?.name === 'AbortError';

const htmlBlob = (html: string) => new Blob([html], { type: 'text/html;charset=utf-8' });

const canShareFile = (file: File) =>
  typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const downloadQuoteHtml = (html: string, fileName: string) => downloadBlob(htmlBlob(html), fileName);

/**
 * Entrega o PDF pronto. No celular abre a folha do sistema (WhatsApp, Arquivos, Imprimir):
 * é o único caminho confiável no iPhone com o app instalado, onde link de download e
 * `window.print()` não funcionam. Sem suporte a compartilhar arquivo, baixa.
 */
export const deliverQuotePdf = async (pdf: Blob, fileName: string, title: string): Promise<QuoteShareResult> => {
  const file = new File([pdf], fileName, { type: 'application/pdf' });
  if (!canShareFile(file)) {
    downloadBlob(pdf, fileName);
    return 'downloaded';
  }
  try {
    await navigator.share({ files: [file], title });
    return 'shared';
  } catch (error) {
    if (isAbortError(error)) return 'cancelled';
    throw error;
  }
};
