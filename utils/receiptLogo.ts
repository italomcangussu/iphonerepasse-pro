/**
 * Carrega a logo do negócio como data URL, pronta para o jsPDF.
 *
 * A geração do PDF é síncrona de propósito (preserva o gesto do usuário, que o
 * Safari exige para compartilhar/imprimir), então a logo precisa **já estar
 * resolvida** quando o botão é clicado. Por isso o carregamento acontece no
 * `useReceiptLogo`, ao montar a tela, e o resultado fica em cache por URL.
 *
 * Falha aqui nunca bloqueia a impressão: sem logo, o comprovante desenha o
 * monograma da loja.
 */

import { useEffect, useState } from 'react';
import type { ReceiptLogo } from './receiptPdf';

const cache = new Map<string, Promise<ReceiptLogo | null>>();

const toFormat = (mime: string): ReceiptLogo['format'] | null => {
  if (mime.includes('png')) return 'PNG';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'JPEG';
  return null;
};

const readAsDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler a logo.'));
    reader.readAsDataURL(blob);
  });

async function fetchLogo(url: string): Promise<ReceiptLogo | null> {
  // Já veio embutida (o perfil aceita Base64 além de URL).
  if (url.startsWith('data:')) {
    const format = toFormat(url.slice(5, url.indexOf(';')));
    return format ? { dataUrl: url, format } : null;
  }

  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    // jsPDF só embute PNG e JPEG; SVG/WebP caem no monograma.
    const format = toFormat(blob.type);
    if (!format) return null;
    return { dataUrl: await readAsDataUrl(blob), format };
  } catch {
    return null;
  }
}

export function loadReceiptLogo(url?: string | null): Promise<ReceiptLogo | null> {
  if (!url) return Promise.resolve(null);
  const cached = cache.get(url);
  if (cached) return cached;
  const pending = fetchLogo(url);
  cache.set(url, pending);
  return pending;
}

/** Deixa a logo pronta antes do clique em "Imprimir". */
export function useReceiptLogo(url?: string | null): ReceiptLogo | null {
  const [logo, setLogo] = useState<ReceiptLogo | null>(null);

  useEffect(() => {
    if (!url) {
      setLogo(null);
      return;
    }
    let active = true;
    void loadReceiptLogo(url).then((resolved) => {
      if (active) setLogo(resolved);
    });
    return () => {
      active = false;
    };
  }, [url]);

  return logo;
}
