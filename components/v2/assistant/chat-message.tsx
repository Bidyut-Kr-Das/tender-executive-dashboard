import type { UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** One turn: the user's words in a tinted bubble, Pip's as markdown prose. */
export function ChatMessage({ message }: { message: UIMessage }) {
  const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  return message.role === "user" ? (
    <li className="max-w-[85%] self-end whitespace-pre-wrap rounded-xl bg-lavender-soft px-3 py-2">{text}</li>
  ) : (
    <li className="md min-w-0 *:last:mb-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </li>
  );
}
