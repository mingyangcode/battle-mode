/** Optional local ID3v2.3/2.4 APIC reader. Bounded metadata reads, never audio decode.
 * Unsupported/oversized tags and non JPEG/PNG artwork use the generated cover. */
export async function embeddedArtwork(file: Blob): Promise<Blob | undefined> {
  const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  if (
    head.length < 10 ||
    String.fromCharCode(...head.slice(0, 3)) !== "ID3" ||
    ![3, 4].includes(head[3]) ||
    head[5] & 0xc0
  )
    return;
  const sync = (b: Uint8Array, p: number) =>
    (b[p] & 127) * 2097152 +
    (b[p + 1] & 127) * 16384 +
    (b[p + 2] & 127) * 128 +
    (b[p + 3] & 127);
  const size = sync(head, 6);
  if (size > 4 * 1024 * 1024 || size < 10) return;
  const bytes = new Uint8Array(await file.slice(10, 10 + size).arrayBuffer());
  const data = new DataView(bytes.buffer);
  for (let p = 0; p + 10 <= bytes.length;) {
    const name = String.fromCharCode(...bytes.slice(p, p + 4));
    const length = head[3] === 4 ? sync(bytes, p + 4) : data.getUint32(p + 4);
    if (!length || p + 10 + length > bytes.length) return;
    const begin = p + 10,
      end = begin + length;
    if (name === "APIC" && bytes[p + 9] === 0) {
      const encoding = bytes[begin];
      let q = begin + 1;
      while (q < end && bytes[q]) q++;
      const mime = String.fromCharCode(
        ...bytes.slice(begin + 1, q),
      ).toLowerCase();
      q += 2; // MIME terminator and picture type
      if (encoding === 0 || encoding === 3) {
        while (q < end && bytes[q]) q++;
        q++;
      } else if (encoding === 1 || encoding === 2) {
        while (q + 1 < end && (bytes[q] || bytes[q + 1])) q += 2;
        q += 2;
      } else return;
      if (q < end && ["image/jpeg", "image/png"].includes(mime))
        return new Blob([bytes.slice(q, end)], { type: mime });
    }
    p = end;
  }
}
export function coverGradient(id: string) {
  const palettes = [
    ["#b39a85", "#36444c"],
    ["#8c9ba3", "#423d59"],
    ["#91aaa0", "#324650"],
    ["#ae929e", "#43454f"],
  ];
  const hash = Array.from(id).reduce(
    (n, c) => (n * 31 + c.charCodeAt(0)) >>> 0,
    0,
  );
  const [a, b] = palettes[hash % palettes.length];
  return `radial-gradient(ellipse at 20% 10%, ${a}, transparent 65%), linear-gradient(145deg, ${a}, ${b})`;
}
