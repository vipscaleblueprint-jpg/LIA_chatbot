import { NextResponse } from "next/server";
import { retrieveContext } from "@/lib/rag";
import { askLLM } from "@/lib/llm";
import { getTopic, setTopic } from "@/lib/chatMemory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    const sessionId =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "local";

    /* LOAD MEMORY */
    const lastTopic = getTopic(sessionId);

    /* 1. QUERY ENHANCEMENT (Internal Rephrasing) */
    // Instead of calling LLM twice (slow), we do a multi-word search by splitting phrases
    const enhancedQuery = `${message} ${lastTopic || ""}`.trim();

    /* 2. DUAL RETRIEVAL */
    let { context, detectedTopic } = retrieveContext(enhancedQuery);

    /* 3. SOCIAL/FALLBACK CHECK */
    if (context === "NO_CONTEXT_FOUND") {
      const socialPhrases = ["hi", "hello", "hey", "kamusta", "kumusta", "thanks", "thank you", "salamat", "thankyou", "magandang", "umaga", "hapon", "gabi"];
      const lowerMsg = message.toLowerCase();
      const isSocial = socialPhrases.some(p => lowerMsg.includes(p));
      
      if (isSocial) {
        if (lowerMsg.includes("thank") || lowerMsg.includes("salamat")) {
          return NextResponse.json({ reply: "Walang anuman po! Always happy to help." });
        }
        return NextResponse.json({ reply: "Hello po! I'm Lia Satella. May itatanong po ba kayo about Xfinite? Handa po akong sumagot sa inyong mga katanungan." });
      }

      return NextResponse.json({ reply: "Pasensya na po, wala sa record ko ang information na yan. Baka gusto niyo magtanong about Xfinite project, requirements, or payments?" });
    }

    /* SAVE TOPIC */
    if (detectedTopic) setTopic(sessionId, detectedTopic as string);

    /* 4. FINAL LLM GENERATION */
    const prompt = `
You are Lia Satella, a helpful and polite community moderator for Xfinite. 

[GOAL]
Answer the user's question directly and CONFIDENTLY using the provided Context. 
If the information is in the Context, do NOT apologize or say "I think". Just provide the answer.

[TONE & STYLE]
- Friendly Ate/Kuya vibe but GET STRAIGHT TO THE POINT.
- Language: Natural Taglish (Filipino-English mix).
- Always use "po" and "opo" to remain polite.
- Avoid being "robotic" by using natural fillers.
- IMPORTANT: DO NOT say "Pasensya na po" unless you are 100% sure the information is missing from the Context.

[STRICT RESPONSE RULES]
- ONLY answer what is specifically asked. 
- DO NOT dump irrelevant info.
- NO BOLD: Never use ** or __.
- FORMATTING: Plain text only. 

[ACCOUNT/REGISTRATION RULE]
- For account issues: Simply state that passing the Precourse Exam is the only way to get an account, and to message Cedrick for follow-ups.

[FALLBACK]
- If and ONLY IF the info is NOT in context: "Pasensya na po, wala pa po kasi sa records ko yung info na yan."

CONTEXT:
${context}

QUESTION:
${message}
`;



    const reply = await askLLM(prompt);

    return NextResponse.json({ reply });

  } catch (err) { 
    console.error(err);
    return NextResponse.json({ error: "Server crashed" }, { status: 500 });
  }
}