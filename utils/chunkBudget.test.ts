import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CHUNK_LIMIT_BYTES,
  HEIC_CHUNK_LIMIT_BYTES,
  collectChunkBudgetViolations,
} from './chunkBudget';

const chunk = (params: {
  bytes: number;
  name?: string;
  fileName?: string;
  moduleIds?: string[];
}) => ({
  name: params.name ?? 'feature',
  fileName: params.fileName ?? 'assets/feature-hash.js',
  bytes: params.bytes,
  moduleIds: params.moduleIds ?? ['/src/feature.ts'],
});

describe('chunkBudget', () => {
  it('rejects ordinary chunks larger than 500 kB', () => {
    const violations = collectChunkBudgetViolations([
      chunk({ bytes: DEFAULT_CHUNK_LIMIT_BYTES + 1 }),
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        fileName: 'assets/feature-hash.js',
        limitBytes: DEFAULT_CHUNK_LIMIT_BYTES,
      }),
    ]);
  });

  it('allows the deferred HEIC converter up to its explicit budget', () => {
    const violations = collectChunkBudgetViolations([
      chunk({
        bytes: 1_352_910,
        name: 'renamed-by-rollup',
        moduleIds: ['/repo/node_modules/heic2any/dist/heic2any.js'],
      }),
    ]);

    expect(violations).toEqual([]);
  });

  it('rejects the HEIC converter when it exceeds its own budget', () => {
    const violations = collectChunkBudgetViolations([
      chunk({
        bytes: HEIC_CHUNK_LIMIT_BYTES + 1,
        name: 'heic2any',
        moduleIds: ['C:\\repo\\node_modules\\heic2any\\dist\\heic2any.js'],
      }),
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        name: 'heic2any',
        limitBytes: HEIC_CHUNK_LIMIT_BYTES,
      }),
    ]);
  });
});
