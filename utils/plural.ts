/** "1 venda", "2 vendas": conta com o substantivo no número certo, sem "(s)". */
export const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;
