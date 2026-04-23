import { describe, expect, it } from "vitest";
import {
  MAX_MEDIA_BATCH_ITEMS,
  buildBatchMessagePayloads,
  validateAttachmentSelection,
} from "../pages/crm/conversationMediaBatch";

const file = (name: string, type: string, size = 1024) => ({ name, type, size });

describe("conversation media batch", () => {
  it("keeps single picker to one accepted file", () => {
    const result = validateAttachmentSelection({
      mode: "single",
      files: [file("a.jpg", "image/jpeg"), file("b.jpg", "image/jpeg")],
    });

    expect(result.acceptedFiles).toHaveLength(1);
    expect(result.rejectedOverflowFiles).toHaveLength(1);
  });

  it("rejects non image/video files in media batch mode", () => {
    const result = validateAttachmentSelection({
      mode: "media-batch",
      files: [file("a.jpg", "image/jpeg"), file("doc.pdf", "application/pdf")],
    });

    expect(result.acceptedFiles.map((item) => item.name)).toEqual(["a.jpg"]);
    expect(result.rejectedInvalidTypeFiles.map((item) => item.name)).toEqual(["doc.pdf"]);
  });

  it("enforces media batch limit with existing attachments", () => {
    const result = validateAttachmentSelection({
      mode: "media-batch",
      existingMediaCount: MAX_MEDIA_BATCH_ITEMS - 1,
      files: [file("a.jpg", "image/jpeg"), file("b.mp4", "video/mp4")],
    });

    expect(result.acceptedFiles.map((item) => item.name)).toEqual(["a.jpg"]);
    expect(result.rejectedOverflowFiles.map((item) => item.name)).toEqual(["b.mp4"]);
  });

  it("enforces total attachment limit in single mode", () => {
    const result = validateAttachmentSelection({
      mode: "single",
      existingMediaCount: MAX_MEDIA_BATCH_ITEMS,
      files: [file("doc.pdf", "application/pdf")],
    });

    expect(result.acceptedFiles).toHaveLength(0);
    expect(result.rejectedOverflowFiles.map((item) => item.name)).toEqual(["doc.pdf"]);
  });

  it("keeps caption only on first media payload", () => {
    expect(
      buildBatchMessagePayloads(
        [
          { mediaUrl: "https://cdn/a.jpg", mediaType: "image/jpeg", mediaFilename: "a.jpg" },
          { mediaUrl: "https://cdn/b.jpg", mediaType: "image/jpeg", mediaFilename: "b.jpg" },
        ],
        "Legenda",
      ),
    ).toEqual([
      { mediaUrl: "https://cdn/a.jpg", mediaType: "image/jpeg", mediaFilename: "a.jpg", content: "Legenda" },
      { mediaUrl: "https://cdn/b.jpg", mediaType: "image/jpeg", mediaFilename: "b.jpg", content: "" },
    ]);
  });
});
