import { NextResponse } from "next/server";
import { retrieveContext, retrieveTeamAnswers } from "@/lib/rag";
import { askLLM } from "@/lib/llm";
import { CATEGORIES, detectCategory, type DetectedCategory } from "@/lib/categories";
import { MOOD_GUIDE, readVibe } from "@/lib/mood";
import { findPlaybook, playbookBlock, wantsSteps } from "@/lib/playbooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Turn = { role: "user" | "assistant"; text: string };

// Kept small on purpose: the n8n model is slow and times out on long prompts
const HISTORY_TURNS = 6;

// Only trust well-formed, recent turns from the client
function cleanHistory(raw: unknown): Turn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is Turn =>
      !!t && typeof t === "object" &&
      (t.role === "user" || t.role === "assistant") &&
      typeof t.text === "string")
    .slice(-HISTORY_TURNS)
    .map(t => ({ role: t.role, text: t.text.slice(0, 300) }));
}

/* ================= PERSISTENCE ================= */
// First time Lia can't answer, she just points them to Cedrick naturally.
// Only if they push for the same thing again does she admit it plainly.

const PUSH_PHRASES = [
  "sagutin mo", "sagutin nyo", "sagutin niyo", "sagot naman", "please answer", "just answer", "ano nga",
  "eh ano nga", "sige na", "di mo sinagot", "hindi mo sinagot", "di nyo sinagot", "hindi niyo sinagot",
  "seryoso", "ulit", "tinatanong ko", "tanong ko nga", "ikaw na lang", "ikaw nalang", "wag na si cedrick",
];

function keyWords(text: string) {
  return new Set(text.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(w => w.length >= 4));
}

function isPersisting(message: string, turns: Turn[]) {
  // Skip "connection lag" messages: they mention Cedrick but aren't a real redirect
  const lastLia = [...turns].reverse().find(t => t.role === "assistant" && !ALL_LAG.has(t.text))?.text ?? "";
  const lastUser = [...turns].reverse().find(t => t.role === "user")?.text ?? "";
  if (!/cedrick/i.test(lastLia)) return false; // she hasn't redirected them yet

  const msg = ` ${message.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ")} `;
  if (PUSH_PHRASES.some(p => msg.includes(` ${p}`))) return true;

  // Same question again (most of the key words overlap)
  const a = keyWords(message), b = keyWords(lastUser);
  if (!a.size || !b.size) return false;
  const overlap = [...a].filter(w => b.has(w)).length;
  return overlap / Math.min(a.size, b.size) >= 0.5;
}

/* ================= "KAMUSTA" GUARD ================= */
// The small model loves tacking "Kamusta po kayo?" onto every reply, which reads like a bot.
// Allow it only when the user asked how Lia is AND she hasn't asked them back yet.

const KAMUSTA = /\b(ka|ku)musta\b/i;

function trimKamusta(reply: string, message: string, turns: Turn[]) {
  const userAskedHowSheIs = KAMUSTA.test(message) || /how are you|masaya (ka|ba|kayo)/i.test(message);
  const alreadyAsked = turns.some(t => t.role === "assistant" && KAMUSTA.test(t.text));
  if (userAskedHowSheIs && !alreadyAsked) return reply.replace(/\bkumusta\b/gi, m => (m[0] === "K" ? "Kamusta" : "kamusta"));

  const kept = reply.split(/(?<=[.!?])\s+/).filter(s => !KAMUSTA.test(s));
  return kept.length ? kept.join(" ").trim() : reply;
}

/* ================= WHEN THE MODEL IS DOWN ================= */
// n8n sometimes times out. Don't repeat one fixed line: pick a message she hasn't just used,
// and if it keeps failing, change tack instead of asking them to resend again and again.

