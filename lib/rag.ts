import xfinite from "@/app/data/xfinite.json";

type KBItem = {
  title: string;
  content: string;
  source: string;
};

/* ================= BUILD KB ================= */

const KB: KBItem[] = [
  ...xfinite.map(x => ({ ...x, source: "xfinite" })),
];

const MEANING: Record<string, string[]> = {
  pay: ["salary", "income", "earn", "earnings", "rate", "payout", "paid", "money", "cash", "payment", "kita", "sweldo", "pera", "sahod", "minimum"],
  monthly: ["month", "4", "weeks", "cycle", "buwan", "buwanan"],
  requirements: ["requirement", "needs", "needed", "qualification", "prerequisite", "specs", "system", "kailangan", "gamit", "pc", "laptop"],
  training: ["orientation", "lesson", "course", "session", "video", "hands-on", "tutor", "guide", "aral", "pag-aaral"],
  install: ["setup", "installation", "installing", "ginger", "software", "pag-install", "i-install"],
  time: ["hours", "schedule", "shift", "duration", "oras", "sked", "flexi"],
  apply: ["hiring", "join", "start", "application", "enroll", "slots", "register", "apply", "joining", "started", "paano", "mag-apply", "pasok"],
  contact: ["inquiry", "email", "facebook", "social", "reached", "reach", "inquiries", "ig", "instagram", "linkedIn", "fb", "tanong", "message"],
  xfinite: ["xf", "xfnite", "project", "label", "labeling", "building", "roof", "satellite", "map", "ginger", "bitmappro", "cedrick"],
  account: ["generate", "generation", "signup", "sign-up", "registration", "register", "problem", "create", "gawa", "account", "login"],
  legit: ["scam", "real", "fake", "legitimacy", "safe", "true", "operating", "years", "members", "totoo", "safe"],
  error: ["failed", "problem", "issue", "doesn't", "working", "invalid", "unable", "cannot", "can't", "fix", "open", "opening", "mali", "error", "sira"],
  display: ["lines", "color", "red", "yellow", "topology", "remove", "delete", "fix", "guhit", "kulay"],
};

/* ================= NORMALIZATION ================= */

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string) {
  return normalize(text).split(" ");
}

/* ================= STOPWORDS ================= */

const STOPWORDS = new Set([
  "what", "is", "are", "the", "a", "an", "do", "you", "know", "about", "tell", "me",
  "can", "i", "how", "to", "of", "for", "in", "on", "at", "with", "and", "or", "if",
  "does", "it", "they", "their", "there", "ng", "ang", "mga", "sa", "ay", "na", "paano", "ano"
]);

function meaningful(tokens: string[]) {
  return tokens.filter(t => !STOPWORDS.has(t.toLowerCase()) && t.length >= 2);
}

/* ================= JARO-WINKLER SIMILARITY ================= */

function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;

  const len1 = s1.length;
  const len2 = s2.length;
  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;

  const matches1 = new Array(len1).fill(false);
  const matches2 = new Array(len2).fill(false);

  let m = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);
    for (let j = start; j < end; j++) {
      if (!matches2[j] && s1[i] === s2[j]) {
        matches1[i] = true;
        matches2[j] = true;
        m++;
        break;
      }
    }
  }

  if (m === 0) return 0.0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (matches1[i]) {
      while (!matches2[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }
  }

  const jaro = (m / len1 + m / len2 + (m - transpositions / 2) / m) / 3;
  const prefixScalingFactor = 0.1;
  let prefixLen = 0;
  for (let i = 0; i < Math.min(4, len1, len2); i++) {
    if (s1[i] === s2[i]) prefixLen++;
    else break;
  }

  return jaro + prefixLen * prefixScalingFactor * (1 - jaro);
}

/* ================= SENTENCE SPLITTER ================= */

function sentences(text: string) {
  return text.split(/(?<=[.!?])/);
}

/* ================= SCORING LOGIC ================= */

function scoreItem(item: KBItem, queryTokens: string[]) {
  let score = 0;

  // 1. Title Match (HIGHEST WEIGHT)
  const titleTokens = meaningful(tokenize(item.title));
  for (const q of queryTokens) {
    for (const t of titleTokens) {
      const sim = jaroWinkler(q, t);
      if (sim > 0.95) score += 40; // Exact/Near match
      else if (sim > 0.85) score += 20;
    }
  }

  // 2. Content Match
  const itemSentences = sentences(item.content);
  let bestSentenceScore = 0;

  for (const s of itemSentences) {
    const contentTokens = meaningful(tokenize(s));
    let sentenceScore = 0;
    for (const q of queryTokens) {
      for (const c of contentTokens) {
        const sim = jaroWinkler(q, c);
        if (sim > 0.95) sentenceScore += 10;
        else if (sim > 0.85) sentenceScore += 5;
        else if (sim > 0.75) sentenceScore += 2;
      }
    }
    bestSentenceScore = Math.max(bestSentenceScore, sentenceScore);
  }
  score += bestSentenceScore;

  // 3. Source Boost
  if (queryTokens.includes(item.source)) {
    score += 15;
  }

  return score;
}

/* ================= RETRIEVER ================= */

export function retrieveContext(query: string, forcedTopic?: string) {
  let tokens = meaningful(tokenize(query));
  tokens = expandMeaning(tokens);

  let candidates = KB;

  const ranked = candidates
    .map(item => ({
      item,
      score: scoreItem(item, tokens)
    }))
    .filter(r => r.score > 2) // Minimum relevance threshold
    .sort((a, b) => b.score - a.score)
    .slice(0, 7); // Retrieve top 7 items

  if (!ranked.length) {
    // Fallback: If no matches, try loose token matching on title only
    const looseRanked = candidates
      .map(item => {
        let looseScore = 0;
        const title = normalize(item.title);
        for (const q of tokens) {
          if (title.includes(q)) looseScore += 10;
        }
        return { item, score: looseScore };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
      
    if (!looseRanked.length) return { context: "NO_CONTEXT_FOUND" };
    
    return {
      context: looseRanked.map(r => `${r.item.title}: ${r.item.content}`).join("\n"),
      detectedTopic: looseRanked[0].item.source
    };
  }

  const topicCount: Record<string, number> = {};
  for (const r of ranked) {
    topicCount[r.item.source] = (topicCount[r.item.source] || 0) + 1;
  }

  const detectedTopic = Object.entries(topicCount).sort((a, b) => b[1] - a[1])[0]?.[0];

  return {
    context: ranked.map(r => `${r.item.title}: ${r.item.content}`).join("\n"),
    detectedTopic
  };
}

function expandMeaning(tokens: string[]) {
  const expanded = new Set(tokens);

  for (const token of tokens) {
    for (const key in MEANING) {
      if (MEANING[key].some(syn => jaroWinkler(token, syn) > 0.9)) {
        expanded.add(key);
      }
      if (token === key) {
        MEANING[key].forEach(w => expanded.add(w));
      }
    }
  }

  return [...expanded];
}

