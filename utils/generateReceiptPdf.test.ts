import { beforeEach, describe, expect, it, vi } from 'vitest';
import html2canvas from 'html2canvas';
import { generateReceiptPdfBase64 } from './generateReceiptPdf';

vi.mock('html2canvas', () => ({
  default: vi.fn()
}));

const addImageMock = vi.fn();
const addPageMock = vi.fn();
const outputMock = vi.fn(() => 'data:application/pdf;base64,PDF');

vi.mock('jspdf', () => ({
  default: vi.fn(function jsPDFMock(this: unknown) {
    return {
      internal: {
        pageSize: {
          getWidth: () => 210,
          getHeight: () => 297
        }
      },
      addImage: addImageMock,
      addPage: addPageMock,
      output: outputMock
    };
  })
}));

const html2canvasMock = vi.mocked(html2canvas);

describe('generateReceiptPdfBase64', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    document.getElementById('receipt-pdf-capture-style')?.remove();
    html2canvasMock.mockResolvedValue({
      width: 794,
      height: 1123,
      toDataURL: vi.fn(() => 'data:image/jpeg;base64,IMAGE')
    } as unknown as HTMLCanvasElement);
  });

  it('captures the receipt with html2canvas-safe styles and cleans up afterwards', async () => {
    const receipt = document.createElement('div');
    receipt.id = 'receipt-content-a4';
    receipt.className = 'hidden print-only text-gray-500 bg-gray-50 border-gray-300';
    receipt.style.display = 'none';
    document.body.appendChild(receipt);

    await generateReceiptPdfBase64();

    expect(html2canvasMock).toHaveBeenCalledTimes(1);
    expect(receipt.classList.contains('receipt-pdf-capture')).toBe(false);
    expect(document.getElementById('receipt-pdf-capture-style')).toBeNull();

    const callReceipt = html2canvasMock.mock.calls[0][0] as HTMLElement;
    expect(callReceipt).toBe(receipt);
    expect(callReceipt.style.display).toBe('none');

    const options = html2canvasMock.mock.calls[0][1] as { onclone?: (doc: Document) => void };
    expect(options.onclone).toBeTypeOf('function');

    const cloneDoc = document.implementation.createHTMLDocument();
    const clonedReceipt = receipt.cloneNode(true) as HTMLElement;
    cloneDoc.body.appendChild(clonedReceipt);
    options.onclone?.(cloneDoc);

    expect(clonedReceipt.classList.contains('receipt-pdf-capture')).toBe(true);
    const captureStyleText = cloneDoc.getElementById('receipt-pdf-capture-style')?.textContent || '';
    expect(captureStyleText).toContain('color: #111827');
    expect(captureStyleText).not.toContain('oklch');
    expect(captureStyleText).not.toContain('color-mix');
  });
});
