import { assertEquals } from "jsr:@std/assert@1";
import {
  buildUazChatDetailsRequest,
  buildUazDownloadMessageRequest,
  buildUazFindChatRequest,
  buildUazMessageActionRequest,
  buildUazSendMessageRequest,
  extractUazMedia,
  extractUazReply,
  parseUazChatAvatarUrl,
  parseUazDownloadedMedia,
} from "./uazapi.ts";

Deno.test("extractUazMedia extracts inbound UAZAPI voice note media from message.content with uppercase URL", () => {
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

  assertEquals(media, {
    mediaUrl: "https://mmg.whatsapp.net/v/t62/audio.enc",
    mediaType: "audio/ogg; codecs=opus",
    mediaFilename: null,
  });
});

Deno.test("extractUazMedia normalizes ptt media type to audio when no mimetype is present", () => {
  const media = extractUazMedia({
    message: {
      mediaType: "ptt",
      content: {
        URL: "https://mmg.whatsapp.net/v/t62/audio.enc",
      },
    },
  });

  assertEquals(media.mediaType, "audio");
});

Deno.test("buildUazDownloadMessageRequest builds UAZAPI download request with mp3 conversion for audio", () => {
  assertEquals(
    buildUazDownloadMessageRequest({
      messageId: "558591546796:3AC9BE71CB23E36AF98C",
      mediaType: "audio/ogg; codecs=opus",
    }),
    {
      endpoint: "/message/download",
      body: {
        id: "558591546796:3AC9BE71CB23E36AF98C",
        return_link: true,
        return_base64: false,
        generate_mp3: true,
      },
    },
  );
});

Deno.test("buildUazSendMessageRequest sends recorded audio as WhatsApp voice note when requested", () => {
  assertEquals(
    buildUazSendMessageRequest({
      number: "+55 (85) 99999-9999",
      mediaUrl: "https://crm-media.local/audio.ogg",
      mediaType: "audio/ogg",
      mediaFilename: "audio.ogg",
      voiceNote: true,
    }),
    {
      endpoint: "/send/media",
      body: {
        number: "5585999999999",
        type: "ptt",
        file: "https://crm-media.local/audio.ogg",
        mimetype: "audio/ogg",
      },
    },
  );
});

Deno.test("buildUazMessageActionRequest builds mark-read request with multiple message ids", () => {
  assertEquals(
    buildUazMessageActionRequest({
      action: "mark_read",
      messageId: null,
      fallbackNumber: "+55 (85) 99999-9999",
      payload: { ids: ["msg-1", "msg-2"] },
    }),
    {
      endpoint: "/message/markread",
      body: {
        number: "5585999999999",
        id: ["msg-1", "msg-2"],
      },
    },
  );
});

Deno.test("buildUazMessageActionRequest builds presence request", () => {
  assertEquals(
    buildUazMessageActionRequest({
      action: "presence",
      messageId: null,
      fallbackNumber: "+55 (85) 99999-9999",
      payload: { presence: "composing" },
    }),
    {
      endpoint: "/message/presence",
      body: {
        number: "5585999999999",
        presence: "composing",
      },
    },
  );
});

Deno.test("parseUazDownloadedMedia prefers downloaded media links over encrypted WhatsApp links", () => {
  assertEquals(
    parseUazDownloadedMedia({
      data: {
        URL: "https://mmg.whatsapp.net/v/t62/audio.enc?x=1",
        downloadUrl: "https://cdn.uazapi.com/media/audio.mp3",
        mimetype: "audio/mpeg",
        fileName: "audio.mp3",
      },
    }),
    {
      mediaUrl: "https://cdn.uazapi.com/media/audio.mp3",
      mediaType: "audio/mpeg",
      mediaFilename: "audio.mp3",
    },
  );
});

Deno.test("UAZ chat lookup builds request and extracts imagePreview as lead avatar fallback", () => {
  assertEquals(
    buildUazFindChatRequest({ chatId: "558597871608@s.whatsapp.net" }),
    {
      endpoint: "/chat/find",
      body: {
        wa_chatid: "558597871608@s.whatsapp.net",
      },
    },
  );

  assertEquals(
    parseUazChatAvatarUrl({
      chats: [{
        image: "",
        imagePreview: "https://pps.whatsapp.net/v/t61.24694-24/avatar.jpg",
      }],
    }),
    "https://pps.whatsapp.net/v/t61.24694-24/avatar.jpg",
  );
});

Deno.test("UAZ chat details uses phone digits and parses preview or full avatar", () => {
  assertEquals(
    buildUazChatDetailsRequest({
      talkId: "5585999999999@s.whatsapp.net",
      preview: true,
    }),
    {
      endpoint: "/chat/details",
      body: {
        number: "5585999999999",
        preview: true,
      },
    },
  );

  assertEquals(
    parseUazChatAvatarUrl({
      image: "https://pps.whatsapp.net/full-avatar.jpg",
    }),
    "https://pps.whatsapp.net/full-avatar.jpg",
  );
});

Deno.test("extractUazReply extracts stanzaID and quoted bot text from real UAZAPI message.content.contextInfo", () => {
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
          quotedMessage: {
            conversation: "E qual é o aparelho que você tem agora?",
          },
          quotedType: 0,
        },
      },
    },
  });

  assertEquals(reply, {
    targetMessageId: "3EB00174733AAC69AC86A0",
    previewText: "E qual é o aparelho que você tem agora?",
  });
});

Deno.test("extractUazReply returns nulls when there is no quote or reply", () => {
  assertEquals(extractUazReply({ message: { content: { text: "oi" } } }), {
    targetMessageId: null,
    previewText: null,
  });
});
