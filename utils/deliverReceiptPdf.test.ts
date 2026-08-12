import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deliverReceiptPdf, type PrintablePdf } from './deliverReceiptPdf';

const makePdf = () => ({
  output: (): Blob => new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' }),
  save: vi.fn<(fileName: string) => void>()
}) satisfies PrintablePdf;

/** Documento mínimo cujo iframe "carrega" assim que recebe um src. */
const makeFakeDocument = (options: { failPrint?: boolean; neverLoads?: boolean } = {}) => {
  const printSpy = vi.fn(() => {
    if (options.failPrint) throw new Error('print bloqueado');
  });
  const removeSpy = vi.fn();

  const frame: Record<string, unknown> = {
    style: {},
    setAttribute: vi.fn(),
    remove: removeSpy,
    contentWindow: { focus: vi.fn(), print: printSpy },
    onload: null,
    onerror: null
  };
  Object.defineProperty(frame, 'src', {
    set() {
      if (options.neverLoads) return;
      queueMicrotask(() => (frame.onload as (() => void) | null)?.());
    }
  });

  return {
    doc: { createElement: () => frame, body: { appendChild: vi.fn() } } as unknown as Document,
    printSpy,
    removeSpy
  };
};

const shareNavigator = (share: () => Promise<void>): Navigator =>
  ({ canShare: () => true, share }) as unknown as Navigator;

let createObjectURL: typeof URL.createObjectURL;
let revokeObjectURL: typeof URL.revokeObjectURL;

beforeEach(() => {
  createObjectURL = URL.createObjectURL;
  revokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => 'blob:fake-receipt');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  vi.useRealTimers();
});

describe('deliverReceiptPdf', () => {
  it('compartilha o arquivo quando a plataforma suporta (caminho do iPhone)', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const pdf = makePdf();
    const { doc, printSpy } = makeFakeDocument();

    const mode = await deliverReceiptPdf(pdf, {
      fileName: 'comprovante-42.pdf',
      preferShare: true,
      navigatorRef: shareNavigator(share),
      documentRef: doc
    });

    expect(mode).toBe('share');
    const shared = share.mock.calls[0][0] as { files: File[] };
    expect(shared.files[0].name).toBe('comprovante-42.pdf');
    expect(shared.files[0].type).toBe('application/pdf');
    // Compartilhou: não deve também imprimir nem baixar.
    expect(printSpy).not.toHaveBeenCalled();
    expect(pdf.save).not.toHaveBeenCalled();
  });

  it('trata o cancelamento da folha de compartilhamento como decisão do usuário', async () => {
    const abort = Object.assign(new Error('cancelado'), { name: 'AbortError' });
    const pdf = makePdf();
    const { doc, printSpy } = makeFakeDocument();

    const mode = await deliverReceiptPdf(pdf, {
      fileName: 'comprovante-42.pdf',
      preferShare: true,
      navigatorRef: shareNavigator(vi.fn().mockRejectedValue(abort)),
      documentRef: doc
    });

    expect(mode).toBe('share');
    expect(pdf.save).not.toHaveBeenCalled();
    expect(printSpy).not.toHaveBeenCalled();
  });

  it('cai para a impressão quando o compartilhamento falha de verdade', async () => {
    const pdf = makePdf();
    const { doc, printSpy } = makeFakeDocument();

    const mode = await deliverReceiptPdf(pdf, {
      fileName: 'comprovante-42.pdf',
      preferShare: true,
      navigatorRef: shareNavigator(vi.fn().mockRejectedValue(new Error('falhou'))),
      documentRef: doc
    });

    expect(mode).toBe('print');
    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it('imprime o PDF num iframe próprio quando não há compartilhamento (desktop)', async () => {
    const pdf = makePdf();
    const { doc, printSpy } = makeFakeDocument();

    const mode = await deliverReceiptPdf(pdf, {
      fileName: 'comprovante-42.pdf',
      navigatorRef: {} as Navigator,
      documentRef: doc
    });

    expect(mode).toBe('print');
    expect(printSpy).toHaveBeenCalledTimes(1);
    // Imprime o documento do PDF — o documento do app nunca é tocado.
    expect(pdf.save).not.toHaveBeenCalled();
  });

  it('no desktop imprime direto, mesmo com compartilhamento disponível', async () => {
    // Chrome de desktop anuncia canShare com arquivos; abrir a folha de
    // compartilhamento ali seria trocar a caixa de impressão por um susto.
    const share = vi.fn().mockResolvedValue(undefined);
    const pdf = makePdf();
    const { doc, printSpy } = makeFakeDocument();

    const mode = await deliverReceiptPdf(pdf, {
      fileName: 'comprovante-42.pdf',
      preferShare: false,
      navigatorRef: shareNavigator(share),
      documentRef: doc
    });

    expect(mode).toBe('print');
    expect(share).not.toHaveBeenCalled();
    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it('baixa o arquivo quando a impressão pelo iframe é recusada', async () => {
    const pdf = makePdf();
    const { doc } = makeFakeDocument({ failPrint: true });

    const mode = await deliverReceiptPdf(pdf, {
      fileName: 'comprovante-42.pdf',
      navigatorRef: {} as Navigator,
      documentRef: doc
    });

    expect(mode).toBe('download');
    expect(pdf.save).toHaveBeenCalledWith('comprovante-42.pdf');
  });

  it('não fica pendurado se o iframe nunca carregar', async () => {
    vi.useFakeTimers();
    const pdf = makePdf();
    const { doc } = makeFakeDocument({ neverLoads: true });

    const pending = deliverReceiptPdf(pdf, {
      fileName: 'comprovante-42.pdf',
      navigatorRef: {} as Navigator,
      documentRef: doc
    });
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await pending).toBe('download');
    expect(pdf.save).toHaveBeenCalledWith('comprovante-42.pdf');
  });
});
