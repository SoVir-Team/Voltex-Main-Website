/** Intel HEX (as produced by avr-gcc / arduino-cli) to a flat byte image. Throws on a bad checksum. */
export function parseIntelHex(text: string, size: number): Uint8Array {
  const out = new Uint8Array(size);
  let upper = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line[0] !== ":") throw new Error("Not an Intel HEX file");
    const bytes = line
      .slice(1)
      .match(/../g)!
      .map((h) => parseInt(h, 16));
    const sum = bytes.reduce((a, b) => a + b, 0) & 0xff;
    if (sum !== 0) throw new Error("HEX checksum error");
    const [len, hi, lo, type] = bytes;
    const data = bytes.slice(4, 4 + len);
    if (type === 0) {
      const addr = upper + ((hi << 8) | lo);
      if (addr + len > size) throw new Error("Program is too big for this chip");
      out.set(data, addr);
    } else if (type === 1) break;
    else if (type === 2) upper = ((data[0] << 8) | data[1]) << 4;
    else if (type === 4) upper = ((data[0] << 8) | data[1]) << 16;
  }
  return out;
}

/** UF2 (the Pico's drag-and-drop format) blocks into a flash image starting at `base`. */
export function parseUf2(buf: Uint8Array, base: number, size: number): Uint8Array {
  const out = new Uint8Array(size).fill(0xff);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  for (let off = 0; off + 512 <= buf.length; off += 512) {
    if (view.getUint32(off, true) !== 0x0a324655 || view.getUint32(off + 4, true) !== 0x9e5d5157) continue;
    const addr = view.getUint32(off + 12, true);
    const len = view.getUint32(off + 16, true);
    const at = addr - base;
    if (at < 0 || at + len > size) continue;
    out.set(buf.subarray(off + 32, off + 32 + len), at);
  }
  return out;
}
