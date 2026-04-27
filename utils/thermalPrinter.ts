/**
 * Thermal printer integration via Web Serial API (Chrome/Edge 89+).
 * Sends raw ESC/POS bytes directly to a USB or RS-232 thermal printer —
 * no print dialog, no rasterization, native text quality.
 */

import { useState, useRef, useCallback } from 'react';
import { EscPosBuilder, CHARS_PER_LINE } from './escpos';

// ── Minimal Web Serial API type declarations ──────────────────────────────────
// The standard DOM lib does not bundle these; we declare only what we need.

interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}
interface SerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
}
interface SerialPortRequestOptions {
  filters?: SerialPortFilter[];
}
interface SerialOptions {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
  bufferSize?: number;
  flowControl?: 'none' | 'hardware';
}
interface SerialPort extends EventTarget {
  getInfo(): SerialPortInfo;
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
}
interface Serial extends EventTarget {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}

function getSerial(): Serial | undefined {
  return (navigator as Navigator & { serial?: Serial }).serial;
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean(getSerial());
}

// ── Receipt data interface ────────────────────────────────────────────────────

export interface ThermalReceiptData {
  saleId: string;
  saleDate: string;
  businessName: string;
  businessAddress?: string;
  businessCnpj?: string;
  businessPhone?: string;
  customerName: string;
  customerCpf?: string;
  sellerName: string;
  items: Array<{
    model: string;
    capacity?: string | null;
    color?: string | null;
    imei?: string | null;
    sellPrice: number;
    condition?: string | null;
    warrantyExpiresAt?: string | null;
  }>;
  tradeIns: Array<{
    model: string;
    capacity?: string | null;
    color?: string | null;
    imei?: string | null;
    receivedValue: number;
  }>;
  tradeInSubtotal: number;
  payments: Array<{
    label: string;
    customerAmount: number;
    storeAmount: number;
  }>;
  negotiatedSubtotal: number;
  originalSubtotal: number;
  hasPriceAdjustment: boolean;
  discountAmount: number;
  discountLabel: string;
  saleGrossTotal: number;
  cardFeeTotal: number;
  totalCustomerWithTradeIn: number;
  saleNetTotal: number;
  warrantyLine: string | null;
}

// ── Receipt builder ───────────────────────────────────────────────────────────

