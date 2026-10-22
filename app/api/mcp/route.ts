import { NextRequest } from "next/server";
import { requireApiKey } from "@/lib/dal";
import { withLog } from "@/lib/activity-logger";
import { mcpHandler } from "@/lib/mcp/server";

export const runtime = "nodejs";

async function handle(req: NextRequest) {
  return (await requireApiKey(req)) ?? mcpHandler.fetch(req);
}

// Tools only read: nothing is logged.
const handleWithLog = withLog(handle, () => null);

export const GET = handleWithLog;
export const POST = handleWithLog;
export const DELETE = handleWithLog;
