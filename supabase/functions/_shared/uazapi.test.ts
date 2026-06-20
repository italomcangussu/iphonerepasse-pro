import { describe, expect, it } from "vitest";
import {
  buildUazDownloadMessageRequest,
  buildUazFindChatRequest,
  extractUazMedia,
  extractUazReply,
  parseUazChatAvatarUrl,
  parseUazDownloadedMedia,
} from "./uazapi";

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

  it("builds a chat lookup request and extracts imagePreview as lead avatar fallback", () => {
    expect(buildUazFindChatRequest({ chatId: "558597871608@s.whatsapp.net" })).toEqual({
      endpoint: "/chat/find",
      body: {
        wa_chatid: "558597871608@s.whatsapp.net",
      },
    });

    expect(parseUazChatAvatarUrl({
      chats: [{
        image: "",
        imagePreview: "https://pps.whatsapp.net/v/t61.24694-24/avatar.jpg",
      }],
    })).toBe("https://pps.whatsapp.net/v/t61.24694-24/avatar.jpg");
  });
});

describe("extractUazReply", () => {
  it("extracts stanzaID + quoted bot text from real UAZAPI message.content.contextInfo", () => {
    const reply = extractUazReply({
      EventType: "messages",
      message: {
        messageid: "3A25511448BE9975CD01",
        id: "558591546796:3A25511448BE9975CD01",
        fromMe: false,
        content: {
          text: "14pm",
          contextInfo: {
            stanzaID: "3EB00174733AAC69AC86A0",
            participant: "208881825353922@lid",
            quotedMessage: { conversation: "E qual é o aparelho que você tem agora?" },
            quotedType: 0,
          },
        },
      },
    });

    expect(reply).toEqual({
      targetMessageId: "3EB00174733AAC69AC86A0",
      previewText: "E qual é o aparelho que você tem agora?",
    });
  });

  it("returns nulls when there is no quote/reply", () => {
    expect(extractUazReply({ message: { content: { text: "oi" } } })).toEqual({
      targetMessageId: null,
      previewText: null,
    });
  });
});
