import { NextResponse } from "next/server";
import { retrieveContext } from "@/lib/rag";
import { askLLM } from "@/lib/llm";
import { getTopic, setTopic } from "@/lib/chatMemory";
import { classifyQuestion } from "@/lib/classifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Invalid message" }, { status: 400 });
    }

    const sessionId =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "local";

    /* 1. CLASSIFY QUESTION CATEGORY & INTENT */
    const classification = classifyQuestion(message);

    /* 2. LOAD MEMORY & QUERY ENHANCEMENT */
    const lastTopic = getTopic(sessionId);
    const enhancedQuery = `${message} ${classification.intent} ${lastTopic || ""}`.trim();

    /* 3. DUAL RETRIEVAL WITH RAG */
    let { context, detectedTopic } = retrieveContext(enhancedQuery);

    /* 4. SOCIAL/FALLBACK CHECK */
    if (context === "NO_CONTEXT_FOUND") {
      const socialPhrases = ["hi", "hello", "hey", "kamusta", "kumusta", "thanks", "thank you", "salamat", "thankyou", "magandang", "umaga", "hapon", "gabi"];
      const lowerMsg = message.toLowerCase();
      const isSocial = socialPhrases.some(p => lowerMsg.includes(p));

      if (isSocial) {
        if (lowerMsg.includes("thank") || lowerMsg.includes("salamat")) {
          return NextResponse.json({
            reply: `📌 **Kategorya:** ${classification.icon} ${classification.category} — *${classification.intent}*\n\nWalang anuman po! Always happy to help po.`,
            category: classification.category,
            intent: classification.intent,
            icon: classification.icon,
            model: "Ollama (llama3.1:8b)"
          });
        }
        return NextResponse.json({
          reply: `📌 **Kategorya:** ${classification.icon} ${classification.category} — *${classification.intent}*\n\nHello po! I'm Lia Satella, inyong Xfnite community moderator. May maitutulong po ba ako tungkol sa Ginger software, training modules, o payouts?`,
          category: classification.category,
          intent: classification.intent,
          icon: classification.icon,
          model: "Ollama (llama3.1:8b)"
        });
      }

      return NextResponse.json({
        reply: `📌 **Kategorya:** ${classification.icon} ${classification.category} — *${classification.intent}*\n\nPasensya na po, wala pa sa aking opisyal na record ang specific information na yan. Baka gusto niyo pong magtanong tungkol sa Ginger setup, requirements, active projects, o sahod?`,
        category: classification.category,
        intent: classification.intent,
        icon: classification.icon,
        model: "Ollama (llama3.1:8b)"
      });
    }

    /* SAVE TOPIC */
    if (detectedTopic) {
      setTopic(sessionId, detectedTopic as string);
    } else if (classification.intent) {
      setTopic(sessionId, classification.intent);
    }

    /* 5. PROMPT GENERATION FOR OLLAMA */
    const prompt = `Ikaw si Lia Satella, ang magalang at maaasahang community moderator ng Xfinite.
[KATEGORYA]: ${classification.category} - ${classification.intent}

[PANUNTUNAN]:
- Sumagot nang direkta at magalang gamit ang natural na Taglish (may "po" at "opo").
- LIMITAHAN SA 1 O 2 PANGUNGUSAP LAMANG: Huwag humaba nang higit sa 35 words para mabilis mag-generate.
- Gamitin ang ibinigay na Context sa ibaba para sa iyong sagot.

[CONTEXT]:
${context}

[TANONG]:
${message}
`;

    /* 6. CALL OLLAMA VIA N8N WEBHOOK */
    const llmRes = await askLLM(prompt);

    // If Ollama timed out (Cloudflare 100s limit), gracefully provide verified context answer
    let answerText = llmRes.reply;
    if (answerText.includes("temporary connection issue") && context && context !== "NO_CONTEXT_FOUND") {
      const firstLine = context.split("\n")[0];
      const colonIndex = firstLine.indexOf(":");
      const directAnswer = colonIndex !== -1 ? firstLine.slice(colonIndex + 1).trim() : firstLine;
      answerText = directAnswer;
    }

    // Format final response to explicitly tell user the identified category
    const finalReply = `📌 **Kategorya:** ${classification.icon} **${classification.category}** — *${classification.intent}*\n\n${answerText}`;

    return NextResponse.json({
      reply: finalReply,
      category: classification.category,
      intent: classification.intent,
      icon: classification.icon,
      model: llmRes.model
    });

  } catch (err) {
    console.error("Chat API route error:", err);
    return NextResponse.json({ error: "Server error occurred" }, { status: 500 });
  }
}