const LAG_MESSAGES = [
  "Ay sorry po, medyo bumagal yung connection ko. Pa-send po ulit?",
  "Hala, na-cut po yung reply ko. Pwede pakiulit yung tanong niyo?",
  "Sorry po, nag-hang ako saglit. Ano nga po ulit yung tanong niyo?",
  "Pasensya na po, medyo mabagal yung system ngayon. Try niyo po ulit in a bit?",
];
const LAG_STREAK_MESSAGES = [
  "Sorry po talaga, mukhang mabagal yung system ko ngayon. Habang inaayos pa, pwede niyo rin i-message si Cedrick or yung recruiter niyo para mas mabilis kayong matulungan.",
  "Pasensya na po, ayaw talaga mag-load ng reply ko ngayon. Kung urgent po, i-message niyo muna si Cedrick or yung TM niyo, tapos balikan niyo lang ako mamaya.",
];
const ALL_LAG = new Set([...LAG_MESSAGES, ...LAG_STREAK_MESSAGES]);

function lagReply(turns: Turn[]) {
  const liaTurns = turns.filter(t => t.role === "assistant").map(t => t.text);
  const recent = new Set(liaTurns.slice(-3));
  const streak = liaTurns.length > 0 && ALL_LAG.has(liaTurns[liaTurns.length - 1]);
  const pool = (streak ? LAG_STREAK_MESSAGES : LAG_MESSAGES).filter(m => !recent.has(m));
  const fresh = LAG_MESSAGES.filter(m => !recent.has(m));
  const options = pool.length ? pool : fresh.length ? fresh : LAG_MESSAGES;
  return options[Math.floor(Math.random() * options.length)];
}

// Lia must never point users to things only she can see in her prompt
const PROMPT_LEAK = /\b(context|team answers?|platform guide|knowledge base|database)\b/i;

function scrubLeaks(reply: string) {
  const kept = reply.split(/(?<=[.!?])\s+/).filter(s => !PROMPT_LEAK.test(s));
  return kept.length ? kept.join(" ").trim() : reply;
}

// Single exit for every model reply
function finish(raw: string | null, message: string, turns: Turn[], opts: { cedrick?: boolean } = {}) {
  if (!raw || !raw.trim()) return NextResponse.json({ reply: lagReply(turns) });
  let reply = scrubLeaks(raw);
  if (opts.cedrick) reply = ensureCedrick(reply);
  return NextResponse.json({ reply: trimKamusta(reply, message, turns) });
}

function historyBlock(turns: Turn[]) {
  if (!turns.length) return "(This is the start of the conversation.)";
  return turns.map(t => `${t.role === "user" ? "User" : "Lia"}: ${t.text}`).join("\n");
}

/* ================= SHARED PERSONA ================= */

// Kept compact on purpose: every extra token slows the n8n model and risks a timeout.
const PERSONA = `
[WHO YOU ARE]
Lia Satella of the Xfinite team, chatting 1-on-1 on Messenger like a warm, patient Filipino coworker.
- You're on the member's side: say "tayo", never "kami/namin" vs "kayo". Never imply they're lazy or a bother.
- Never invent facts, problems, dates, or schedules.
- If sincerely asked if you're a bot/AI, say casually you're Lia, the Xfinite team's virtual assistant. Don't pretend to be human.

[SOUND HUMAN]
- The user can't see your Context, Team Answers, or guide. Never mention them ("nasa Context", "check yung guide"). Give the actual steps yourself, with the exact place on the site ("sa sidebar, Onboarding").
- Never say "wala sa info/records ko" or "according to the context". No side comments in parentheses.
- Cedrick, recruiters, TMs, and judgers are people: "siya po makakasagot nyan", never "may latest update".
- Mention Cedrick/recruiter/TM ONLY if you truly don't know, a team answer says to message someone, or they keep pushing. Never tack it onto an answer you know.
- Don't assume a problem they didn't mention. If they ask HOW, just explain how.
- Examples here are ideas, not scripts. Never copy them, never repeat a sentence you already said in the conversation, and vary how you start.

[READ THE ROOM]
- If they're reacting to your last message, respond to that. If offended: brief sorry, clarify, reassure. Never argue.
- Acknowledge feelings before info. Don't push work when they're chatting, tired, or upset.
- Match their length. Most replies end after the answer, with no extra question.

[TAGLISH]
- Casual pero maayos: about half English (verbs/nouns like check, reach, update, wait, make sure, earnings, balance, training, account) and half Tagalog glue (po, lang, kasi, yung, naman, niyo, tapos). Not "malalim".
- Swap deep words: naiipon->naa-add, madagdagan->tumaas, siguraduhin->make sure, hintayin->wait lang, susunod->next, kinabukasan->bukas, maaari->pwede, katanungan->tanong, ngunit->pero.
- 1-2 "po" per reply. Short, complete sentences; if Tagalog feels awkward, use English. No slang (lodi, charot, beh, sis).
- Always "kayo/niyo", never "ka/mo". "kasi" only means "because". No random "Opo!" ending. Plain text, no bold.
`;

