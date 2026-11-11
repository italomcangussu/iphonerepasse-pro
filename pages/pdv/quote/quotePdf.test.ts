import { describe, expect, it } from 'vitest';
import { planPageSlices } from './quotePdf';

describe('planPageSlices', () => {
  it('usa uma página só quando o documento cabe', () => {
    expect(planPageSlices(800, 1000, [200, 400])).toEqual([{ start: 0, end: 800 }]);
  });

  it('corta no último bloco que cabe na página, não no meio dele', () => {
    expect(planPageSlices(1500, 1000, [300, 940, 1060])).toEqual([
      { start: 0, end: 940 },
      { start: 940, end: 1500 },
    ]);
  });

  it('corta na altura cheia quando o único ponto de corte deixaria a página quase vazia', () => {
    expect(planPageSlices(1500, 1000, [100])).toEqual([
      { start: 0, end: 1000 },
      { start: 1000, end: 1500 },
    ]);
  });

  it('cobre o documento inteiro, sem sobra nem buraco, em várias páginas', () => {
    const slices = planPageSlices(3210, 1000, [450, 980, 1700, 1950, 2800, 3000]);
    expect(slices[0].start).toBe(0);
    expect(slices[slices.length - 1].end).toBe(3210);
    slices.slice(1).forEach((slice, index) => expect(slice.start).toBe(slices[index].end));
    slices.forEach((slice) => expect(slice.end - slice.start).toBeLessThanOrEqual(1000));
  });
});
