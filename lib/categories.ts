/* ================= QUESTION CATEGORIES ================= */
// Lia figures out the category on her own from the wording of the question,
// the user never has to say it. Keywords come from the real group chat data
// in faq_data_cleaning/ (Taglish, typos and short forms included).

export type CategoryId =
  | "apply"
  | "legit_fees"
  | "requirements"
  | "pay"
  | "training"
  | "tech"
  | "account"
  | "tasks"
  | "support"
  | "platform";

type CategoryDef = {
  label: string;
  keywords: string[]; // single words match by prefix, phrases match as-is
};

export const CATEGORIES: Record<CategoryId, CategoryDef> = {
  apply: {
    label: "Application & Getting Started",
    keywords: [
      "apply", "application", "sign up", "signup", "mag sign", "hiring", "hire", "slot", "join",
      "sumali", "makapasok", "pasok", "interested", "interesado", "paano magsimula", "how to start",
      "steps", "application form", "open pa", "tumatanggap", "overview", "ano ang xfnite", "what is xfnite",
      "ano ba ang xfinite", "ano trabaho", "anong work",
    ],
  },
  legit_fees: {
    label: "Legitimacy & Fees",
    keywords: [
      "legit", "scam", "totoo", "real", "fake", "fee", "fees", "charge", "deduct", "kaltas",
      "registration fee", "activation fee", "service charge", "admin fee", "management fee", "libre", "free",
      "may bayad", "babayaran",
    ],
  },
  requirements: {
    label: "Requirements & Work Hours",
    keywords: [
      "requirement", "requirements", "specs", "pc", "laptop", "computer", "desktop", "mouse", "internet",
      "wifi", "data", "ram", "processor", "windows", "hours", "oras", "schedule", "part time", "full time",
      "weekend", "weekends", "flexible", "araw araw", "everyday", "cellphone", "phone", "mobile", "cp",
    ],
  },
  pay: {
    label: "Salary, Payouts & Rates",
    keywords: [
      "sahod", "sahud", "sasahurin", "nasasahuran", "sweldo", "salary", "pay", "payout", "payment", "rate",
      "rates", "kinita", "delay",
      "earn", "earning", "income", "cut off", "cutoff", "withdraw", "withdrawal", "wallet", "gcash", "bank",
      "bdo", "bpi", "landbank", "maya", "magkano", "pera", "release", "nasahod", "makasahod", "computation",
      "benchmark", "minimum withdrawal", "distribution",
    ],
  },
  training: {
    label: "Training & Onboarding",
    keywords: [
      "training", "train", "module", "modules", "onboarding", "exam", "pre course", "precourse",
      "orientation", "video", "videos", "verification form", "rules", "guidelines", "passed", "pumasa",
      "nakapasa", "susunod", "next step", "ano next", "what next", "3dr", "roof training", "landcover",
      "land cover", "transpo", "deadline", "answer key", "hands on", "pause", "ipagpatuloy", "ituloy",
      "quiz",
    ],
  },
  tech: {
    label: "Ginger App & Technical",
    keywords: [
      "ginger", "install", "installation", "download", "extract", "7zip", "7 zip", "zip", "visual c",
      "vc redist", "redist", "bat", "update", "vpn", "error", "crash", "freeze", "not responding", "drive c",
      "antivirus", "version", "software", "lag", "server", "nag hang", "ayaw mag open", "di ma open",
      "hindi ma open", "timezone",
    ],
  },
  account: {
    label: "Account & Credentials",
    keywords: [
      "account", "login", "log in", "maglog", "mag log", "login details", "loyalty", "points", "password", "username", "user id", "ginger id", "bitmappro", "otp",
      "expired", "disabled", "credentials", "account info", "register", "registration", "dashboard",
      "invite link", "profile", "verify account",
    ],
  },
  tasks: {
    label: "Projects & Tasks",
    keywords: [
      "task", "tasks", "project", "projects", "live task", "checker", "judger", "pullback", "pull back",
      "push back", "pushback", "topology", "ctrl", "submit", "label", "labeling", "overlap", "comment",
      "team", "group", "attendance", "query", "performance", "approval", "checking", "red and yellow",
    ],
  },
  support: {
    label: "Contact & Support",
    keywords: [
      "contact", "cedrick", "recruiter", "tm", "team manager", "admin", "pm", "message", "fb group",
      "facebook", "gc", "group chat", "discord", "kanino", "sino kakausapin", "who to contact", "support",
    ],
  },
  platform: {
    label: "Platform Features & Navigation",
    keywords: [
      "quest", "quests", "daily quest", "lxp", "loyalty", "loyalty points", "leaderboard", "ranking", "attendance",
      "check in", "dj booth", "jukebox", "lounge", "announcement", "notification", "bell", "sidebar", "locked",
      "naka lock", "unlock", "badge", "challenger", "novice", "veteran", "overseer", "arbiter", "grandmaster",
      "theme", "dark mode", "menu", "saan makikita", "nasaan",
    ],
  },
};

const ORDER = Object.keys(CATEGORIES) as CategoryId[];

export function isCategoryId(value: string | undefined): value is CategoryId {
  return !!value && value in CATEGORIES;
}

function normalize(text: string) {
  return ` ${text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim()} `;
}

function keywordScore(text: string, tokens: string[], kw: string) {
  const k = kw.toLowerCase().replace(/[^\w\s]/g, " ").trim();
  if (k.includes(" ")) return text.includes(` ${k} `) ? 3 : 0;
  // Prefix match catches Tagalog affixes and typos like "mag-install" / "installing"
  return tokens.some(t => t === k || (k.length >= 4 && t.startsWith(k)) || (k.length >= 5 && t.includes(k))) ? 2 : 0;
}

export type DetectedCategory = {
  primary: CategoryId;
  secondary?: CategoryId;
  label: string;
};

export function detectCategory(message: string): DetectedCategory | null {
  const text = normalize(message);
  const tokens = text.trim().split(" ");

  const scores = ORDER.map(id => ({
    id,
    score: CATEGORIES[id].keywords.reduce((sum, kw) => sum + keywordScore(text, tokens, kw), 0),
  }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scores.length) return null;

  const [top, next] = scores;
  return {
    primary: top.id,
    secondary: next && next.score >= top.score * 0.6 ? next.id : undefined,
    label: CATEGORIES[top.id].label,
  };
}
