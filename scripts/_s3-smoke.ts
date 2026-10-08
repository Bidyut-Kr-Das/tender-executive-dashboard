import "dotenv/config";
import { uploadBuffer, deleteObject, buildPublicUrl } from "../lib/s3";

async function main() {
  const body = `opencode s3 smoke test ${new Date().toISOString()}\n`;
  const { key, publicUrl } = await uploadBuffer(Buffer.from(body), {
    fileName: "smoke-test.txt",
    folder: "smoke-tests",
  });
  console.log("[smoke] uploaded key:", key);
  console.log("[smoke] publicUrl:", publicUrl);

  const res = await fetch(publicUrl, { cache: "no-store" });
  const text = await res.text();
  console.log("[smoke] GET status:", res.status, res.headers.get("content-type"));
  console.log("[smoke] body matches:", text === body);

  await deleteObject(key);
  console.log("[smoke] deleted:", buildPublicUrl(key));
}

main().catch((err) => {
  console.error("[smoke] FAILED:", err);
  process.exit(1);
});
