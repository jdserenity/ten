/**
 * Generates icon-192.png and icon-512.png using the Canvas API via
 * the built-in node:canvas... which doesn't exist. We use a minimal
 * pure-JS PNG encoder instead — no dependencies needed.
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Minimal PNG encoder (RGBA, no compression lib needed — uses zlib via node)
import { deflateSync } from 'zlib';

function createPNG(size) {
  const bg = [15, 15, 15];       // #0f0f0f
  const accent = [74, 158, 255]; // #4a9eff

  // Draw pixels
  const pixels = new Uint8Array(size * size * 4);
  const cx = size / 2, cy = size / 2, r = size * 0.38;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // Circle
      const dx = x - cx, dy = y - cy;
      const inCircle = Math.sqrt(dx * dx + dy * dy) < r;
      const [R, G, B] = inCircle ? accent : bg;
      pixels[idx] = R; pixels[idx+1] = G; pixels[idx+2] = B; pixels[idx+3] = 255;
    }
  }

  // Build raw image data with filter bytes
  const rowLen = size * 4;
  const raw = new Uint8Array(size * (rowLen + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (rowLen + 1)] = 0; // filter type: None
    raw.set(pixels.subarray(y * rowLen, (y + 1) * rowLen), y * (rowLen + 1) + 1);
  }

  const compressed = deflateSync(raw);

  // PNG chunk helper
  const crc32 = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return (data) => {
      let c = 0xffffffff;
      for (const b of data) c = t[(c ^ b) & 0xff] ^ (c >>> 8);
      return (c ^ 0xffffffff) >>> 0;
    };
  })();

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crcInput = Buffer.concat([typeBytes, data]);
    const crcVal = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(crcInput));
    return Buffer.concat([len, typeBytes, data, crcVal]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // bit depth 8, color type RGB... wait need RGBA
  // Actually use color type 6 (RGBA)
  ihdr[9] = 6;
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const png = createPNG(size);
  const out = join(__dirname, `../public/icon-${size}.png`);
  writeFileSync(out, png);
  console.log(`Written icon-${size}.png`);
}
