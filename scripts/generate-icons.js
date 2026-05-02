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

function createPNG(size, variant) {
  const bgTop = variant.bgTop;
  const bgBottom = variant.bgBottom;

  // Draw pixels
  const pixels = new Uint8Array(size * size * 4);

  function setPixel(x, y, color) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const idx = (y * size + x) * 4;
    pixels[idx] = color[0];
    pixels[idx + 1] = color[1];
    pixels[idx + 2] = color[2];
    pixels[idx + 3] = 255;
  }

  function blendPixel(x, y, color, alpha) {
    if (x < 0 || y < 0 || x >= size || y >= size || alpha <= 0) return;
    const idx = (y * size + x) * 4;
    const inv = 1 - alpha;
    pixels[idx] = Math.round(pixels[idx] * inv + color[0] * alpha);
    pixels[idx + 1] = Math.round(pixels[idx + 1] * inv + color[1] * alpha);
    pixels[idx + 2] = Math.round(pixels[idx + 2] * inv + color[2] * alpha);
    pixels[idx + 3] = 255;
  }

  function lerp(a, b, t) {
    return Math.round(a + (b - a) * t);
  }

  function colorMix(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  }

  function insideRoundedSquare(x, y, min, max, radius) {
    const dx = x < min + radius ? min + radius - x : x > max - radius ? x - (max - radius) : 0;
    const dy = y < min + radius ? min + radius - y : y > max - radius ? y - (max - radius) : 0;
    return dx * dx + dy * dy <= radius * radius;
  }

  // Rounded-square deep-night background.
  const radius = size * 0.2;
  const inset = Math.max(2, Math.floor(size * 0.03));
  const min = inset;
  const max = size - inset - 1;
  for (let y = min; y <= max; y++) {
    const t = (y - min) / (max - min);
    const rowColor = colorMix(bgTop, bgBottom, t);
    for (let x = min; x <= max; x++) {
      if (!insideRoundedSquare(x, y, min, max, radius)) continue;

      // Soft vignette to keep focus centered.
      const nx = (x - size / 2) / (size / 2);
      const ny = (y - size / 2) / (size / 2);
      const vignette = Math.max(0, 1 - (nx * nx + ny * ny) * 0.55);
      const base = colorMix(bgBottom, rowColor, vignette);
      setPixel(x, y, base);
    }
  }

  function drawAuroraCurtain(opts) {
    const {
      baseY,
      amp,
      freq,
      amp2,
      freq2,
      phase,
      slope,
      thickness,
      thicknessJitter,
      color,
      strength,
      glow,
    } = opts;

    for (let x = min; x <= max; x++) {
      const nx = x / (size - 1);
      const center =
        baseY +
        amp * Math.sin(nx * Math.PI * freq + phase) +
        amp2 * Math.sin(nx * Math.PI * freq2 - phase * 0.7) +
        slope * (nx - 0.5);
      const localThickness = thickness * (1 + thicknessJitter * Math.sin(nx * Math.PI * 3.8 + phase));

      for (let y = min; y <= max; y++) {
        if (!insideRoundedSquare(x, y, min, max, radius)) continue;
        const ny = y / (size - 1);
        const dist = Math.abs(ny - center);
        const core = Math.exp(-(dist * dist) / (localThickness * localThickness));
        const bloom = Math.exp(-(dist * dist) / ((localThickness * 2.5) * (localThickness * 2.5)));
        const alpha = core * strength + bloom * glow;
        blendPixel(x, y, color, Math.min(0.95, alpha));
      }
    }
  }

  for (const curtain of variant.curtains) drawAuroraCurtain(curtain);

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

const vividA = {
  bgTop: [7, 18, 40],
  bgBottom: [2, 8, 20],
  curtains: [
    { baseY: 0.3, amp: 0.12, freq: 1.6, amp2: 0.035, freq2: 5.4, phase: -0.3, slope: 0.05, thickness: 0.05, thicknessJitter: 0.35, color: [42, 242, 138], strength: 0.55, glow: 0.14 },
    { baseY: 0.43, amp: 0.11, freq: 1.9, amp2: 0.03, freq2: 6.2, phase: 1.0, slope: -0.08, thickness: 0.048, thicknessJitter: 0.3, color: [74, 202, 255], strength: 0.52, glow: 0.12 },
    { baseY: 0.39, amp: 0.08, freq: 2.3, amp2: 0.028, freq2: 6.8, phase: 0.4, slope: 0.02, thickness: 0.032, thicknessJitter: 0.4, color: [247, 210, 52], strength: 0.45, glow: 0.06 },
    { baseY: 0.47, amp: 0.07, freq: 2.1, amp2: 0.022, freq2: 7.1, phase: -1.2, slope: -0.03, thickness: 0.027, thicknessJitter: 0.33, color: [58, 112, 226], strength: 0.3, glow: 0.05 },
  ],
};

for (const size of [192, 512]) {
  const png = createPNG(size, vividA);
  const out = join(__dirname, `../src/client/icon-${size}.png`);
  writeFileSync(out, png);
  console.log(`Written icon-${size}.png (vivid-a)`);
}
