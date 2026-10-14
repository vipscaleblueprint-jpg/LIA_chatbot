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
  category?: string;
  intent?: string;
  icon?: string;
  model?: string;
};

const SUGGESTIONS = [
  { text: "Bakit po download failed ang auto-update sa Ginger?", label: "🛠️ Ginger Update" },
  { text: "Kailan po ang next cut-off at release ng sahod?", label: "💰 Sahod & Cut-off" },
  { text: "Pwede po ba ipagpatuloy bukas ang training kung gabi na?", label: "🎓 Pwede Bukas?" },
  { text: "Saan ko po makikita ang aking Labeler ID?", label: "🔑 Labeler ID" },
  { text: "Puwede ko ba i-download ang Ginger sa cellphone ko?", label: "📱 CP Ginger" },
  { text: "Kailan po magkakaroon ng Checker para sa training task?", label: "📋 Checker Schedule" },
];

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [botStatus, setBotStatus] = useState<"idle" | "waiting" | "seen" | "analyzing" | "typing">("idle");
  const [lastMessageSeen, setLastMessageSeen] = useState(false);
  const [lastReplyAt, setLastReplyAt] = useState<number>(0);
  const [isHydrated, setIsHydrated] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  // HYDRATE FROM CACHE ON MOUNT
  useEffect(() => {
    if (typeof window !== "undefined" && !isHydrated) {
      const saved = sessionStorage.getItem("lia_chat_history");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const hydrated = parsed.map((m: Msg) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }));
          setMessages(hydrated);
        } catch (e) {
          console.error("Failed to load history:", e);
        }
      }
      setIsHydrated(true);
    }
  }, [isHydrated]);

  // SAVE TO CACHE ON CHANGE
  useEffect(() => {
    if (isHydrated && messages.length > 0) {
      sessionStorage.setItem("lia_chat_history", JSON.stringify(messages));
    }
  }, [messages, isHydrated]);

  // Auto scroll to bottom when new messages appear
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, botStatus]);

  const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  async function triggerSendMessage(textToSend: string) {
    if (!textToSend.trim() || botStatus !== "idle") return;

    const userText = textToSend;
    const userMsgId = Math.random().toString(36).substring(7);
    setInput("");

    const newUserMsg: Msg = { 
      id: userMsgId,
      role: "user", 
      text: userText, 
      timestamp: new Date() 
    };

    setMessages(prev => [...prev, newUserMsg]);
    setLastMessageSeen(false);

    // Natural responsive pacing
    setBotStatus("waiting");
    await sleep(600);

    setLastMessageSeen(true);
    setBotStatus("analyzing");

    const apiPromise = fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText }),
    });

    await sleep(800);
    setBotStatus("typing");

    try {
      const res = await apiPromise;

      if (!res.ok) {
        const txt = await res.text();
        setMessages(prev => [
          ...prev,
          { 
            id: Math.random().toString(36).substring(7),
            role: "assistant", 
            text: `❌ ERROR: Brain link severed.\n${txt}`,
            timestamp: new Date()
          },
        ]);
        setBotStatus("idle");
        return;
      }

      const data = await res.json();
      const reply = data.reply ?? `❌ ERROR: Memory corruption.`;
      const category = data.category;
      const intent = data.intent;
      const icon = data.icon;
      const model = data.model;

      await sleep(500);

      setMessages(prev => [...prev, { 
        id: Math.random().toString(36).substring(7),
        role: "assistant", 
        text: reply,
        timestamp: new Date(),
        category,
        intent,
        icon,
        model
      }]);
      setLastReplyAt(Date.now());

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setMessages(prev => [
        ...prev,
        { 
          id: Math.random().toString(36).substring(7),
          role: "assistant", 
          text: "❌ Connection error: " + errorMessage,
          timestamp: new Date()
        },
      ]);
    }

    setBotStatus("idle");
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      triggerSendMessage(input);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#111111] text-[#e0e0e0] font-sans antialiased select-none">
      
      {/* TOP BAR / HEADER */}
      <div className="h-16 border-b border-white/5 bg-[#141414] px-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-full overflow-hidden border border-white/10 shadow-sm">
            <Image 
              src="/icon/via.png" 
              fill
              className="object-cover"
              alt="Lia Avatar"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white tracking-wide text-sm">Lia Satella</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            </div>
            <div className="text-[11px] text-white/50 flex items-center gap-1">
              <span>Community Moderator</span>
              <span>&bull;</span>
              <span className="text-emerald-400/80 font-medium">Online &bull; Ollama (llama3.1:8b)</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            sessionStorage.removeItem("lia_chat_history");
            setMessages([]);
          }}
          className="text-xs text-white/40 hover:text-white/80 transition-colors bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 hover:border-white/10"
        >
          Clear Chat
        </button>
      </div>

      {/* MESSAGES SCROLL AREA */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto flex flex-col justify-end min-h-full">

          {messages.length === 0 && (
            <div className="text-center pt-8 pb-4 flex flex-col items-center">
              <div className="relative w-20 h-20 mb-4 rounded-full overflow-hidden border-2 border-white/10 shadow-2xl">
                <Image 
                  src="/icon/via.png" 
                  fill
                  className="object-cover"
                  alt="Lia Satella"
                />
              </div>
              <h2 className="text-xl font-semibold mb-1 text-white">Lia Satella</h2>
              <p className="text-xs text-white/40 mb-6 uppercase tracking-widest">Xfinite AI Support & Community Moderator</p>
              <div className="bg-white/5 rounded-2xl p-5 border border-white/10 max-w-sm mb-6">
                <p className="text-xs text-white/70 leading-relaxed italic">
                  &quot;Hello po! Handa po akong sumagot sa mga tanong ninyo tungkol sa Ginger app, training, payouts, at accounts. Pumili ng topic sa ibaba o mag-type ng inyong tanong!&quot;
                </p>
              </div>

              {/* QUICK CHIPS */}
              <div className="flex flex-wrap justify-center gap-2 max-w-md">
                {SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => triggerSendMessage(s.text)}
                    className="text-xs bg-white/5 hover:bg-white/10 text-white/80 hover:text-white px-3 py-1.5 rounded-full border border-white/10 transition-all hover:scale-105 active:scale-95"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-6">
            {messages.map((m, i) => {
              const isLastUserMsg = m.role === "user" && i === messages.length - 1;
              const isLastInGroup = i === messages.length - 1 || messages[i + 1].role !== m.role;

              return (
                <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                  
                  {/* DATE SEPARATOR */}
                  {(i === 0 || m.timestamp.getDate() !== messages[i-1].timestamp.getDate()) && (
                    <div className="w-full text-center my-4">
                      <span className="text-[10px] text-white/30 uppercase tracking-[0.2em]">
                        {m.timestamp.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  )}

                  <div className={`flex items-end gap-2 max-w-[85%] ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    
                    {/* AVATAR FOR ASSISTANT */}
                    {m.role === "assistant" && (
                      <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 border border-white/10 mb-1">
                        <Image src="/icon/via.png" alt="Lia" width={28} height={28} className="object-cover" />
                      </div>
                    )}

                    <div className="flex flex-col">
                      {/* CATEGORY & INTENT BADGE (Only for Assistant replies) */}
                      {m.role === "assistant" && m.category && (
                        <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full w-fit">
                          <span>{m.icon || "📌"}</span>
                          <span>{m.category}</span>
                          {m.intent && <span className="text-white/40 font-normal">&bull; {m.intent}</span>}
                          {m.model && <span className="text-[9px] text-white/30 ml-1">({m.model})</span>}
                        </div>
                      )}

                      <div
                        className={`px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed shadow-sm
                        ${
                          m.role === "user"
                            ? "bg-neon text-black rounded-tr-sm font-medium"
                            : "bg-[#242424] text-white/90 rounded-tl-sm border border-white/5"
                        }`}
                      >
                        {m.role === "assistant" ? (
                          <div className="prose prose-invert prose-sm">
                            <ReactMarkdown>{m.text}</ReactMarkdown>
                          </div>
                        ) : (
                          m.text
                        )}
                      </div>
                      
                      {/* TIMESTAMP */}
                      {isLastInGroup && (
                        <span className={`text-[9px] text-white/30 mt-1 ${m.role === "user" ? "text-right" : "text-left ml-1"}`}>
                          {formatTime(m.timestamp)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* STATUS INDICATORS */}
                  {isLastUserMsg && (
                    <div className="mt-1 mr-1 flex flex-col items-end">
                      {lastMessageSeen ? (
                        <div className="flex flex-col items-end gap-1">
                          <div className="w-3.5 h-3.5 rounded-full overflow-hidden border border-white/20 shadow-sm opacity-80">
                            <Image src="/icon/via.png" alt="Seen" width={14} height={14} className="object-cover" />
                          </div>
                          <span className="text-[9px] text-white/30 font-normal">Seen {formatTime(new Date())}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-white/40 font-normal tracking-tight">Delivered</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {botStatus === "typing" && (
              <div className="flex items-end gap-2">
                <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 border border-white/10 mb-1">
                  <Image src="/icon/via.png" alt="Lia" width={28} height={28} className="object-cover" />
                </div>
                <div className="bg-[#242424] rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center border border-white/5">
                  <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
          </div>

          <div ref={bottomRef} className="h-6" />
        </div>
      </div>

      {/* QUICK CHIP SUGGESTIONS BAR (When chat has messages) */}
      {messages.length > 0 && (
        <div className="bg-[#141414] border-t border-white/5 px-4 py-2 overflow-x-auto">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            <span className="text-[10px] text-white/30 uppercase tracking-wider shrink-0">Topics:</span>
            {SUGGESTIONS.slice(0, 4).map((s, idx) => (
              <button
                key={idx}
                onClick={() => triggerSendMessage(s.text)}
                disabled={botStatus !== "idle"}
                className="text-[11px] bg-white/5 hover:bg-white/10 text-white/70 hover:text-white px-2.5 py-1 rounded-full border border-white/5 whitespace-nowrap transition-colors"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* INPUT AREA */}
      <div className="p-4 bg-[#141414] border-t border-white/5">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          
          <div className="flex-1 relative flex items-center">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Magtanong kay Lia (hal. Paano mag-update sa Ginger?)..."
              disabled={botStatus !== "idle"}
              className="w-full bg-[#242424] text-white rounded-full py-2.5 px-6 outline-none border border-white/5 focus:border-white/20 text-[14px] placeholder:text-white/30"
            />
          </div>

          <button
            onClick={() => triggerSendMessage(input)}
            disabled={botStatus !== "idle" || !input.trim()}
            className={`transition-all duration-200 p-2 rounded-full ${
              botStatus !== "idle" || !input.trim() 
                ? "opacity-20 text-white/30" 
                : "text-neon hover:scale-110 active:scale-95"
            }`}
          >
            <svg 
              className="w-6 h-6 transform rotate-12" 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>

    </div>
  );
}
