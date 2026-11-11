import { describe, expect, it } from 'vitest';
import { describeVideoRejections, selectVideosToUpload } from './stockVideos';

const MB = 1024 * 1024;
const video = (name: string, sizeMb = 1, type = 'video/mp4') => {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: sizeMb * MB });
  return file;
};

describe('selectVideosToUpload', () => {
  it('aceita vídeos dentro do tamanho e das vagas', () => {
    const selection = selectVideosToUpload({ files: [video('a.mp4'), video('b.mov', 2, 'video/quicktime')], currentCount: 0, maxBytes: 50 * MB });

    expect(selection.accepted.map((file) => file.name)).toEqual(['a.mp4', 'b.mov']);
    expect(describeVideoRejections(selection, 50 * MB)).toEqual([]);
  });

  it('aceita exatamente no limite de tamanho e recusa acima dele', () => {
    const selection = selectVideosToUpload({ files: [video('limite.mp4', 50), video('grande.mp4', 51)], currentCount: 0, maxBytes: 50 * MB });

    expect(selection.accepted.map((file) => file.name)).toEqual(['limite.mp4']);
    expect(selection.tooLargeCount).toBe(1);
  });

  it('recusa o que não é vídeo e reconhece vídeo sem tipo pela extensão', () => {
    const selection = selectVideosToUpload({
      files: [video('foto.jpg', 1, 'image/jpeg'), video('camera.MOV', 1, '')],
      currentCount: 0,
      maxBytes: 50 * MB
    });

    expect(selection.accepted.map((file) => file.name)).toEqual(['camera.MOV']);
    expect(selection.notVideoCount).toBe(1);
  });

  it('corta o que passa do limite de vídeos por aparelho', () => {
    const selection = selectVideosToUpload({ files: [video('a.mp4'), video('b.mp4')], currentCount: 2, maxBytes: 50 * MB });

    expect(selection.accepted.map((file) => file.name)).toEqual(['a.mp4']);
    expect(selection.overLimitCount).toBe(1);
    expect(describeVideoRejections(selection, 50 * MB)).toEqual(['Limite de 3 vídeos por aparelho. Remova um para adicionar outro.']);
  });
});
