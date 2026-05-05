import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const RECEIPT_CAPTURE_CLASS = 'receipt-pdf-capture';
const RECEIPT_CAPTURE_STYLE_ID = 'receipt-pdf-capture-style';

const RECEIPT_CAPTURE_CSS = `
  .${RECEIPT_CAPTURE_CLASS},
  .${RECEIPT_CAPTURE_CLASS} * {
    background-image: none !important;
    box-shadow: none !important;
    text-shadow: none !important;
    color: #111827 !important;
    border-color: #d1d5db !important;
  }

  .${RECEIPT_CAPTURE_CLASS} {
    background-color: #ffffff !important;
  }

  .${RECEIPT_CAPTURE_CLASS} .bg-white { background-color: #ffffff !important; }
  .${RECEIPT_CAPTURE_CLASS} .bg-gray-50 { background-color: #f9fafb !important; }
  .${RECEIPT_CAPTURE_CLASS} .bg-amber-50 { background-color: #fffbeb !important; }
  .${RECEIPT_CAPTURE_CLASS} .text-black { color: #000000 !important; }
  .${RECEIPT_CAPTURE_CLASS} .text-gray-500 { color: #6b7280 !important; }
  .${RECEIPT_CAPTURE_CLASS} .text-gray-600 { color: #4b5563 !important; }
  .${RECEIPT_CAPTURE_CLASS} .text-gray-700 { color: #374151 !important; }
  .${RECEIPT_CAPTURE_CLASS} .text-red-700 { color: #b91c1c !important; }
  .${RECEIPT_CAPTURE_CLASS} .border-black { border-color: #000000 !important; }
  .${RECEIPT_CAPTURE_CLASS} .border-gray-200 { border-color: #e5e7eb !important; }
  .${RECEIPT_CAPTURE_CLASS} .border-gray-300 { border-color: #d1d5db !important; }
  .${RECEIPT_CAPTURE_CLASS} .border-amber-300 { border-color: #fcd34d !important; }
`;

const ensureReceiptCaptureStyle = (doc: Document) => {
  if (doc.getElementById(RECEIPT_CAPTURE_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = RECEIPT_CAPTURE_STYLE_ID;
  style.textContent = RECEIPT_CAPTURE_CSS;
  doc.head.appendChild(style);
};

export async function generateReceiptPdfBase64(elementId = 'receipt-content-a4'): Promise<string> {
  const el = document.getElementById(elementId);
  if (!el) throw new Error('Elemento de comprovante A4 não encontrado.');

  const prev = {
    display: el.style.display,
    position: el.style.position,
    left: el.style.left,
    top: el.style.top,
    zIndex: el.style.zIndex,
    width: el.style.width,
    maxWidth: el.style.maxWidth,
  };

  // Make visible but off-screen so html2canvas can render it
  el.classList.add(RECEIPT_CAPTURE_CLASS);
  el.style.display = 'block';
  el.style.position = 'fixed';
  el.style.left = '-9999px';
  el.style.top = '0';
  el.style.zIndex = '-1';
  el.style.width = '794px';
  el.style.maxWidth = '794px';

  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
      allowTaint: true,
      width: 794,
      windowWidth: 794,
      onclone: (clonedDocument) => {
        ensureReceiptCaptureStyle(clonedDocument);
        clonedDocument.getElementById(elementId)?.classList.add(RECEIPT_CAPTURE_CLASS);
      },
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = pageW * (canvas.height / canvas.width);

    let y = 0;
    while (y < imgH) {
      pdf.addImage(imgData, 'JPEG', 0, -y, pageW, imgH);
      y += pageH;
      if (y < imgH) pdf.addPage();
    }

    return pdf.output('datauristring');
  } finally {
    el.style.display = prev.display;
    el.style.position = prev.position;
    el.style.left = prev.left;
    el.style.top = prev.top;
    el.style.zIndex = prev.zIndex;
    el.style.width = prev.width;
    el.style.maxWidth = prev.maxWidth;
    el.classList.remove(RECEIPT_CAPTURE_CLASS);
    document.getElementById(RECEIPT_CAPTURE_STYLE_ID)?.remove();
  }
}
