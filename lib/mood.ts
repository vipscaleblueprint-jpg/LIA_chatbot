/* ================= MOOD & SMALL TALK ================= */
// Lets Lia notice HOW the person is feeling, not just WHAT they ask,
// so she can respond like a real person instead of forcing an FAQ answer.

export type Mood = "frustrated" | "sad" | "confused" | "happy" | "neutral";

export type MessageVibe = {
  mood: Mood;
  smallTalk: boolean; // personal / chit-chat directed at Lia, not an Xfinite question
};

const MOOD_WORDS: Record<Exclude<Mood, "neutral">, string[]> = {
  frustrated: [
    "tamad", "galit", "inis", "nakakainis", "kainis", "bwisit", "buwisit", "badtrip", "ang tagal", "tagal naman",
    "scam", "niloloko", "loloko", "walang kwenta", "walang kuwenta", "pangit", "bakit ganito", "bakit ganyan",
    "wala pa rin", "wala parin", "wala pa din", "wala padin", "nasaan na", "asan na", "grabe", "hayst", "haist",
    "unfair", "daya", "pinapaasa", "paasa", "dismaya", "disappointed", "frustrated", "annoyed", "angry", "bastos",
    "ano ba yan", "seryoso", "joke ba", "ginagago", "sayang", "pinagod",
  ],
  sad: [
    "pagod", "stress", "hirap", "nahihirapan", "malungkot", "lungkot", "sad", "huhu", "iyak", "naiiyak", "gipit",
    "walang wala", "kailangan ko talaga", "sana makapasa", "bagsak", "bumagsak", "hindi pumasa", "di pumasa",
    "failed ako", "suko", "susuko", "give up", "nakakapagod",
  ],
  confused: [
    "nalilito", "lito", "di ko gets", "hindi ko gets", "di ko maintindihan", "hindi ko maintindihan", "confused",
    "ano daw", "di ko alam", "hindi ko alam", "naguguluhan", "gulo",
  ],
  happy: [
    // Good news only. A plain "salamat" is just politeness, not a reason for "congrats".
    "yey", "yay", "nakapasa", "pumasa na", "passed na", "finally", "sa wakas", "galing", "happy", "masaya ako",
    "sahod na", "nakasahod",
  ],
};

// Personal questions / chit-chat aimed at Lia herself
const SMALL_TALK = [
  "masaya ka", "masaya ba kayo", "masaya ba kau", "masaya kayo", "kumusta ka", "kamusta ka", "kumusta kayo",
  "kamusta kayo", "musta ka", "musta kayo", "how are you", "sino ka", "who are you", "bot ka", "tao ka", "ai ka",
  "robot ka", "totoong tao", "ilang taon", "taga saan", "kumain ka", "kain ka na", "kain na", "pagod ka", "busy ka",
  "busy kayo", "anong ginagawa mo", "ano ginagawa mo", "may jowa", "single ka", "good morning", "good evening",
  "good night", "gandang umaga", "magandang umaga", "magandang hapon", "magandang gabi", "ingat", "miss mo",
];

function normalize(text: string) {
  return ` ${text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim()} `;
}

function hits(text: string, words: string[]) {
  return words.filter(w => text.includes(` ${w}`)).length;
}

export function readVibe(message: string): MessageVibe {
  const text = normalize(message);

  let mood: Mood = "neutral";
  let best = 0;
  for (const m of ["frustrated", "sad", "confused", "happy"] as const) {
    const n = hits(text, MOOD_WORDS[m]);
    if (n > best) { best = n; mood = m; }
  }
  // Sad faces / repeated ?? also signal emotion when no word matched
  if (mood === "neutral" && /(:\(|😢|😭|😞|😔)/.test(message)) mood = "sad";
  if (mood === "neutral" && /(\?\?\?|!!!|😡|😤)/.test(message)) mood = "frustrated";

  return { mood, smallTalk: hits(text, SMALL_TALK) > 0 };
}

export const MOOD_GUIDE: Record<Mood, string> = {
  frustrated:
    "The person sounds frustrated or offended. FIRST acknowledge it sincerely in one short sentence (e.g. \"Ay sorry po, hindi ganun yung ibig kong sabihin\" or \"Gets ko po, nakakainis nga yan\"). Never argue, never defend the company, never blame them. Then help calmly.",
  sad:
    "The person sounds tired, stressed, or discouraged. Be warm and encouraging first in one short sentence (e.g. \"Kaya niyo yan po! Normal lang talaga mahirapan sa start\"). Then help gently.",
  confused:
    "The person is confused. Reassure them it's okay (e.g. \"Okay lang po, medyo confusing talaga yan sa simula\"), then explain simply, step by step.",
  happy:
    "The person is sharing good news (passed, got paid, etc.). Celebrate it with them briefly and keep it light.",
  neutral: "The person sounds neutral. Just be friendly and helpful.",
};
