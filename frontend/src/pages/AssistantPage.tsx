import { useEffect, useRef, useState } from "react";
import { Bot, Send, User, Wrench, AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { agentApi, type AgentToolCall, type AgentPendingAction } from "../lib/api";
import MarkdownLite from "../components/MarkdownLite";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: AgentToolCall[];
}

const SUGGESTIONS = [
  "Show today's sales",
  "What's my cash flow?",
  "List low stock products",
  "Any pending follow-ups?",
  "Give me a dashboard summary",
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pending, setPending] = useState<AgentPendingAction | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, pending]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy) return;
    setError(null);
    setPending(null);
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setInput("");
    setBusy(true);
    try {
      const res = await agentApi.chat({ message: msg, conversation_id: conversationId });
      setConversationId(res.conversation_id);
      if (res.status === "needs_confirmation" && res.pending_action) {
        if (res.reply) setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
        setPending(res.pending_action);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: res.reply, toolCalls: res.tool_calls }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(action: AgentPendingAction) {
    setPending(null);
    setBusy(true);
    setError(null);
    try {
      const res = await agentApi.chat({
        conversation_id: conversationId,
        confirm_action: { tool: action.tool, args: action.args },
      });
      setConversationId(res.conversation_id);
      setMessages((m) => [...m, { role: "assistant", content: res.reply, toolCalls: res.tool_calls }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ws-scene p-4 sm:p-5 flex flex-col h-[calc(100vh-6rem)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-line">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-white">
          <Sparkles size={18} />
        </div>
        <div>
          <h1 className="text-lg font-extrabold font-display bg-gradient-to-r from-ink to-info bg-clip-text text-transparent">ATS Assistant</h1>
          <p className="text-xs text-muted">Ask about sales, inventory, customers, cash flow and more.</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-10">
            <Bot size={40} className="mx-auto text-muted/50 mb-3" />
            <p className="text-muted text-sm mb-4">Try one of these:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="px-3 py-1.5 rounded-full border border-line text-sm text-ink hover:bg-accent-soft hover:text-accent hover:border-accent transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              m.role === "user" ? "bg-white/10 text-ink" : "bg-accent text-white shadow-glow-violet"}`}>
              {m.role === "user" ? <User size={15} /> : <Bot size={15} />}
            </div>
            <div className={`max-w-[80%] ${m.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1.5`}>
              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-accent text-white rounded-tr-sm whitespace-pre-wrap"
                  : "glass text-ink rounded-tl-sm"}`}>
                {m.role === "user" ? m.content : <MarkdownLite text={m.content} />}
              </div>
              {m.toolCalls && m.toolCalls.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {m.toolCalls.map((tc, j) => (
                    <span key={j}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                        tc.status === "ok"
                          ? "bg-accent-soft text-accent"
                          : "bg-red-50 text-danger"}`}>
                      <Wrench size={10} /> {tc.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center flex-shrink-0">
              <Bot size={15} />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm ws-card">
              <Loader2 size={16} className="animate-spin text-muted" />
            </div>
          </div>
        )}

        {/* Confirmation card for destructive actions */}
        {pending && (
          <div className="ml-11 border border-amber-300 bg-amber-50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm mb-1">
              <AlertTriangle size={16} /> Confirm this action
            </div>
            <p className="text-sm text-ink mb-1">{pending.description}</p>
            <code className="block text-xs text-muted bg-white/60 rounded px-2 py-1 mb-3 break-all">
              {pending.summary}
            </code>
            <div className="flex gap-2">
              <button
                onClick={() => confirm(pending)}
                className="px-3 py-1.5 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90">
                Confirm & run
              </button>
              <button
                onClick={() => setPending(null)}
                className="px-3 py-1.5 rounded-lg border border-line text-sm text-muted hover:bg-line/50">
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="ml-11 text-sm text-danger bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex items-center gap-2 pt-3 border-t border-line">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          placeholder="Ask the assistant…"
          className="flex-1 px-4 py-2.5 rounded-xl border border-line bg-surface text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="w-11 h-11 rounded-xl bg-accent text-white flex items-center justify-center hover:opacity-90 disabled:opacity-40">
          <Send size={17} />
        </button>
      </form>
    </div>
  );
}
