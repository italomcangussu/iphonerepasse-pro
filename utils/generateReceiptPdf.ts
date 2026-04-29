import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
  }
}