// Only for small talk / feelings. Kept out of FAQ answers so Lia doesn't open a salary
// answer with "Okay naman po ako!" copied from these.
const SMALL_TALK_EXAMPLES = `
[HOW TO READ THE ROOM: IDEAS, NOT SCRIPTS]
- Asked how you are ("Masaya ba kayo?"): say you're doing okay in a light way and thank them for asking. You may ask them back ONCE in the whole conversation (use "naman", spelled "kamusta"), and only if you haven't already asked earlier in the CONVERSATION SO FAR.
  Wrong: "Wala lang, busy kami sa Xfinite. May mga problema..." (cold, invents problems)
- Offended ("So busy kayo tapos kami mga tamad?"): quick sorry, clarify you didn't mean that, reassure them you're here for them.
  Wrong: "Oo naman, tuloy-tuloy lang ang trabaho namin! Trabahin na tayo!"
- Discouraged ("Pagod na ako, bumagsak na naman ako"): show you care first, normalize the struggle, suggest a short break, encourage them, and maybe ask what part is hard.
  Wrong: "Ayos lang po, pagod ka na ba?" (dismissive, uses "ka")
- Thanks: accept it warmly and let them know they can message anytime.
- Greeting: greet back briefly and ask what they need help with. Introduce yourself as Lia only at the start of the conversation. Don't ask "kamusta" unless they asked you first.
`;

// Only for Xfinite questions
const FAQ_EXAMPLES = `
[HOW TO ANSWER: IDEAS, NOT SCRIPTS]
- Go straight to the answer. Don't greet and don't say how you are unless they asked.
- Frustrated ("Ang tagal naman ng sahod"): one short line that shows you get the frustration, then the actual info from Context.
- Asked something the Context doesn't cover ("May 13th month pay?"): don't guess. Casually point them to Cedrick as the person who can answer, in your own words.
  Wrong: "Ang alam ko po... baka June 13..." (guessing, inventing dates)
  Wrong: "Sorry po, wala pa sa info ko yan." (sounds like a bot)
- Wallet "why" questions: plain reason in light Taglish, plus reassurance that their earnings are safe.
  Wrong: "naiipon lang hanggang umabot" (deep Tagalog, unfinished sentence)
`;

/* ================= PROMPTS FOR SPECIAL MOMENTS ================= */

// Small talk, feelings, greetings, thanks: no Xfinite facts at all
function chatPrompt(message: string, turns: Turn[], moodLine: string) {
  return `
${PERSONA}
${SMALL_TALK_EXAMPLES}

[RIGHT NOW]
This message is small talk, a greeting, thanks, or about how the person feels. It's not an Xfinite FAQ question.
${moodLine}
Reply like a caring human coworker would, in 1-3 short sentences. Do NOT bring up Xfinite facts, rules, or work unless they ask.
If they seem to want help with Xfinite, gently ask what they need help with.

CONVERSATION SO FAR:
${historyBlock(turns)}

User's new message:
${message}

Lia's reply:`;
}

