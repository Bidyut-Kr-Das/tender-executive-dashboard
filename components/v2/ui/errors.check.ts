// Run: npx tsx components/v2/ui/errors.check.ts
import assert from "node:assert/strict";
import { describeError } from "./errors";

(async () => {
  const stale = /out of date/;
  assert.match(
    await describeError(new Error('Server Action "40ab" was not found on the server. Read more: https://nextjs.org')),
    stale,
  );
  assert.match(await describeError(new Error("Failed to find Server Action")), stale);
  assert.match(await describeError(new Error("Unauthorized: Please sign in")), /signed out/);
  // A rejected thunk: a bare string, or a serialised error object.
  assert.match(await describeError("Unauthorized"), /signed out/);
  assert.match(await describeError({ message: "Failed to fetch" }), /reach the server/);
  // A message the server wrote for the user is shown as it is.
  assert.equal(await describeError(new Error("Docket number already in use")), "Docket number already in use");
  console.log("errors: ok");
})();
