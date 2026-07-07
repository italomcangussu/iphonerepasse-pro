import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CRMAvatarContent from './CRMAvatarContent';

describe('CRMAvatarContent', () => {
  it('falls back to initials when the stored avatar cannot load', () => {
    render(
      <CRMAvatarContent
        avatarUrl="https://cdn.example/broken.webp"
        name="Maria Silva"
      />,
    );

    fireEvent.error(screen.getByRole('img', { name: 'Maria Silva' }));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('MS')).toBeInTheDocument();
  });

  it('tries again when realtime supplies a different avatar URL', () => {
    const { rerender } = render(
      <CRMAvatarContent avatarUrl="https://cdn.example/old.webp" name="Maria Silva" />,
    );
    fireEvent.error(screen.getByRole('img', { name: 'Maria Silva' }));

    rerender(
      <CRMAvatarContent avatarUrl="https://cdn.example/new.webp" name="Maria Silva" />,
    );

    expect(screen.getByRole('img', { name: 'Maria Silva' })).toHaveAttribute(
      'src',
      'https://cdn.example/new.webp',
    );
  });
});
