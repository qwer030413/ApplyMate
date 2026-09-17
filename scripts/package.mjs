import archiver from "archiver";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
await mkdir("release", { recursive: true });
const output = createWriteStream("release/ApplyMate-0.1.0.zip");
const archive = archiver("zip", { zlib: { level: 9 } });
const done = new Promise((resolve, reject) => {
  output.on("close", resolve);
  output.on("error", reject);
  archive.on("error", reject);
});
archive.pipe(output);
archive.directory("dist", false);
await archive.finalize();
await done;
console.log("Created release/ApplyMate-0.1.0.zip");
