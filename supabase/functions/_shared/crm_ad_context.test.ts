import { assertEquals } from "jsr:@std/assert@1";
import {
  extractAdContext,
  parseCapacityGb,
  parseProductHint,
} from "./crm_ad_context.ts";

Deno.test("parseCapacityGb reads GB / GIGAS / TB", () => {
  assertEquals(parseCapacityGb("iPhone 11 128 GIGAS"), 128);
  assertEquals(parseCapacityGb("256GB seminovo"), 256);
  assertEquals(parseCapacityGb("modelo 1TB topo"), 1024);
  assertEquals(parseCapacityGb("sem capacidade aqui"), null);
});

Deno.test("parseProductHint extracts model + capacity from ad text", () => {
  assertEquals(parseProductHint("OFERTA RELÂMPAGO", "iPhone 11 128 GIGAS por R$1.700"), {
    model: "iPhone 11",
    capacity_gb: 128,
    raw: "iPhone 11",
  });
  assertEquals(parseProductHint("iphone 13 pro max 256gb"), {
    model: "iPhone 13 Pro Max",
    capacity_gb: 256,
    raw: "iphone 13 pro max",
  });
  assertEquals(parseProductHint("iPhone SE disponível"), {
    model: "iPhone SE",
    capacity_gb: null,
    raw: "iPhone SE",
  });
  assertEquals(parseProductHint("Garanta já o seu!"), null);
});

Deno.test("extractAdContext reads WhatsApp CTWA externalAdReply (carousel clicked card)", () => {
  const body = {
    message: {
      text: "Olá! Vi o anúncio e gostaria de mais informações",
      contextInfo: {
        externalAdReply: {
          sourceType: "ad",
          sourceApp: "instagram",
          sourceID: "120217abc",
          title: "Garanta já o seu!",
          body: "iPhone 11 128 GIGAS · 3 meses de garantia · R$1.700",
          mediaURL: "https://scontent.example/ad-iphone11.jpg",
          sourceURL: "https://fb.me/anuncio",
          showAdAttribution: true,
        },
      },
    },
  };
  const ctx = extractAdContext(body);
  assertEquals(ctx?.is_from_ad, true);
  assertEquals(ctx?.source, "instagram_ads");
  assertEquals(ctx?.campaign_id, "120217abc");
  assertEquals(ctx?.campaign_title, "Garanta já o seu!");
  assertEquals(ctx?.image_url, "https://scontent.example/ad-iphone11.jpg");
  assertEquals(ctx?.product_hint?.model, "iPhone 11");
  assertEquals(ctx?.product_hint?.capacity_gb, 128);
});

Deno.test("extractAdContext detects Facebook source app", () => {
  const ctx = extractAdContext({
    contextInfo: {
      externalAdReply: {
        sourceType: "ad",
        sourceApp: "facebook",
        title: "Oferta",
        body: "iPhone 12 Pro",
      },
    },
  });
  assertEquals(ctx?.source, "meta_ads");
  assertEquals(ctx?.product_hint?.model, "iPhone 12 Pro");
});

Deno.test("extractAdContext returns null for non-ad messages", () => {
  assertEquals(extractAdContext({ message: { text: "oi tudo bem?" } }), null);
  assertEquals(extractAdContext(null), null);
});
