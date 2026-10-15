"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";

// --- TYPES ---
type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
};

type BotStatus = "idle" | "waiting" | "analyzing" | "typing";

// Separate key so v2 history never mixes with the original page
const STORAGE_KEY = "lia_chat_history_v2";

const SUGGESTIONS = [
  "Paano mag-apply?",
  "Ano ang requirements?",
  "Magkano ang sahod?",
  "Kailan ang payout?",
  "Paano mag-install ng software?",
  "Ilang oras ang work hours?",
];

const newId = () => Math.random().toString(36).substring(7);
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
const nowMs = () => Date.now();
const randomBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function HomeV2() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [botStatus, setBotStatus] = useState<BotStatus>("idle");
  const [lastMessageSeen, setLastMessageSeen] = useState(false);
  const [lastReplyAt, setLastReplyAt] = useState<number>(0);
  const [isHydrated, setIsHydrated] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // HYDRATE FROM CACHE ON MOUNT
  useEffect(() => {
    if (isHydrated) return;
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setMessages(parsed.map((m: Msg) => ({ ...m, timestamp: new Date(m.timestamp) })));
      }
    } catch (e) {
      console.error("Failed to load history:", e);
    }
    setIsHydrated(true);
  }, [isHydrated]);

  // SAVE TO CACHE ON CHANGE
  useEffect(() => {
    if (!isHydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages, isHydrated]);

  // auto scroll to bottom when new messages appear
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, botStatus]);

  // auto-grow textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [input]);

  async function sendMessage(text?: string) {
    const userText = (text ?? input).trim();
    if (!userText || botStatus !== "idle") return;

    setInput("");
    setMessages(prev => [...prev, { id: newId(), role: "user", text: userText, timestamp: new Date() }]);
    setLastMessageSeen(false);

    // Same human-like timing as the original page
    const now = nowMs();
    const timeSinceLastLiaMsg = now - lastReplyAt;
    const isLiveConversation = lastReplyAt !== 0 && timeSinceLastLiaMsg < 120000; // 2 minute "live" window

    const baseWaitMin = isLiveConversation ? 3000 : 10000;
    const baseWaitMax = isLiveConversation ? 7000 : 30000;
    const analyzeTime = isLiveConversation ? 1500 : 4000;

    // PHASE 1: BEFORE SEEN (Delivered status)
    setBotStatus("waiting");
    const waitTime = randomBetween(baseWaitMin, baseWaitMax);
    await sleep(waitTime);

    // PHASE 2: SEEN NOTICE & ANALYZE
    setLastMessageSeen(true);
    setBotStatus("analyzing");

    const apiPromise = fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Recent turns so Lia remembers what she just said and can read the room
      body: JSON.stringify({ message: userText, history: messages.slice(-8).map(m => ({ role: m.role, text: m.text })) }),
    });

    await sleep(analyzeTime);
    setBotStatus("typing");

    try {
      const res = await apiPromise;

      if (!res.ok) {
        const txt = await res.text();
        setMessages(prev => [
          ...prev,
          { id: newId(), role: "assistant", text: `Sorry po, may problema sa connection.\n${txt}`, timestamp: new Date() },
        ]);
        setBotStatus("idle");
        return;
      }

      const data = await res.json();
      const reply = data.reply ?? "Sorry po, hindi ko na-process yung sagot.";

      const typingTime = Math.min(reply.length * 15, 2000);
      await sleep(typingTime);

      setMessages(prev => [...prev, { id: newId(), role: "assistant", text: reply, timestamp: new Date() }]);
      setLastReplyAt(nowMs());
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setMessages(prev => [
        ...prev,
        { id: newId(), role: "assistant", text: "Connection error: " + errorMessage, timestamp: new Date() },
      ]);
    }

    setBotStatus("idle");
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearChat() {
    if (botStatus !== "idle") return;
    setMessages([]);
    setLastMessageSeen(false);
    setLastReplyAt(0);
  }

  const canSend = botStatus === "idle" && input.trim().length > 0;

  return (
    <div className="h-[100dvh] flex flex-col bg-[#0b1020] text-slate-100 relative overflow-hidden">
      {/* AMBIENT BACKGROUND */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full bg-indigo-600/25 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[480px] h-[480px] rounded-full bg-cyan-500/15 blur-[120px]" />
        <div className="absolute -bottom-40 left-1/4 w-[420px] h-[420px] rounded-full bg-fuchsia-600/10 blur-[120px]" />
      </div>

      {/* HEADER */}
      <header className="relative z-20 border-b border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="relative w-11 h-11 rounded-2xl overflow-hidden ring-1 ring-white/15">
                <Image src="/icon/via.png" alt="Lia" fill className="object-cover" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-[#0b1020]" />
            </div>
            <div className="leading-tight">
              <h1 className="text-[15px] text-white">Lia Satella</h1>
              <p className="text-xs text-slate-400">
                {botStatus === "typing" ? "typing…" : botStatus === "analyzing" ? "reading your message…" : "Xfinite Team Manager · Online"}
              </p>
            </div>
          </div>

          {messages.length > 0 && (
            <button
              onClick={clearChat}
              disabled={botStatus !== "idle"}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-full border border-white/10 hover:border-white/25 transition disabled:opacity-40"
            >
              New chat
            </button>
          )}
        </div>
      </header>

      {/* CHAT AREA */}
      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center text-center pt-10 sm:pt-16">
              <div className="relative w-20 h-20 mb-5 rounded-3xl overflow-hidden ring-1 ring-white/15 shadow-[0_10px_40px_-10px_rgba(99,102,241,0.6)]">
                <Image src="/icon/via.png" alt="Lia" fill className="object-cover" />
              </div>
              <h2 className="text-2xl text-white mb-2">Hi po! Ako si Lia 👋</h2>
              <p className="text-sm text-slate-400 max-w-sm mb-8">
                I&apos;m here to help you with your Xfinite journey po. Pili lang kayo ng tanong sa baba or type your own.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-left text-sm text-slate-200 px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-indigo-400/40 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            {messages.map((m, i) => {
              const isUser = m.role === "user";
              const isLastUserMsg = isUser && i === messages.length - 1;
              const isFirstInGroup = i === 0 || messages[i - 1].role !== m.role;
              const isLastInGroup = i === messages.length - 1 || messages[i + 1].role !== m.role;
              const showDate = i === 0 || m.timestamp.toDateString() !== messages[i - 1].timestamp.toDateString();

              return (
                <div key={m.id}>
                  {showDate && (
                    <div className="flex items-center gap-3 my-6">
                      <div className="flex-1 h-px bg-white/10" />
                      <span className="text-[11px] text-slate-500">
                        {m.timestamp.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                      </span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>
                  )}

                  <div className={`flex items-end gap-2.5 ${isUser ? "justify-end" : "justify-start"} ${isFirstInGroup ? "mt-4" : "mt-1"}`}>
                    {!isUser && (
                      <div className="w-8 flex-shrink-0">
                        {isLastInGroup && (
                          <div className="w-8 h-8 rounded-xl overflow-hidden ring-1 ring-white/15">
                            <Image src="/icon/via.png" alt="Lia" width={32} height={32} className="object-cover" />
                          </div>
                        )}
                      </div>
                    )}

                    <div className={`flex flex-col max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
                      <div
                        className={`px-4 py-2.5 text-[14.5px] leading-relaxed whitespace-pre-wrap break-words ${
                          isUser
                            ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-2xl rounded-br-md shadow-[0_6px_20px_-8px_rgba(99,102,241,0.7)]"
                            : "bg-white/[0.06] border border-white/10 text-slate-100 rounded-2xl rounded-bl-md backdrop-blur"
                        }`}
                      >
                        {isUser ? (
                          m.text
                        ) : (
                          <div className="[&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-1 [&_a]:text-cyan-300 [&_a]:underline whitespace-normal">
                            <ReactMarkdown>{m.text}</ReactMarkdown>
                          </div>
                        )}
                      </div>

                      {isLastInGroup && (
                        <span className="text-[10px] text-slate-500 mt-1 px-1">{formatTime(m.timestamp)}</span>
                      )}

                      {isLastUserMsg && (
                        <span className="text-[10px] text-slate-500 px-1 -mt-0.5">
                          {lastMessageSeen ? `Seen ${formatTime(new Date())}` : "Delivered"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {botStatus === "typing" && (
              <div className="flex items-end gap-2.5 mt-4">
                <div className="w-8 h-8 rounded-xl overflow-hidden ring-1 ring-white/15 flex-shrink-0">
                  <Image src="/icon/via.png" alt="Lia" width={32} height={32} className="object-cover" />
                </div>
                <div className="bg-white/[0.06] border border-white/10 rounded-2xl rounded-bl-md px-4 py-3.5 flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 bg-slate-300/70 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-slate-300/70 rounded-full animate-bounce [animation-delay:0.15s]" />
                  <span className="w-1.5 h-1.5 bg-slate-300/70 rounded-full animate-bounce [animation-delay:0.3s]" />
                </div>
              </div>
            )}
          </div>

          <div ref={bottomRef} className="h-6" />
        </div>
      </main>

      {/* INPUT AREA */}
      <footer className="relative z-20 px-4 sm:px-6 pb-4 pt-2">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 rounded-3xl bg-white/[0.06] border border-white/10 backdrop-blur-xl p-2 pl-4 focus-within:border-indigo-400/50 transition">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Magtanong kay Lia…"
              className="flex-1 resize-none bg-transparent outline-none text-[15px] text-white placeholder:text-slate-500 py-2 max-h-[140px]"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!canSend}
              aria-label="Send"
              className={`w-10 h-10 flex-shrink-0 rounded-2xl flex items-center justify-center transition ${
                canSend
                  ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white hover:brightness-110 active:scale-95"
                  : "bg-white/5 text-slate-500"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-slate-500 text-center mt-2">
            Enter to send · Shift + Enter for new line
          </p>
        </div>
      </footer>
    </div>
  );
}
