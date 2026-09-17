import { PDFDocument, StandardFonts } from "pdf-lib";
import archiver from "archiver";
export const resumeLines = [
  "Ada Lovelace",
  "ada@example.com",
  "(415) 555-0100",
  "Experience",
  "Engineer | Acme",
  "Education",
  "Example University",
  "Bachelor of Science",
  "Skills",
  "TypeScript, SQL",
];
export async function resumePdf(blank = false) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage();
  if (!blank) {
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    resumeLines.forEach((text, i) =>
      page.drawText(text, { x: 50, y: 740 - i * 24, size: 12, font }),
    );
  }
  return Buffer.from(await pdf.save());
}
export async function resumeDocx() {
  const archive = archiver("zip");
  const chunks: Buffer[] = [];
  archive.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
  });
  archive.append(
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    { name: "[Content_Types].xml" },
  );
  archive.append(
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    { name: "_rels/.rels" },
  );
  archive.append(
    `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${resumeLines.map((line) => `<w:p><w:r><w:t>${line}</w:t></w:r></w:p>`).join("")}</w:body></w:document>`,
    { name: "word/document.xml" },
  );
  await archive.finalize();
  return done;
}
