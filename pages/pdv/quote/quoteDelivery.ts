/**
 * Saídas do documento do orçamento no navegador: baixar, compartilhar e imprimir.
 * Imprimir abre o diálogo do sistema, onde também dá para "Salvar como PDF".
 */
export type QuoteShareResult = 'shared' | 'downloaded' | 'cancelled';

const isAbortError = (error: unknown) => (error as { name?: string } | null)?.name === 'AbortError';

const htmlBlob = (html: string) => new Blob([html], { type: 'text/html;charset=utf-8' });

export const downloadQuoteHtml = (html: string, fileName: string) => {
  const url = URL.createObjectURL(htmlBlob(html));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const canShareFile = (file: File) =>
  typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

// Celular: folha de compartilhar do sistema (WhatsApp, Mail, Arquivos). Sem suporte a arquivo: baixa.
export const shareQuoteHtml = async (html: string, fileName: string, title: string): Promise<QuoteShareResult> => {
  const file = new File([htmlBlob(html)], fileName, { type: 'text/html' });
  if (!canShareFile(file)) {
    downloadQuoteHtml(html, fileName);
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

export const printQuoteFrame = (frame: HTMLIFrameElement | null) => {
  const target = frame?.contentWindow;
  if (!target) return false;
  target.focus();
  target.print();
  return true;
};
