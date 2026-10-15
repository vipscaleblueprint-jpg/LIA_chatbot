/* ================= SCENARIO PLAYBOOKS ================= */
// Known situations members run into, with how a teammate would actually walk them through it.
// When one matches, Lia gets this guide INSTEAD of raw FAQ text, so she explains the "why"
// and the steps like a person ("Ah, kasi po... Punta po kayo sa...") rather than reciting facts.
// Thresholds are admin settings that can change, so playbooks never contain amounts.

export type Playbook = {
  id: string;
  match: string[]; // phrases checked against the normalized message
  why: string;     // the reason, in plain words
  steps: string[]; // what the member should do, in order
  noNumbers?: boolean;
};

export const PLAYBOOKS: Playbook[] = [
  {
    id: "wallet_processing",
    match: [
      "processing", "nagpro process", "nag process", "final payment", "wait for next cut off",
      "please wait for next", "di makita sahod", "hindi makita sahod", "di ko makita sahod", "hindi ko makita sahod",
      "di lumalabas sahod", "hindi lumalabas sahod", "walang lumalabas na sahod", "nakatago sahod",
    ],
    why:
      "Naka-Processing yung Final Payment kasi hindi pa na-reach ng wallet balance yung minimum para ma-show yung salary. " +
      "Normal lang yan. Don't worry, safe yung earnings, naa-add lang siya sa balance until ma-reach yung minimum.",
    steps: [
      "Go to Xfnite Wallet, then Wallet tab, Overview",
      "Makikita dun yung status na Processing at 'Please wait for next cut-off'",
      "Continue lang sa live tasks para tumaas yung balance",
      "Once ma-reach na yung minimum, magsho-show na yung salary sa next cut-off",
      "While waiting, i-double check na rin yung GCash or bank details sa Payment Method tab",
    ],
    noNumbers: true,
  },
  {
    // Plain "how do I withdraw?" -- no problem implied, so no problem talk
    id: "withdraw_howto",
    match: [
      "withdraw", "withdrawal", "mag withdraw", "magwithdraw", "how to withdraw", "pano withdraw", "paano withdraw",
      "pano mag withdraw", "paano mag withdraw", "pag withdraw", "withdraw process", "cash out", "cashout",
    ],
    why: "Sa Xfnite Wallet po ginagawa yung withdrawal, papunta sa naka-set na GCash or bank.",
    steps: [
      "Make sure muna na naka-set yung GCash or bank sa Payment Method tab",
      "Go to Xfnite Wallet, Wallet tab, Overview",
      "Click yung Withdraw button",
      "Pag na-process na, makikita niyo siya sa Payout History, and 'Sent' yung status once na-send na",
    ],
    noNumbers: true,
  },
  {
    // Something is actually wrong: button won't work, can't withdraw
    id: "withdraw_disabled",
    match: [
      "hindi ma withdraw", "di ma withdraw", "hindi ko ma withdraw", "di ko ma withdraw", "hindi ko mawithdraw",
      "di ko mawithdraw", "hindi makapag withdraw", "di makapag withdraw", "hindi ako makapag withdraw",
      "di ako makapag withdraw", "cant withdraw",
      "can t withdraw", "cannot withdraw", "ayaw mag withdraw", "ayaw ma withdraw", "withdraw disabled",
      "disabled withdraw", "withdraw button", "di ma click withdraw", "hindi ma click withdraw", "bakit hindi ma withdraw",
    ],
    why:
      "Hindi pa ma-click yung Withdraw kasi hindi pa na-reach ng balance yung minimum withdrawal. " +
      "Don't worry, safe yung balance, naka-carry over lang siya sa next cut-off.",
    steps: [
      "Go to Xfnite Wallet, Wallet tab, Overview para ma-check yung status",
      "Continue lang sa live tasks para tumaas yung balance",
      "Once ma-reach na yung minimum, mag-e-enable na yung Withdraw button",
      "Make sure na naka-set na yung GCash or bank sa Payment Method tab bago mag-withdraw",
    ],
    noNumbers: true,
  },
  {
    id: "payout_history",
    match: [
      "payout history", "nasend na ba", "na send na ba", "sent na ba", "pumasok na ba", "nareceive", "na receive",
      "natanggap", "san makikita sahod", "saan makikita sahod", "history ng sahod",
    ],
    why: "Lahat ng na-release na payouts nasa Payout History, with date, amount, at status.",
    steps: [
      "Go to Xfnite Wallet, Wallet tab, Overview",
      "Scroll down sa Payout History",
      "Kung 'Sent' na yung status, na-send na siya sa naka-set na GCash or bank",
      "Kung Sent na pero wala pa rin, message yung recruiter or TM with screenshot",
    ],
  },
  {
    id: "payment_method",
    match: [
      "payment method", "palitan gcash", "change gcash", "gcash number", "ilagay gcash", "lagay gcash",
      "bank details", "palitan bank", "saan ilalagay gcash", "san ilalagay gcash", "set up gcash",
    ],
    why: "Yung GCash or bank kung saan papasok yung salary, naka-set sa Payment Method tab ng wallet.",
    steps: [
      "Go to Xfnite Wallet, Wallet tab",
      "Click yung Payment Method tab (katabi ng Overview)",
      "Add or update yung GCash or bank details, then save",
    ],
  },
];

function normalize(text: string) {
  return ` ${text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim()} `;
}

// The most specific (longest) matching phrase wins, so "hindi ma withdraw" picks the
// problem guide over the plain how-to guide that only matched "withdraw"
export function findPlaybook(message: string): Playbook | undefined {
  const text = normalize(message);
  let best: { pb: Playbook; score: number } | undefined;
  for (const pb of PLAYBOOKS) {
    const score = Math.max(0, ...pb.match
      .map(m => normalize(m).trim())
      .filter(m => text.includes(` ${m}`))
      .map(m => m.length));
    if (score && (!best || score > best.score)) best = { pb, score };
  }
  return best?.pb;
}

// "Bakit processing?" wants the reason only; "Paano/saan/ano gagawin?" wants the steps.
const HOW_PHRASES = [
  "paano", "pano", "panu", "papaano", "how", "saan", "san", "where", "ano gagawin", "ano gawin", "ano dapat",
  "anong gagawin", "what should", "what to do", "steps", "patulong", "pa help", "paturo", "turo",
  "pwede ba ma", "para ma", "ma fix", "maayos",
];

export function wantsSteps(message: string) {
  const text = normalize(message);
  return HOW_PHRASES.some(p => text.includes(` ${p} `));
}

export function playbookBlock(pb: Playbook, includeSteps: boolean) {
  return [
    `WHY: ${pb.why}`,
    ...(includeSteps ? ["STEPS:", ...pb.steps.map((s, i) => `${i + 1}. ${s}`)] : []),
    pb.noNumbers ? "DO NOT mention any peso amount, threshold, or number." : "",
  ].filter(Boolean).join("\n");
}
