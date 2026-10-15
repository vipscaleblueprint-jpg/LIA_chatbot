export interface LLMResponse {
  reply: string;
  model: string;
}

/**
 * Call Ollama (llama3.1:8b) via n8n webhook workflow.
 */
async function callOllamaViaWebhook(prompt: string): Promise<string> {
  const webhookUrl = "https://n8n.heysnaply.com/webhook/101ed314-1e34-4b9b-a0e7-2bfafc9300f5";

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  const text = await res.text();

  if (!res.ok) {
    console.error("Ollama / n8n webhook error status:", res.status);
    console.error("Ollama / n8n raw error:", text);
    return "Pasensya na po, nagkaroon ng temporary connection issue sa Ollama server.";
  }

  try {
    const data = JSON.parse(text);

    const extractContent = (obj: unknown): string | null => {
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        const rec = obj as Record<string, unknown>;
        const keys = ["response", "text", "output", "content"];
        for (const key of keys) {
          const val = rec[key];
          if (typeof val === "string") return val;
        }

        const msg = rec.message;
        if (msg && typeof msg === "object" && !Array.isArray(msg)) {
          const msgRec = msg as Record<string, unknown>;
          if (typeof msgRec.content === "string") return msgRec.content;
        }
      }
      return null;
    };

    if (Array.isArray(data)) {
      return extractContent(data[0]) || text;
    }
    return extractContent(data) || text;
  } catch {
    return text;
  }
}

/**
 * Primary LLM entrypoint: Calls Ollama (llama3.1:8b via n8n).
 */
export async function askLLM(prompt: string): Promise<LLMResponse> {
  try {
    const reply = await callOllamaViaWebhook(prompt);
    return {
      reply,
      model: "Ollama (llama3.1:8b)"
    };
  } catch (err) {
    console.error("Ollama LLM crash:", err);
    return {
      reply: "Pasensya na po, nagkaroon ng technical issue habang kinakausap ang Ollama.",
      model: "error-fallback"
    };
  }
}