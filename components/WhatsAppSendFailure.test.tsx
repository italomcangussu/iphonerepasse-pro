import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import WhatsAppSendFailure from './WhatsAppSendFailure';
import { WhatsAppSendError } from '../utils/whatsappSendError';

const invalidNumber = new WhatsAppSendError({
  kind: 'invalid-number',
  message: 'O número (85) 99873-9775 não está no WhatsApp.',
  hint: 'Confira se o telefone cadastrado do cliente está correto.'
});

const disconnected = new WhatsAppSendError({
  kind: 'disconnected',
  message: 'O WhatsApp da loja está desconectado, então a mensagem não saiu.',
  hint: 'Reconecte o canal em CRM › Canais e tente de novo.'
});

describe('WhatsAppSendFailure', () => {
  it('says what happened and what to do, in an alert that stays on screen', () => {
    render(
      <WhatsAppSendFailure
        title="Comprovante não enviado"
        error={disconnected}
        onRetry={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Comprovante não enviado');
    expect(alert).toHaveTextContent('desconectado');
    expect(alert).toHaveTextContent('Reconecte o canal');
  });

  it('offers a retry for failures that a retry can fix', async () => {
    const onRetry = vi.fn();
    render(
      <WhatsAppSendFailure title="Comprovante não enviado" error={disconnected} onRetry={onRetry} onDismiss={vi.fn()} />
    );

    await userEvent.click(screen.getByRole('button', { name: /Tentar de novo/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('turns a number without WhatsApp into an inline phone fix instead of a pointless retry', async () => {
    const onFixPhone = vi.fn();
    render(
      <WhatsAppSendFailure
        title="Comprovante não enviado"
        error={invalidNumber}
        phone="(85) 99873-9775"
        onRetry={vi.fn()}
        onFixPhone={onFixPhone}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /Tentar de novo/i })).not.toBeInTheDocument();
    const field = screen.getByLabelText(/Telefone do cliente/i);
    expect(field).toHaveValue('(85) 99873-9775');

    await userEvent.clear(field);
    await userEvent.type(field, '85988887777');
    expect(field).toHaveValue('(85) 98888-7777');

    await userEvent.click(screen.getByRole('button', { name: /Salvar e reenviar/i }));
    expect(onFixPhone).toHaveBeenCalledWith('(85) 98888-7777');
  });

  it('prefills the field without the country code when the stored phone has one', () => {
    render(
      <WhatsAppSendFailure
        title="Comprovante não enviado"
        error={invalidNumber}
        phone="5585998739775"
        onRetry={vi.fn()}
        onFixPhone={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/Telefone do cliente/i)).toHaveValue('(85) 99873-9775');
  });

  it('explains an incomplete phone next to the field and does not submit it', async () => {
    const onFixPhone = vi.fn();
    render(
      <WhatsAppSendFailure
        title="Comprovante não enviado"
        error={invalidNumber}
        phone=""
        onRetry={vi.fn()}
        onFixPhone={onFixPhone}
        onDismiss={vi.fn()}
      />
    );

    await userEvent.type(screen.getByLabelText(/Telefone do cliente/i), '8599');
    await userEvent.click(screen.getByRole('button', { name: /Salvar e reenviar/i }));

    expect(onFixPhone).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Telefone do cliente/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/Informe o DDD e o número/i)).toBeInTheDocument();
  });

  it('locks the actions and shows progress while resending', () => {
    render(
      <WhatsAppSendFailure
        title="Comprovante não enviado"
        error={disconnected}
        busy
        onRetry={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Enviando/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Dispensar alerta/i })).not.toBeInTheDocument();
  });

  it('can be dismissed when idle', async () => {
    const onDismiss = vi.fn();
    render(
      <WhatsAppSendFailure title="Comprovante não enviado" error={disconnected} onRetry={vi.fn()} onDismiss={onDismiss} />
    );

    await userEvent.click(screen.getByRole('button', { name: /Dispensar alerta/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
