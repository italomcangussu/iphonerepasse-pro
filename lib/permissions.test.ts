import { describe, expect, it } from 'vitest';
import { buildDefaultPermissionMatrix, PERMISSION_DEFINITIONS } from './permissions';

describe('default permission matrix', () => {
  it('lets the manager refund a reservation deposit without granting Financeiro', () => {
    const matrix = buildDefaultPermissionMatrix();

    expect(matrix.manager.inventory_reserve_refund).toEqual({
      visible: true,
      editable: true,
      deletable: false,
    });
    // O estorno nao pode carregar o Financeiro junto: o gerente devolve o
    // sinal da reserva sem enxergar o caixa.
    expect(matrix.manager.finance.editable).toBe(false);
  });

  it('keeps the deposit refund off for the seller, who can only retain it', () => {
    const matrix = buildDefaultPermissionMatrix();

    expect(matrix.seller.inventory_reserve_refund.editable).toBe(false);
    // Liberar a reserva (retendo o sinal) continua liberado para o vendedor.
    expect(matrix.seller.inventory_reserve.editable).toBe(true);
  });

  it('gives the admin every permission', () => {
    const matrix = buildDefaultPermissionMatrix();

    for (const definition of PERMISSION_DEFINITIONS) {
      expect(matrix.admin[definition.key]).toEqual({
        visible: true,
        editable: true,
        deletable: true,
      });
    }
  });
});