// A question Lia has no info on. No FAQ text is included, so she can't drift into unrelated facts.
function unknownPrompt(message: string, turns: Turn[], moodLine: string, persisted: boolean) {
  return `
${PERSONA}

[RIGHT NOW]
They asked something you don't have the answer to.
${moodLine}
${persisted
  ? `You ALREADY pointed them to Cedrick, and they're asking or pushing again.
- Acknowledge that they really want to know.
- Now be upfront, in your own words, that you don't have the details on that one yet (it's okay to say it plainly this time).
- Suggest messaging Cedrick again, but phrase it differently from last time.`
  : `- Don't guess and don't make anything up.
- Casually point them to Cedrick as the person who can answer it, in your own words.
- Don't explain why you don't know.`}
- 1-2 short sentences. Do NOT mention any amounts, dates, or other Xfinite facts.
- Don't greet and don't ask "kamusta" here. Start with the point.
- Don't explain or guess WHY you don't know (no "sa future pa", "wala pang details kasi..."). Don't say where to find Cedrick.
- NEVER discourage them from asking ("wag muna kayo magtanong" is rude). They're always welcome to ask you more.

CONVERSATION SO FAR:
${historyBlock(turns)}

User's new message:
${message}

Lia's reply:`;
}

// The model occasionally forgets to name the person to ask; nudge it without a fixed script
function ensureCedrick(reply: string) {
  if (/cedrick/i.test(reply)) return reply;
  const nudges = [
    "Si Cedrick po makakatulong sa inyo dyan.",
    "Try niyo po i-message si Cedrick about dyan.",
    "Pwede niyo rin po i-chat si Cedrick para dyan.",
  ];
  return `${reply.trim()} ${nudges[Math.floor(Math.random() * nudges.length)]}`;
}

/* ================= ROUTE ================= */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message: string = String(body.message ?? "").trim();
    const turns = cleanHistory(body.history);

    if (!message) return NextResponse.json({ reply: "Hi po! May tanong po ba kayo? 😊" });

    /* 1. HOW ARE THEY FEELING + WHAT ARE THEY ASKING */
    const vibe = readVibe(message);
    const ownCategory = detectCategory(message) ?? undefined;
    let category: DetectedCategory | undefined = ownCategory;

    // Vague follow-up ("eh pano yun?", "wala pa rin") inherits the topic of their last question.
    // Small talk never does, so "Masaya ba kayo?" doesn't get dragged into an FAQ.
    const lastUserMsg = [...turns].reverse().find(t => t.role === "user")?.text;
    if (!category && !vibe.smallTalk) {
      category = (lastUserMsg && detectCategory(lastUserMsg)) || undefined;
    }

    // Known scenario (e.g. wallet stuck on "Processing") -> step-by-step guide like a teammate would give
    const playbook = findPlaybook(message) ?? (!ownCategory && !vibe.smallTalk && lastUserMsg ? findPlaybook(lastUserMsg) : undefined);
    if (playbook && !category) category = { primary: "pay", label: CATEGORIES.pay.label };

    const moodLine = MOOD_GUIDE[vibe.mood];

    // Already pointed to Cedrick (she only does that when she doesn't have the answer) and
    // they're pushing on the same thing -> she admits it plainly, in her own words.
    // Uses a prompt with no FAQ text so she can't drift into unrelated facts.
    if (isPersisting(message, turns)) {
      return finish(await askLLM(unknownPrompt(message, turns, moodLine, true)), message, turns, { cedrick: true });
    }

    /* 2A. CONVERSATIONAL PATH: small talk or feelings with no Xfinite topic */
    if (!category && (vibe.smallTalk || vibe.mood !== "neutral" || turns.length > 0)) {
      return finish(await askLLM(chatPrompt(message, turns, moodLine)), message, turns);
    }

    /* 2B. FAQ PATH: official FAQ + real team answers from the same category */
    // With a playbook, skip the raw FAQ so amounts/thresholds never leak into the reply
    // A vague follow-up ("nasaan yung guide?") has no topic words of its own, so search
    // with the question it follows up on, or it matches random rows like "Guides button"
    const query = !ownCategory && lastUserMsg ? `${lastUserMsg} ${message}` : message;
    const { context } = playbook ? { context: "NO_CONTEXT_FOUND" } : retrieveContext(query, category);
    const teamAnswers = retrieveTeamAnswers(query, category);

    if (!playbook && context === "NO_CONTEXT_FOUND" && !teamAnswers.length) {
      // Greetings and thanks are just conversation; anything else is a question she can't answer
      const isSocial = /\b(hi|hello|hey|kumusta|kamusta|musta|thank|thanks|salamat|ty)\b/i.test(message);
      if (isSocial) {
        return finish(await askLLM(chatPrompt(message, turns, moodLine)), message, turns);
      }
      return finish(await askLLM(unknownPrompt(message, turns, moodLine, false)), message, turns, { cedrick: true });
    }

    const categoryLine = category
      ? category.label + (category.secondary ? ` (also related: ${CATEGORIES[category.secondary].label})` : "")
      : "General";

    const teamBlock = teamAnswers.length
      ? teamAnswers.map(t => `Q: ${t.question}\nA (${t.by}): ${t.answer}`).join("\n\n")
      : "None for this question.";

    const prompt = `
${PERSONA}
${FAQ_EXAMPLES}

[GOAL]
Answer the user's question directly and CONFIDENTLY using the provided Context and Team Answers.
If the information is there, do NOT apologize or say "I think". Just provide the answer.

[HOW THEY FEEL]
${moodLine}

[QUESTION CATEGORY]
This question is about: ${categoryLine}
Answer only that topic. Ignore Context lines that are about a different topic.
${playbook ? `
[SCENARIO GUIDE: FOLLOW THIS]
${playbookBlock(playbook, wantsSteps(message))}

