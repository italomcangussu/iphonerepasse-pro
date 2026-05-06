import { describe, expect, it } from "vitest";
import { buildUazDownloadMessageRequest, extractUazMedia, parseUazDownloadedMedia } from "./uazapi";

describe("extractUazMedia", () => {
  it("extracts inbound UAZAPI voice note media from message.content with uppercase URL", () => {
    const media = extractUazMedia({
      message: {
        type: "media",
        mediaType: "ptt",
        messageType: "AudioMessage",
        content: {
          PTT: true,
          URL: "https://mmg.whatsapp.net/v/t62/audio.enc",
          mimetype: "audio/ogg; codecs=opus",
        },
      },
    });

    expect(media).toEqual({
      mediaUrl: "https://mmg.whatsapp.net/v/t62/audio.enc",
      mediaType: "audio/ogg; codecs=opus",
      mediaFilename: null,
    });
  });

  it("normalizes ptt media type to audio when no mimetype is present", () => {
    const media = extractUazMedia({
      message: {
        mediaType: "ptt",
        content: {
          URL: "https://mmg.whatsapp.net/v/t62/audio.enc",
        },
      },
    });

    expect(media.mediaType).toBe("audio");
  });

  it("builds UAZAPI download request with mp3 conversion for audio", () => {
    expect(buildUazDownloadMessageRequest({
      messageId: "558591546796:3AC9BE71CB23E36AF98C",
      mediaType: "audio/ogg; codecs=opus",
    })).toEqual({
      endpoint: "/message/download",
      body: {
        id: "558591546796:3AC9BE71CB23E36AF98C",
        return_link: true,
        return_base64: false,
        generate_mp3: true,
      },
    });
  });

  it("prefers downloaded media links over encrypted WhatsApp links", () => {
    expect(parseUazDownloadedMedia({
      data: {
        URL: "https://mmg.whatsapp.net/v/t62/audio.enc?x=1",
        downloadUrl: "https://cdn.uazapi.com/media/audio.mp3",
        mimetype: "audio/mpeg",
        fileName: "audio.mp3",
      },
    })).toEqual({
      mediaUrl: "https://cdn.uazapi.com/media/audio.mp3",
      mediaType: "audio/mpeg",
      mediaFilename: "audio.mp3",
    });
  });
});
