import type { Plugin } from 'vite';

export const DEFAULT_CHUNK_LIMIT_BYTES = 500_000;
export const HEIC_CHUNK_LIMIT_BYTES = 1_400_000;
export const VITE_CHUNK_WARNING_LIMIT_KB = HEIC_CHUNK_LIMIT_BYTES / 1_000;

export interface ChunkBudgetCandidate {
  name: string;
  fileName: string;
  bytes: number;
  moduleIds: string[];
}

export interface ChunkBudgetViolation extends ChunkBudgetCandidate {
  limitBytes: number;
}

const containsHeicConverter = (moduleIds: string[]): boolean =>
  moduleIds.some((moduleId) =>
    moduleId.replaceAll('\\', '/').includes('/node_modules/heic2any/')
  );

const resolveChunkLimit = (chunk: ChunkBudgetCandidate): number =>
  containsHeicConverter(chunk.moduleIds)
    ? HEIC_CHUNK_LIMIT_BYTES
    : DEFAULT_CHUNK_LIMIT_BYTES;

export const collectChunkBudgetViolations = (
  chunks: ChunkBudgetCandidate[]
): ChunkBudgetViolation[] =>
  chunks.flatMap((chunk) => {
    const limitBytes = resolveChunkLimit(chunk);
    return chunk.bytes > limitBytes ? [{ ...chunk, limitBytes }] : [];
  });

const formatKilobytes = (bytes: number): string => `${(bytes / 1_000).toFixed(2)} kB`;

export const chunkBudgetPlugin = (): Plugin => ({
  name: 'chunk-budget',
  generateBundle(_options, bundle) {
    const chunks = Object.values(bundle)
      .filter((entry) => entry.type === 'chunk')
      .map((entry) => ({
        name: entry.name,
        fileName: entry.fileName,
        bytes: Buffer.byteLength(entry.code, 'utf8'),
        moduleIds: Object.keys(entry.modules),
      }));

    const violations = collectChunkBudgetViolations(chunks);
    if (violations.length === 0) return;

    const details = violations
      .map(
        ({ fileName, bytes, limitBytes }) =>
          `${fileName}: ${formatKilobytes(bytes)} > ${formatKilobytes(limitBytes)}`
      )
      .join('\n');

    this.error(`Chunk budget exceeded:\n${details}`);
  },
});
