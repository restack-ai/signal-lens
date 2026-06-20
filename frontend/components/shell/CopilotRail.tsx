"use client";

import { useEffect, useRef, useState } from "react";
import { CornerDownLeft, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

export type CopilotEvidence = { id: number; source: string; title: string };

type Message = {
  role: "user" | "assistant";
  text: string;
  evidence?: CopilotEvidence[];
  streaming?: boolean;
};

export function CopilotRail({
  contextLabel,
  answer,
  evidence,
  suggestions,
  onCite,
}: {
  /** "Global" or an asset ticker — what the copilot is scoped to. */
  contextLabel: string;
  /** Grounding text streamed as the answer (Phase 1 uses the derived summary). */
  answer: string;
  evidence: CopilotEvidence[];
  suggestions: string[];
  onCite?: (id: number) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const [shown, setShown] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Simulated token streaming. All state updates happen inside the timeout
  // callback (never synchronously in the effect body); when the last chunk
  // lands it flips streaming off and attaches the evidence citations.
  useEffect(() => {
    if (target === null || shown >= target.length) return;
    const t = setTimeout(() => {
      const next = Math.min(target.length, shown + 3);
      const done = next >= target.length;
      setShown(next);
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1
            ? {
                ...m,
                text: target.slice(0, next),
                streaming: !done,
                evidence: done ? evidence : m.evidence,
              }
            : m,
        ),
      );
    }, 12);
    return () => clearTimeout(t);
  }, [target, shown, evidence]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function ask(question: string) {
    const q = question.trim();
    if (!q) return;
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", text: q },
      { role: "assistant", text: "", streaming: true },
    ]);
    setTarget(answer);
    setShown(0);
  }

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l border-border-strong bg-panel">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <span className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Ask the Lens
        </span>
        <span className="rounded-sm border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {contextLabel}
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-xs leading-5 text-muted-foreground">
              Grounded answers over the current risk evidence, scoped to{" "}
              <span className="font-mono text-foreground">{contextLabel}</span>. Every claim
              cites a source event.
            </p>
            <div className="space-y-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="flex w-full items-center gap-2 rounded-sm border border-border bg-card px-2.5 py-2 text-left text-xs text-foreground/80 transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <Sparkles className="h-3 w-3 shrink-0 text-primary" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "rounded-md px-3 py-2 text-sm leading-6",
                m.role === "user"
                  ? "ml-6 bg-primary/10 text-foreground"
                  : "bg-card text-foreground/90",
              )}
            >
              {m.role === "assistant" && (
                <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
                  Lens
                </div>
              )}
              <p>
                {m.text}
                {m.streaming && <span className="caret-blink">▋</span>}
              </p>
              {m.evidence && m.evidence.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-border pt-2">
                  {m.evidence.map((e, n) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => onCite?.(e.id)}
                      className="flex w-full items-start gap-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
                    >
                      <span className="mt-px font-mono text-[10px] text-primary">[{n + 1}]</span>
                      <span className="truncate">
                        <span className="font-mono uppercase">{e.source}</span> · {e.title}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <form
        className="border-t border-border p-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <div className="flex items-center gap-2 rounded-sm border border-border bg-card px-2.5 focus-within:border-primary/50">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask about ${contextLabel}…`}
            className="h-9 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Send"
            className="text-muted-foreground hover:text-primary disabled:opacity-40"
            disabled={!input.trim()}
          >
            <CornerDownLeft className="h-4 w-4" />
          </button>
        </div>
      </form>
    </aside>
  );
}
