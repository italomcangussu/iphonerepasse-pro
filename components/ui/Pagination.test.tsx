import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Pagination from './Pagination';

describe('Pagination', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
    Element.prototype.scrollTo = vi.fn();
  });

  it('renders nothing when totalPages is 1 or less', () => {
    const { container } = render(
      <Pagination page={0} totalPages={1} totalItems={10} pageSize={10} onPageChange={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders pagination info and handles page changes while scrolling to top', () => {
    const onPageChange = vi.fn();
    render(
      <Pagination page={0} totalPages={5} totalItems={50} pageSize={10} onPageChange={onPageChange} />
    );

    expect(screen.getByText('1–10 de 50')).toBeInTheDocument();
    expect(screen.getByText('1 / 5')).toBeInTheDocument();

    const nextBtn = screen.getByRole('button', { name: /próxima página/i });
    fireEvent.click(nextBtn);

    expect(onPageChange).toHaveBeenCalledWith(1);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});
