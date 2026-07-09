import { assertStringIncludes } from "https://deno.land/std@0.168.0/testing/asserts.ts";

const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("crm-instagram-webhook-receiver persists inbound attachments as CRM media", () => {
  assertStringIncludes(source, "parseInstagramAttachment");
  assertStringIncludes(source, "persistProviderMediaToCrmStorage");
  assertStringIncludes(source, "media_url: mediaUrl");
  assertStringIncludes(source, "media_type: mediaType");
  assertStringIncludes(source, "mediaUrl,");
  assertStringIncludes(source, "mediaType,");
});
