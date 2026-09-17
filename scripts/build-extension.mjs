import { build } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
for(const [entry,format] of [['background','es'],['content','iife']]) {
  await build({configFile:false,build:{target:'chrome120',emptyOutDir:false,minify:false,lib:{entry:`src/extension/${entry}.ts`,name:'ApplyMate',formats:[format],fileName:()=>`${entry}.js`}}});
}
const manifest = {
  manifest_version: 3,
  name: "ApplyMate",
  version: "0.1.0",
  minimum_chrome_version: "120",
  description:
    "Your job profile, ready to fill. Local resume import and assisted job applications.",
  permissions: ["storage", "activeTab", "scripting", "sidePanel"],
  optional_host_permissions: ["https://*/*", "http://*/*"],
  background: { service_worker: "background.js", type: "module" },
  action: { default_title: "Open ApplyMate" },
  options_page: "options.html",
  side_panel: { default_path: "sidepanel.html" },
  icons: { 16: "icon16.png", 48: "icon48.png", 128: "icon128.png" },
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'; worker-src 'self'",
  },
};
await writeFile("dist/manifest.json", JSON.stringify(manifest, null, 2));
// Generate a crisp bitmap monogram without external assets or runtime network access.
const { deflateSync } = await import("node:zlib");
function crc(buf) {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type),
    n = Buffer.alloc(4),
    check = Buffer.alloc(4);
  n.writeUInt32BE(data.length);
  check.writeUInt32BE(crc(Buffer.concat([t, data])));
  return Buffer.concat([n, t, data, check]);
}
await mkdir("public", { recursive: true });
for (const size of [16, 48, 128]) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size;
      const a =
        (v > 0.2 &&
          v < 0.79 &&
          Math.abs(Math.abs(u - 0.5) - (v - 0.2) * 0.39) < 0.07) ||
        (v > 0.56 && v < 0.65 && u > 0.31 && u < 0.69);
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw.set(a ? [255, 255, 255, 255] : [23, 112, 79, 255], i);
    }
  const h = Buffer.alloc(13);
  h.writeUInt32BE(size);
  h.writeUInt32BE(size, 4);
  h[8] = 8;
  h[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", h),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  await writeFile(`dist/icon${size}.png`, png);
  await writeFile(`public/icon${size}.png`, png);
}
