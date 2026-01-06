/**
 * Tests for text compression/decompression endpoints
 */

import { createEndpointTest } from "./_test_generator";

export const testCompress = createEndpointTest({
  name: "compress",
  endpoint: "/api/text/compress",
  method: "POST",
  body: {
    text: "Hello, World! This is some text to compress for testing purposes. The longer the text, the better the compression ratio.",
    algorithm: "gzip",
  },
  validateResponse: (data: unknown, tokenType) => {
    const d = data as {
      compressed: string;
      algorithm: string;
      inputLength: number;
      outputLength: number;
      compressionRatio: number;
      tokenType: string;
    };
    return (
      typeof d.compressed === "string" &&
      d.compressed.length > 0 &&
      d.algorithm === "gzip" &&
      typeof d.compressionRatio === "number" &&
      d.tokenType === tokenType
    );
  },
  description: "Compress text using gzip algorithm",
});

export const testDecompress = createEndpointTest({
  name: "decompress",
  endpoint: "/api/text/decompress",
  method: "POST",
  body: {
    // "Hello, World!" compressed with gzip and base64 encoded
    compressed: "H4sIAAAAAAAAE8tIzcnJVyjPL8pJUQQAlRmFGwwAAAA=",
    algorithm: "gzip",
  },
  validateResponse: (data: unknown, tokenType) => {
    const d = data as {
      text: string;
      algorithm: string;
      inputLength: number;
      outputLength: number;
      tokenType: string;
    };
    return (
      d.text === "Hello, World!" &&
      d.algorithm === "gzip" &&
      d.tokenType === tokenType
    );
  },
  description: "Decompress gzip data back to text",
});

export const testCompressDeflate = createEndpointTest({
  name: "compress-deflate",
  endpoint: "/api/text/compress",
  method: "POST",
  body: {
    text: "Testing deflate compression algorithm with some sample text.",
    algorithm: "deflate",
  },
  validateResponse: (data: unknown, tokenType) => {
    const d = data as {
      compressed: string;
      algorithm: string;
      tokenType: string;
    };
    return (
      typeof d.compressed === "string" &&
      d.algorithm === "deflate" &&
      d.tokenType === tokenType
    );
  },
  description: "Compress text using deflate algorithm",
});

// Run tests if executed directly
if (import.meta.main) {
  console.log("Testing text compression endpoints...\n");

  const compressResult = await testCompress(true);
  console.log("\nCompress test results:", compressResult);

  const decompressResult = await testDecompress(true);
  console.log("\nDecompress test results:", decompressResult);

  const deflateResult = await testCompressDeflate(true);
  console.log("\nDeflate test results:", deflateResult);
}
