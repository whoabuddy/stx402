import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class UtilMimeType extends BaseEndpoint {
  schema = {
    tags: ["Utility"],
    summary: "(paid) Get MIME type for file extension",
    parameters: [
      {
        name: "extension",
        in: "query" as const,
        required: true,
        schema: { type: "string" as const },
        description: "File extension (with or without dot)",
      },
      {
        name: "tokenType",
        in: "query" as const,
        required: false,
        schema: { type: "string" as const, enum: ["STX", "sBTC", "USDCx"] as const, default: "STX" },
      },
    ],
    responses: {
      "200": {
        description: "MIME type information",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                extension: { type: "string" as const },
                mimeType: { type: "string" as const },
                category: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid input" },
      "402": { description: "Payment required" },
    },
  };

  private mimeTypes: Record<string, { mime: string; category: string }> = {
    // Images
    jpg: { mime: "image/jpeg", category: "image" },
    jpeg: { mime: "image/jpeg", category: "image" },
    png: { mime: "image/png", category: "image" },
    gif: { mime: "image/gif", category: "image" },
    webp: { mime: "image/webp", category: "image" },
    svg: { mime: "image/svg+xml", category: "image" },
    ico: { mime: "image/x-icon", category: "image" },
    bmp: { mime: "image/bmp", category: "image" },
    tiff: { mime: "image/tiff", category: "image" },
    avif: { mime: "image/avif", category: "image" },
    // Audio
    mp3: { mime: "audio/mpeg", category: "audio" },
    wav: { mime: "audio/wav", category: "audio" },
    ogg: { mime: "audio/ogg", category: "audio" },
    flac: { mime: "audio/flac", category: "audio" },
    aac: { mime: "audio/aac", category: "audio" },
    m4a: { mime: "audio/mp4", category: "audio" },
    // Video
    mp4: { mime: "video/mp4", category: "video" },
    webm: { mime: "video/webm", category: "video" },
    avi: { mime: "video/x-msvideo", category: "video" },
    mov: { mime: "video/quicktime", category: "video" },
    mkv: { mime: "video/x-matroska", category: "video" },
    // Documents
    pdf: { mime: "application/pdf", category: "document" },
    doc: { mime: "application/msword", category: "document" },
    docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", category: "document" },
    xls: { mime: "application/vnd.ms-excel", category: "document" },
    xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", category: "document" },
    ppt: { mime: "application/vnd.ms-powerpoint", category: "document" },
    pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", category: "document" },
    // Text
    txt: { mime: "text/plain", category: "text" },
    html: { mime: "text/html", category: "text" },
    htm: { mime: "text/html", category: "text" },
    css: { mime: "text/css", category: "text" },
    csv: { mime: "text/csv", category: "text" },
    xml: { mime: "application/xml", category: "text" },
    // Code
    js: { mime: "application/javascript", category: "code" },
    mjs: { mime: "application/javascript", category: "code" },
    ts: { mime: "application/typescript", category: "code" },
    json: { mime: "application/json", category: "code" },
    py: { mime: "text/x-python", category: "code" },
    rb: { mime: "text/x-ruby", category: "code" },
    php: { mime: "application/x-php", category: "code" },
    java: { mime: "text/x-java-source", category: "code" },
    c: { mime: "text/x-c", category: "code" },
    cpp: { mime: "text/x-c++", category: "code" },
    h: { mime: "text/x-c", category: "code" },
    rs: { mime: "text/x-rust", category: "code" },
    go: { mime: "text/x-go", category: "code" },
    swift: { mime: "text/x-swift", category: "code" },
    kt: { mime: "text/x-kotlin", category: "code" },
    // Archives
    zip: { mime: "application/zip", category: "archive" },
    tar: { mime: "application/x-tar", category: "archive" },
    gz: { mime: "application/gzip", category: "archive" },
    "7z": { mime: "application/x-7z-compressed", category: "archive" },
    rar: { mime: "application/vnd.rar", category: "archive" },
    // Fonts
    woff: { mime: "font/woff", category: "font" },
    woff2: { mime: "font/woff2", category: "font" },
    ttf: { mime: "font/ttf", category: "font" },
    otf: { mime: "font/otf", category: "font" },
    eot: { mime: "application/vnd.ms-fontobject", category: "font" },
    // Other
    wasm: { mime: "application/wasm", category: "binary" },
    bin: { mime: "application/octet-stream", category: "binary" },
    exe: { mime: "application/x-msdownload", category: "binary" },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let extension = c.req.query("extension");
    if (!extension) {
      return this.errorResponse(c, "extension parameter is required", 400);
    }

    // Normalize: remove leading dot and lowercase
    extension = extension.replace(/^\./, "").toLowerCase();

    const info = this.mimeTypes[extension];

    if (!info) {
      return c.json({
        extension,
        mimeType: "application/octet-stream",
        category: "unknown",
        known: false,
        tokenType,
      });
    }

    return c.json({
      extension,
      mimeType: info.mime,
      category: info.category,
      known: true,
      tokenType,
    });
  }
}
