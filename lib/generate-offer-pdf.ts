import fs from "fs";
import Handlebars from "handlebars";
import puppeteer, { PDFOptions } from "puppeteer-core";
import { CertificateTemplateData } from "@/app/types/certificate";

/**
 * Register Handlebars helpers used by the certificate template.
 * Safe to call multiple times; Handlebars just overwrites the helper.
 */
function registerHelpers(): void {
  // {{inc @index}} -> 1-based row number for the Sl No column
  Handlebars.registerHelper("inc", (index: number) => index + 1);

  // {{formatFY fy}} -> "25-26" becomes "25 to 26"
  Handlebars.registerHelper("formatFY", (fy: string) => {
    const [from, to] = (fy || "").split("-");
    return to ? `${from} to ${to}` : from;
  });
}

/**
 * Common install locations for a system Chrome/Chromium. puppeteer-core ships
 * no browser, so one of these (or CHROME_PATH) must exist.
 */
const CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Chromium\\Application\\chrome.exe",
  // Debian chromium package installed by the Dockerfile.
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
];

/**
 * Resolves which Chrome/Chromium executable to launch.
 * Priority: explicit override -> CHROME_PATH env -> first existing known
 * Chrome install. Throws when none is found.
 */
function resolveChromePath(executablePathOverride?: string): string {
  if (executablePathOverride) return executablePathOverride;

  const envPath = process.env.CHROME_PATH;
  if (envPath && fs.existsSync(
    /* turbopackIgnore: true */
    envPath,
  )) return envPath;

  for (const candidate of CHROME_PATHS) {
    if (fs.existsSync(
      /* turbopackIgnore: true */
      candidate,
    )) return candidate;
  }
  throw new Error("No Chrome/Chromium executable found. Set CHROME_PATH.");
}

export interface GeneratePdfOptions {
  /** Output path to write the PDF to, e.g. "./out/certificate-PO-0451.pdf" */
  outputPath: string;

  /** Optional overrides passed straight through to Puppeteer's page.pdf(). */
  pdfOptions?: PDFOptions;

  /**
   * Optional explicit path to a Chromium/Chrome executable. Takes priority
   * over everything else. If omitted, falls back to CHROME_PATH, then to a
   * system Chrome install at the usual Windows/Linux locations.
   */
  executablePath?: string;
}

/**
 * Compiles the certificate Handlebars template string with the given data,
 * renders it in a headless browser, and writes the result out as a PDF file.
 *
 * @param templateSource Raw Handlebars template string (e.g. contents of
 *                        certificate_of_satisfactory_performance.hbs)
 * @param data           Data to interpolate into the template
 * @param options        Output path + optional Puppeteer PDF settings
 * @returns              The PDF as a Buffer (also written to options.outputPath)
 */
export async function generateCertificatePdf(
  templateSource: string,
  data: CertificateTemplateData,
  options: GeneratePdfOptions
): Promise<Buffer> {
  registerHelpers();

  // 1. Compile the Handlebars template with the dynamic data into a final HTML string.
  const template = Handlebars.compile<CertificateTemplateData>(templateSource);
  const html = template(data);

  // 2. Launch a headless browser and render that HTML.
  const chromePath = resolveChromePath(options.executablePath);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // Note: page.setContent()'s WaitForOptions only supports "load" and
    // "domcontentloaded" (unlike page.goto(), it has no "networkidle0"/
    // "networkidle2"), since there's no network request to go idle on for
    // inline HTML. "load" waits for the load event, which covers inline
    // <style> and any same-origin images/fonts referenced in the markup.
    await page.setContent(html, { waitUntil: "load" });

    // Belt-and-suspenders: explicitly wait for web fonts to finish loading
    // before printing, since the "load" event doesn't guarantee font
    // rendering is complete.
    await page.evaluateHandle("document.fonts.ready");

    // 3. Print the page to a PDF buffer.
    const defaultPdfOptions: PDFOptions = {
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    };

    const pdfBuffer = await page.pdf({
      ...defaultPdfOptions,
      ...options.pdfOptions,
      path: options.outputPath,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Example usage:
 *
 *   import fs from "fs";
 *   import { generateCertificatePdf } from "./generate-certificate-pdf";
 *   import { CertificateTemplateData } from "./certificate.types";
 *
 *   const templateSource = fs.readFileSync(
 *     "certificate_of_satisfactory_performance.hbs",
 *     "utf-8"
 *   );
 *
 *   const data: CertificateTemplateData = {
 *     partyRefNo: "PO/2026/0451",
 *     partyRefDate: "12-Feb-2026",
 *     partyName: "Mecgale Pneumatics Pvt Ltd.",
 *     fy: "25-26",
 *     invoiceAmt: "12,45,000",
 *     items: [
 *       {
 *         itemName: "GATE VALVE",
 *         invoiceQty: 6,
 *         saleBillDate: "18-Mar-2026",
 *       },
 *     ],
 *   };
 *
 *   generateCertificatePdf(templateSource, data, {
 *     outputPath: "./out/certificate-PO-0451.pdf",
 *   }).then(() => console.log("PDF generated"));
 */