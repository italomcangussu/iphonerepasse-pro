import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AudioRecorder from './AudioRecorder';

class MediaRecorderMock {
  static isTypeSupported = vi.fn(() => true);
  stream: MediaStream;
  state: RecordingState = 'inactive';
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(stream: MediaStream) {
    this.stream = stream;
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.onstop?.();
  }
}

const makeStream = () => {
  const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
  const stream = {
    getTracks: () => [track],
  } as unknown as MediaStream;
  return { stream, track };
};

describe('AudioRecorder', () => {
  beforeEach(() => {
    vi.stubGlobal('MediaRecorder', MediaRecorderMock);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
  });

  it('uses the provided stream without requesting the microphone again', async () => {
    const { stream } = makeStream();

    render(
      <AudioRecorder
        initialStream={stream}
        isSending={false}
        onStop={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(MediaRecorderMock.isTypeSupported).toHaveBeenCalled();
    });
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it('stops every provided track when unmounted', async () => {
    const { stream, track } = makeStream();
    const { unmount } = render(
      <AudioRecorder
        initialStream={stream}
        isSending={false}
        onStop={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(MediaRecorderMock.isTypeSupported).toHaveBeenCalled();
    });
    unmount();

    expect(track.stop).toHaveBeenCalled();
  });

  it('reports an actionable error when the browser cannot record WhatsApp voice-note audio', async () => {
    MediaRecorderMock.isTypeSupported.mockReturnValue(false);
    const { stream, track } = makeStream();
    const onError = vi.fn();
    const onCancel = vi.fn();

    render(
      <AudioRecorder
        initialStream={stream}
        isSending={false}
        onStop={vi.fn()}
        onCancel={onCancel}
        onError={onError}
      />
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.stringMatching(/nota de voz do WhatsApp/i));
    });
    expect(onCancel).toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalled();
  });
});
