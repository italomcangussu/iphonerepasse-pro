import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ConversationListSkeleton,
  ConversationWorkspaceState,
  MessageThreadSkeleton,
} from './ConversationWorkspaceState';

describe('ConversationWorkspaceState', () => {
  it('renders a recoverable error with an accessible action', () => {
    const onAction = vi.fn();
    render(
      <ConversationWorkspaceState
        tone="error"
        title="Não foi possível carregar as conversas"
        description="Verifique sua conexão e tente novamente."
        action={{ label: 'Tentar novamente', onClick: onAction }}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Verifique sua conexão');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('labels list and thread skeletons without exposing decorative rows', () => {
    const { rerender } = render(<ConversationListSkeleton />);
    expect(screen.getByLabelText('Carregando conversas')).toBeInTheDocument();

    rerender(<MessageThreadSkeleton />);
    expect(screen.getByLabelText('Carregando mensagens')).toBeInTheDocument();
  });
});
