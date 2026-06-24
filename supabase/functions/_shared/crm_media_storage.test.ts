import { assertEquals } from "jsr:@std/assert@1";
import {
  buildCrmMessageMediaStoragePath,
  persistProviderMediaToCrmStorage,
} from "./crm_media_storage.ts";

Deno.test("buildCrmMessageMediaStoragePath creates deterministic encoded paths", () => {
  assertEquals(
    buildCrmMessageMediaStoragePath({
      storeId: "loja sobral",
      conversationId: "conversation/1",
      messageId: "5585:ABC",
      mediaType: "audio/ogg",
      mediaFilename: "audio.ogg",
      mediaUrl: "https://provider.example/audio",
    }),
    "messages/loja%20sobral/conversation%2F1/5585%3AABC.ogg",
  );
});

Deno.test("persistProviderMediaToCrmStorage uploads provider media and returns public URL", async () => {
  const uploads: Record<string, unknown>[] = [];
  const supabase = {
    storage: {
      from(bucket: string) {
        return {
          upload(
            path: string,
            bytes: Uint8Array,
            options: Record<string, unknown>,
          ) {
            uploads.push({ bucket, path, bytes: Array.from(bytes), options });
            return Promise.resolve({ data: { path }, error: null });
          },
          getPublicUrl(path: string) {
            return {
              data: {
                publicUrl:
                  `https://project.supabase.co/storage/v1/object/public/crm-media/${path}`,
              },
            };
          },
        };
      },
    },
  };

  const result = await persistProviderMediaToCrmStorage({
    supabase,
    storeId: "store-1",
    conversationId: "conversation-1",
    messageId: "provider-message-1",
    mediaUrl: "https://provider.example/image.jpg",
    fetchImpl: () =>
      Promise.resolve(
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { "Content-Type": "image/jpeg" },
        }),
      ),
  });

  assertEquals(uploads[0].bucket, "crm-media");
  assertEquals(
    uploads[0].path,
    "messages/store-1/conversation-1/provider-message-1.jpg",
  );
  assertEquals(
    (uploads[0].options as Record<string, unknown>).contentType,
    "image/jpeg",
  );
  assertEquals(result.mediaType, "image/jpeg");
  assertEquals(
    result.mediaUrl,
    "https://project.supabase.co/storage/v1/object/public/crm-media/messages/store-1/conversation-1/provider-message-1.jpg",
  );
});
