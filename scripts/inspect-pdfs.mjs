import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

for (const filename of process.argv.slice(2)) {
  const data = new Uint8Array(await readFile(filename));
  const document = await getDocument({ data, useSystemFonts: true }).promise;
  console.log(`\n${filename}: ${document.numPages} pages`);
  for (let pageNumber = 1; pageNumber <= Math.min(document.numPages, 35); pageNumber++) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    console.log(`PAGE ${pageNumber}: ${text.slice(0, 1100)}`);
    page.cleanup();
  }
  await document.destroy();
}