How to say it (like a teammate texting, NOT like a manual or an AI):
${wantsSteps(message)
  ? `- They asked HOW, so just walk them through it like you're beside them: "Punta po kayo sa ..., tapos ..., pag ... na, ...". Open naturally (e.g. "Sige po, ganito lang:"), NOT with "kasi" since they didn't ask why. Short numbered steps are okay if there are 3 or more.`
  : `- They asked WHY (not how), so ONLY explain the reason in 1-2 casual sentences, e.g. "Ah, kasi po ...". Reassure them if it helps (e.g. "Don't worry po, safe yung earnings niyo").
- Do NOT give steps, do NOT say where to go or what to click, do NOT tell them to keep doing tasks. They didn't ask that.`}
- NEVER promise when money will arrive (no "bukas", no dates, no "malapit na") unless it's written in the guide.
- Keep it short. No headings, no "Here are the steps", no formal intro.
- Use only the guide above for facts. Don't mention Cedrick or anyone to message unless the steps say so.
` : ""}
[HOW TO ANSWER]
- Answer like the recruiters in Team Answers: short, direct, telling them exactly what to do or click next.
- Facts only from Context and Team Answers. "[Platform guide]" lines describe the CURRENT website and win over other lines; use their "Where" path to say where to click. Numbers, fees and links come from Context.
- Only answer what was asked, in your own words. If you know it, just answer, no disclaimer first.
- If someone needs a person to fix something (disabled account, user expired, no team), say who to message: recruiter, TM, or judger.
- If the info really isn't there, don't guess: casually point them to Cedrick, in your own words.

CONTEXT (official FAQ):
${context === "NO_CONTEXT_FOUND" ? "None for this question." : context}

TEAM ANSWERS (real replies from the Xfinite team):
${teamBlock}

CONVERSATION SO FAR:
${historyBlock(turns)}

User's new message:
${message}

Lia's reply:`;

    return finish(await askLLM(prompt), message, turns);

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server crashed" }, { status: 500 });
  }
}
