/**
 * Entrega do PDF do comprovante ao sistema de impressão.
 *
 * Cada plataforma tem um caminho que funciona, e o motor antigo não respeitava
 * nenhum deles:
 *
 * - **iOS / Android:** Web Share com arquivo abre a folha nativa *dentro* do
 *   PWA instalado, com AirPrint disponível. É o único caminho confiável no
 *   iPhone — `window.print()` em PWA `standalone` é notoriamente quebrado.
 * - **Desktop:** iframe oculto com o blob do PDF e `print()` no documento do
 *   PDF (não no do app). Sem `@media print`, sem esconder o `#root`.
 * - **Último recurso:** baixar o arquivo, que o usuário imprime pelo leitor.
 *
 * Precisa ser chamado de dentro do gesto do usuário: `navigator.share` exige
 * *user activation*.
 */

export type ReceiptDeliveryMode = 'share' | 'print' | 'download';

/** Contrato mínimo do jsPDF — mantido estrutural para facilitar o teste. */
export interface PrintablePdf {
  output(type: 'blob'): Blob;
  save(fileName: string): void;
}

export interface DeliverReceiptPdfOptions {
  fileName: string;
  /** Título sugerido na folha de compartilhamento. */
  title?: string;
  /**
   * Força (ou proíbe) a folha de compartilhamento. Por padrão decide pelo tipo
   * de ponteiro — ver `prefersShareSheet`.
   */
  preferShare?: boolean;
  navigatorRef?: Navigator;
  documentRef?: Document;
}

/**
 * Compartilhar só faz sentido onde imprimir direto do navegador é ruim: celular
 * e tablet. O Chrome de desktop também anuncia `canShare` com arquivos, e ali
 * abrir a folha de compartilhamento no lugar da caixa de impressão seria um
 * susto — o usuário pediu para imprimir.
 */
function prefersShareSheet(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

const PRINT_FRAME_CLASS = 'receipt-pdf-print-frame';
/** O blob precisa continuar vivo enquanto a caixa de impressão estiver aberta. */
const FRAME_RETENTION_MS = 120_000;
const FRAME_LOAD_TIMEOUT_MS = 10_000;

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && (error.name === 'AbortError' || error.name === 'NotAllowedError');

type ShareCapableNavigator = Navigator & {
  canShare?: (data: { files?: File[] }) => boolean;
  share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
};

function canShareFile(nav: ShareCapableNavigator, file: File): boolean {
  if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
  try {
    return nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}

function printViaHiddenFrame(doc: Document, blobUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const frame = doc.createElement('iframe');
    frame.className = PRINT_FRAME_CLASS;
    frame.setAttribute('aria-hidden', 'true');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '1px';
    frame.style.height = '1px';
    frame.style.opacity = '0';
    frame.style.border = '0';
    frame.style.pointerEvents = 'none';

    const cleanup = () => {
      window.setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(blobUrl);
      }, FRAME_RETENTION_MS);
    };

    frame.onload = () => {
      try {
        const frameWindow = frame.contentWindow;
        if (!frameWindow) {
          frame.remove();
          URL.revokeObjectURL(blobUrl);
          finish(false);
          return;
        }
        frameWindow.focus();
        frameWindow.print();
        cleanup();
        finish(true);
      } catch {
        frame.remove();
        URL.revokeObjectURL(blobUrl);
        finish(false);
      }
    };

    frame.onerror = () => {
      frame.remove();
      URL.revokeObjectURL(blobUrl);
      finish(false);
    };

    // Alguns navegadores nunca disparam load/error para blobs de PDF; sem este
    // limite a promessa ficaria pendurada e o usuário sem feedback nenhum.
    window.setTimeout(() => {
      if (!settled) {
        frame.remove();
        URL.revokeObjectURL(blobUrl);
        finish(false);
      }
    }, FRAME_LOAD_TIMEOUT_MS);

    doc.body.appendChild(frame);
    frame.src = blobUrl;
  });
}

export async function deliverReceiptPdf(
  pdf: PrintablePdf,
  options: DeliverReceiptPdfOptions
): Promise<ReceiptDeliveryMode> {
  const { fileName, title } = options;
  const nav = (options.navigatorRef ?? (typeof navigator !== 'undefined' ? navigator : undefined)) as
    | ShareCapableNavigator
    | undefined;
  const doc = options.documentRef ?? (typeof document !== 'undefined' ? document : undefined);
  const blob = pdf.output('blob');
  const preferShare = options.preferShare ?? prefersShareSheet();

  if (preferShare && nav && typeof File === 'function') {
    const file = new File([blob], fileName, { type: 'application/pdf' });
    if (canShareFile(nav, file)) {
      try {
        await nav.share!({ files: [file], title: title ?? fileName });
        return 'share';
      } catch (error: unknown) {
        // Cancelar a folha de compartilhamento é uma decisão do usuário, não uma
        // falha: baixar o arquivo por conta própria seria um efeito surpresa.
        if (isAbortError(error)) return 'share';
      }
    }
  }

  if (doc?.body && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const blobUrl = URL.createObjectURL(blob);
    const printed = await printViaHiddenFrame(doc, blobUrl);
    if (printed) return 'print';
  }

  pdf.save(fileName);
  return 'download';
}