function fmtR$(value: number): string {
  const v = Math.round(value * 100) / 100;
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function buildSaleReceiptBuffer(data: ThermalReceiptData): Uint8Array {
  const b = new EscPosBuilder().init().cp850();

  // Header
  b.sep('=');
  b.center().bold(true).line(data.businessName);
  b.bold(false);
  if (data.businessAddress) b.line(data.businessAddress);
  if (data.businessCnpj) b.line(`CNPJ: ${data.businessCnpj}`);
  if (data.businessPhone) b.line(`Tel: ${data.businessPhone}`);
  b.sep('=');

  // Sale info
  b.left();
  b.bold(true).line('COMPROVANTE DE VENDA').bold(false);
  b.row(`Nro: #${data.saleId.slice(-6).toUpperCase()}`, new Date(data.saleDate).toLocaleString('pt-BR'));
  b.line(`Cliente: ${data.customerName}`);
  if (data.customerCpf) b.line(`CPF: ${data.customerCpf}`);
  b.line(`Vendedor: ${data.sellerName}`);

  // Items
  b.sep('-');
  b.bold(true).line('ITENS').bold(false);
  b.sep('-');
  for (const item of data.items) {
    const desc = [item.model, item.capacity].filter(Boolean).join(' ');
    b.line(desc.slice(0, CHARS_PER_LINE));
    if (item.color) b.line(`Cor: ${item.color}`);
    b.line(`IMEI/SERIAL: ${item.imei || '-'}`);
    if (item.condition === 'Novo') {
      b.line('Garantia Apple: 1 ano');
    } else if (item.warrantyExpiresAt) {
      b.line(`Garantia: ${new Date(item.warrantyExpiresAt).toLocaleDateString('pt-BR')}`);
    }
    b.row('1x', fmtR$(item.sellPrice));
  }

  // Trade-ins
  if (data.tradeIns.length > 0) {
    b.sep('-');
    b.bold(true).line('APARELHOS RECEBIDOS NA TROCA').bold(false);
    b.sep('-');
    for (const ti of data.tradeIns) {
      const parts = [ti.model, ti.capacity, ti.color].filter(Boolean).join(' - ');
      b.line(parts.slice(0, CHARS_PER_LINE));
      if (ti.imei) b.line(`IMEI/SERIAL: ${ti.imei}`);
      b.row('Entrada:', `-${fmtR$(ti.receivedValue)}`);
    }
  }

  // Totals
  b.sep('-');
  b.bold(true).line('TOTAIS').bold(false);
  b.sep('-');
  b.row('Subtotal negociado', fmtR$(data.negotiatedSubtotal));
  if (data.hasPriceAdjustment) b.row('Subtotal original', fmtR$(data.originalSubtotal));
  if (data.discountAmount > 0) b.row(data.discountLabel, `-${fmtR$(data.discountAmount)}`);
  b.row('Total da venda', fmtR$(data.saleGrossTotal));
  b.row('Acréscimo cartão', fmtR$(data.cardFeeTotal));
  b.sep('-');
  b.bold(true).row('TOTAL PAGO', fmtR$(data.totalCustomerWithTradeIn)).bold(false);
  if (data.tradeInSubtotal > 0) {
    b.row('Trade-in pago', fmtR$(data.tradeInSubtotal));
    b.row('Líquido em contas', fmtR$(data.saleNetTotal));
  }

  // Payments
  b.sep('-');
  b.bold(true).line('PAGAMENTOS').bold(false);
  b.sep('-');
  for (const p of data.payments) {
    b.row(p.label, fmtR$(p.customerAmount));
    if (Math.abs(p.customerAmount - p.storeAmount) > 0.005) {
      b.row('  Líquido loja', fmtR$(p.storeAmount));
      b.row('  Acréscimo', fmtR$(p.customerAmount - p.storeAmount));
    }
  }
  if (data.tradeInSubtotal > 0) {
    const n = data.tradeIns.length;
    b.row(`Troca (${n} aparelho${n !== 1 ? 's' : ''})`, fmtR$(data.tradeInSubtotal));
  }

  // Footer
  b.sep('=');
  b.center();
  if (data.warrantyLine) {
    for (const wl of data.warrantyLine.split('\n')) b.line(wl);
  }
  b.line('Obrigado pela preferência!');
  b.sep('=');
  b.feed(4);
  b.cut();

  return b.build();
}

// ── React hook ────────────────────────────────────────────────────────────────

export type PrinterStatus = 'disconnected' | 'connecting' | 'connected' | 'printing' | 'error';

export interface ThermalPrinterHook {
  status: PrinterStatus;
  errorMessage: string | null;
  isSupported: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  print: (data: Uint8Array) => Promise<void>;
}

export function useThermalPrinter(): ThermalPrinterHook {
  const [status, setStatus] = useState<PrinterStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const portRef = useRef<SerialPort | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);
  const isSupported = isWebSerialSupported();

  const connect = useCallback(async () => {
    const serial = getSerial();
    if (!serial) {
      setErrorMessage('Web Serial API não suportada. Use Chrome ou Edge.');
      setStatus('error');
      return;
    }
    try {
      setStatus('connecting');
      setErrorMessage(null);
      const port = await serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      writerRef.current = (port.writable as WritableStream<Uint8Array>).getWriter();
      setStatus('connected');
    } catch (err: unknown) {
      // NotFoundError = user dismissed the port picker — not an error
      const isCancel = err instanceof Error && err.name === 'NotFoundError';
      if (!isCancel) {
        setErrorMessage(err instanceof Error ? err.message : 'Erro ao conectar impressora.');
        setStatus('error');
      } else {
        setStatus('disconnected');
      }
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      writerRef.current?.releaseLock();
      writerRef.current = null;
      await portRef.current?.close();
      portRef.current = null;
    } catch { /* ignore close errors */ }
    setStatus('disconnected');
    setErrorMessage(null);
  }, []);

  const print = useCallback(async (data: Uint8Array) => {
    if (!writerRef.current) throw new Error('Impressora não conectada.');
    setStatus('printing');
    try {
      await writerRef.current.write(data);
      setStatus('connected');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao imprimir.');
      setStatus('error');
    }
  }, []);

  return { status, errorMessage, isSupported, connect, disconnect, print };
}
