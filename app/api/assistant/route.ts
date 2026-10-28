import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { auth } from "@/auth";

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Work in progress: developers only until the assistant is ready for everyone.
  if (session.user.role !== "developer") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { messages, path }: { messages: UIMessage[]; path?: string } =
    await req.json();

  const result = streamText({
    model: openai("gpt-6-luna"),
    instructions: [
      "You are Pip, the assistant inside the Laser Power tender executive dashboard.",
      "The dashboard tracks government tenders (GeM, railways) through pre-participation, participation, EMD, post-participation, supply history and performance certificates.",
      `You are talking to ${session.user.name ?? session.user.email} (role: ${session.user.role}).`,
      `They are on the page ${path ?? "unknown"}.`,
      "Answer briefly and plainly. Use markdown only when a list or table helps.",
      "You cannot read or change dashboard data yet. If asked to, say so in one sentence and offer what you can do instead.",
    ].join("\n"),
    messages: await convertToModelMessages(messages),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
