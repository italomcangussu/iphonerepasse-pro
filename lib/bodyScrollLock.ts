// Trava a rolagem da página enquanto houver overlay aberto (modal, folha, diálogo).
// A contagem é única para o app: cada overlay pede a trava e devolve ao fechar.
// Guardar "o valor de antes" em cada overlay não funciona com dois abertos:
// o segundo lê `hidden`, e ao fechar por último devolve `hidden` para sempre.
let openLocks = 0;
let overflowBeforeLock = '';

export const lockBodyScroll = (): (() => void) => {
  if (openLocks === 0) {
    overflowBeforeLock = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  openLocks += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    openLocks -= 1;
    if (openLocks === 0) document.body.style.overflow = overflowBeforeLock;
  };
};
