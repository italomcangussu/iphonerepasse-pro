/**
 * PDF do orçamento gerado no próprio aparelho (html2canvas + jsPDF).
 * Não depende de `window.print()`, que não funciona no iPhone com o app instalado.
 */
const A4_WIDTH_PX = 794; // A4 a 96 dpi
const CAPTURE_SCALE = 2;
const LOAD_TIMEOUT_MS = 8000;

const PAGE_MARGIN_MM = 12;
/** Um corte de página só "vale" se deixar a página com pelo menos esta fração preenchida. */
const MIN_PAGE_FILL = 0.5;
const BREAKABLE_SELECTOR = 'tr, .block, .hero, section, header, footer, p, h1, h2, h3';

// Folha em branco, sem a moldura de tela (sombra, cantos, fundo cinza). As margens de cima e de
// baixo vêm da paginação. Algarismos tabulares saem: o canvas não os desenha e o texto ficaria
// com buracos ("12 /11 /2026").
const PDF_STYLE = `
  html, body { background:#fff !important; }
  body { margin:0 !important; width:${A4_WIDTH_PX}px !important; }
  .page { margin:0 !important; max-width:none !important; box-shadow:none !important; border-radius:0 !important; padding:0 40px 24px !important; }
  * { font-variant-numeric:normal !important; font-feature-settings:normal !important; }
`;

const mountHiddenFrame = (html: string): Promise<HTMLIFrameElement> =>
  new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${A4_WIDTH_PX}px;height:1123px;border:0;visibility:hidden;`;
    const timeout = window.setTimeout(() => {
      frame.remove();
      reject(new Error('O documento do orçamento demorou demais para carregar.'));
    }, LOAD_TIMEOUT_MS);
    frame.onload = () => {
      window.clearTimeout(timeout);
      resolve(frame);
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });

const waitForImages = (doc: Document) =>
  Promise.all(
    Array.from(doc.images).map((image) =>
      image.complete ? Promise.resolve() : new Promise<void>((done) => { image.onload = () => done(); image.onerror = () => done(); }),
    ),
  );

export type PageSlice = { start: number; end: number };

/**
 * Divide a altura total em páginas, cortando de preferência entre blocos (linhas de tabela,
 * seções) para não partir um texto ao meio. Sem ponto de corte aproveitável, corta na altura cheia.
 */
export const planPageSlices = (totalHeight: number, pageHeight: number, breaks: number[]): PageSlice[] => {
  const slices: PageSlice[] = [];
  const sorted = [...breaks].sort((a, b) => a - b);
  let start = 0;
  while (totalHeight - start > 1) {
    const limit = start + pageHeight;
    if (limit >= totalHeight) {
      slices.push({ start, end: totalHeight });
      break;
    }
    const minEnd = start + pageHeight * MIN_PAGE_FILL;
    const candidate = sorted.filter((point) => point <= limit && point >= minEnd).pop();
    const end = candidate ?? limit;
    slices.push({ start, end });
    start = end;
  }
  return slices;
};

const collectBreakPoints = (doc: Document, scale: number): number[] => {
  const top = doc.body.getBoundingClientRect().top;
  return Array.from(doc.querySelectorAll(BREAKABLE_SELECTOR)).map((element) =>
    Math.round((element.getBoundingClientRect().bottom - top) * scale),
  );
};

const cropSlice = (source: HTMLCanvasElement, slice: PageSlice): string => {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = Math.max(1, Math.round(slice.end - slice.start));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar a página do PDF.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, -slice.start);
  return canvas.toDataURL('image/jpeg', 0.92);
};

export const buildQuotePdfBlob = async (html: string): Promise<Blob> => {
  const [{ default: html2canvas }, { default: JsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const frame = await mountHiddenFrame(html);
  try {
    const doc = frame.contentDocument;
    if (!doc?.body) throw new Error('Não foi possível montar o documento do orçamento.');
    const style = doc.createElement('style');
    style.textContent = PDF_STYLE;
    doc.head.appendChild(style);
    await waitForImages(doc);

    const canvas = await html2canvas(doc.body, {
      scale: CAPTURE_SCALE,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: A4_WIDTH_PX,
      windowWidth: A4_WIDTH_PX,
    });

    const breaks = collectBreakPoints(doc, CAPTURE_SCALE);
    const pdf = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const usableHeight = pdf.internal.pageSize.getHeight() - PAGE_MARGIN_MM * 2;
    const mmPerPx = pageWidth / canvas.width;
    planPageSlices(canvas.height, usableHeight / mmPerPx, breaks).forEach((slice, index) => {
      if (index > 0) pdf.addPage();
      pdf.addImage(cropSlice(canvas, slice), 'JPEG', 0, PAGE_MARGIN_MM, pageWidth, (slice.end - slice.start) * mmPerPx);
    });
    return pdf.output('blob');
  } finally {
    frame.remove();
  }
};
